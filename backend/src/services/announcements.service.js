import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'announcements.json'
const IMAGE_BUCKET = 'announcement-images'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const NOTIFY_TYPES = new Set(['normal', 'hot', 'urgent'])

let memoryCache = null

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

async function ensureDataBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(DATA_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(DATA_BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho dữ liệu lớp: ' + error.message, 502)
    }
  }
}

async function ensureImageBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(IMAGE_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho ảnh thông báo: ' + error.message, 502)
    }
  } else if (data.public === false) {
    await supabaseAdmin.storage.updateBucket(IMAGE_BUCKET, { public: true })
  }
}

function publicImageUrl(path) {
  const { data } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

async function readStore() {
  const { data, error } = await supabaseAdmin.storage.from(DATA_BUCKET).download(DATA_PATH)
  if (error || !data) return { items: [] }
  try {
    const text = await data.text()
    const parsed = JSON.parse(text)
    return { items: Array.isArray(parsed.items) ? parsed.items : [] }
  } catch {
    return { items: [] }
  }
}

async function writeStore(store) {
  await ensureDataBucket()
  const body = Buffer.from(JSON.stringify(store, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(DATA_BUCKET).upload(DATA_PATH, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) {
    throw new AppError('Không lưu được thông báo: ' + error.message, 502)
  }
}

function isExpired(item, now = Date.now()) {
  if (!item?.expires_at) return false
  const t = new Date(item.expires_at).getTime()
  return Number.isFinite(t) && t <= now
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const notify =
    NOTIFY_TYPES.has(raw.notify_type) ? raw.notify_type : 'normal'
  const images = Array.isArray(raw.images)
    ? raw.images.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  return {
    id,
    content: String(raw.content || '').trim(),
    images,
    notify_type: notify,
    expires_at: raw.expires_at ? String(raw.expires_at) : null,
    created_at: String(raw.created_at || new Date().toISOString()),
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_by_name: String(raw.created_by_name || 'Admin').trim() || 'Admin',
    source_homework_id: raw.source_homework_id ? String(raw.source_homework_id) : null,
    is_exam_reminder: raw.is_exam_reminder === true,
  }
}

async function loadAll() {
  if (memoryCache) return clone(memoryCache)
  await ensureDataBucket()
  const store = await readStore()
  const items = store.items.map(normalizeItem).filter(Boolean)
  memoryCache = { items }
  return clone(memoryCache)
}

async function saveAll(items) {
  memoryCache = { items }
  await writeStore({ items })
}

function stripDataUrl(contentBase64) {
  const raw = String(contentBase64 || '').trim()
  const match = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  return match ? match[1] : raw.replace(/\s+/g, '')
}

async function uploadOneImage(file) {
  const mime = String(file?.mimeType || '').toLowerCase()
  const ext = ALLOWED_MIME[mime]
  if (!ext) throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.')

  const pure = stripDataUrl(file.contentBase64)
  if (!pure) throw new AppError('Thiếu dữ liệu ảnh.')

  let bytes
  try {
    bytes = Buffer.from(pure, 'base64')
  } catch {
    throw new AppError('Ảnh không hợp lệ.')
  }
  if (!bytes.length) throw new AppError('Ảnh trống.')
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new AppError('Mỗi ảnh tối đa 8MB.')
  }

  await ensureImageBucket()
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const { error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  })
  if (error) {
    throw new AppError('Không tải được ảnh lên: ' + error.message, 502)
  }
  return publicImageUrl(path)
}

function extractStoragePath(url) {
  if (!url || typeof url !== 'string') return null
  const marker = `/${IMAGE_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
}

async function removeImages(urls) {
  const paths = (urls || []).map(extractStoragePath).filter(Boolean)
  if (!paths.length) return
  try {
    await supabaseAdmin.storage.from(IMAGE_BUCKET).remove(paths)
  } catch (err) {
    console.warn('[announcements] xóa ảnh thất bại:', err.message)
  }
}

async function notifyPush(item) {
  try {
    const { broadcastPush } = await import('./push.service.js')
    const preview = String(item.content || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)
    const title =
      item.is_exam_reminder || item.notify_type === 'urgent'
        ? '🚨 Thông báo quan trọng — 10A4'
        : item.notify_type === 'hot'
          ? '🔥 Thông báo mới — 10A4'
          : 'Thông báo mới — 10A4'
    await broadcastPush({
      title,
      body: preview || 'Có thông báo mới trong lớp.',
      url: '/#/classroom/announcements',
      tag: `announcement-${item.id}`,
      data: { type: 'announcement', id: item.id, tab: 'announcements' },
    })
  } catch (err) {
    console.warn('[announcements] push thất bại:', err?.message || err)
  }
}

/** Danh sách thông báo còn hiệu lực, mới nhất trước. Tự dọn hết hạn. */
export async function listAnnouncements() {
  const data = await loadAll()
  const now = Date.now()
  const alive = []
  const expired = []

  for (const item of data.items) {
    if (isExpired(item, now)) expired.push(item)
    else alive.push(item)
  }

  if (expired.length) {
    for (const item of expired) {
      await removeImages(item.images)
    }
    alive.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    await saveAll(alive)
    return alive
  }

  return alive.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

/**
 * Tạo bài đăng mới.
 * payload: { content, notify_type, expires_at, images: [{ mimeType, contentBase64 }] }
 */
export async function createAnnouncement(payload, profile) {
  const content = String(payload?.content || '').trim()
  const files = Array.isArray(payload?.images) ? payload.images : []
  if (!content && files.length === 0) {
    throw new AppError('Vui lòng nhập nội dung hoặc chọn ít nhất 1 ảnh.')
  }

  const notifyType = NOTIFY_TYPES.has(payload?.notify_type)
    ? payload.notify_type
    : 'normal'

  let expiresAt = null
  if (payload?.expires_at) {
    const t = new Date(payload.expires_at)
    if (Number.isNaN(t.getTime())) {
      throw new AppError('Thời gian tự xóa không hợp lệ.')
    }
    if (t.getTime() <= Date.now()) {
      throw new AppError('Thời gian tự xóa phải lớn hơn thời gian hiện tại.')
    }
    expiresAt = t.toISOString()
  }

  const imageUrls = []
  for (const file of files) {
    imageUrls.push(await uploadOneImage(file))
  }

  const item = {
    id: randomUUID(),
    content,
    images: imageUrls,
    notify_type: notifyType,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
    source_homework_id: null,
    is_exam_reminder: false,
  }

  const data = await loadAll()
  const next = [item, ...data.items.filter((row) => !isExpired(row))]
  await saveAll(next)
  void notifyPush(item)
  return item
}

/**
 * Thông báo nhắc kiểm tra (từ báo bài BTVN).
 * Nền cảnh báo urgent, tự xóa sau ngày kiểm tra.
 */
export async function createExamReminderAnnouncement(payload, profile) {
  const content = String(payload?.content || '').trim()
  if (!content) throw new AppError('Thiếu nội dung thông báo kiểm tra.')

  let expiresAt = null
  if (payload?.expires_at) {
    const t = new Date(payload.expires_at)
    if (!Number.isNaN(t.getTime()) && t.getTime() > Date.now()) {
      expiresAt = t.toISOString()
    }
  }

  const item = {
    id: randomUUID(),
    content,
    images: [],
    notify_type: 'urgent',
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
    source_homework_id: payload?.source_homework_id
      ? String(payload.source_homework_id)
      : null,
    is_exam_reminder: true,
  }

  const data = await loadAll()
  const next = [item, ...data.items.filter((row) => !isExpired(row))]
  await saveAll(next)
  void notifyPush(item)
  return item
}

export async function deleteAnnouncement(id) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)

  const data = await loadAll()
  const found = data.items.find((row) => row.id === targetId)
  if (!found) throw new AppError('Không tìm thấy thông báo.', 404)

  await removeImages(found.images)
  const next = data.items.filter((row) => row.id !== targetId)
  await saveAll(next)
  return { id: targetId }
}

/** Xóa mọi thông báo gắn với một báo bài (khi admin xóa BTVN). */
export async function deleteAnnouncementsByHomeworkId(homeworkId) {
  const target = String(homeworkId || '').trim()
  if (!target) return { deleted: 0 }

  const data = await loadAll()
  const toRemove = data.items.filter((row) => row.source_homework_id === target)
  if (!toRemove.length) return { deleted: 0 }

  for (const item of toRemove) {
    await removeImages(item.images)
  }
  const next = data.items.filter((row) => row.source_homework_id !== target)
  await saveAll(next)
  return { deleted: toRemove.length }
}

export async function updateAnnouncementExpiry(id, expiresAtRaw) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)

  let expiresAt = null
  if (expiresAtRaw) {
    const t = new Date(expiresAtRaw)
    if (Number.isNaN(t.getTime())) {
      throw new AppError('Thời gian tự xóa không hợp lệ.')
    }
    if (t.getTime() <= Date.now()) {
      throw new AppError('Thời gian tự xóa phải lớn hơn thời gian hiện tại.')
    }
    expiresAt = t.toISOString()
  }

  const data = await loadAll()
  const idx = data.items.findIndex((row) => row.id === targetId)
  if (idx === -1) throw new AppError('Không tìm thấy thông báo.', 404)

  data.items[idx] = { ...data.items[idx], expires_at: expiresAt }
  await saveAll(data.items)
  return data.items[idx]
}
