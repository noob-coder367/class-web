import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { readStore as readDbStore, writeStore as writeDbStore } from '../utils/classroomDbStore.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'announcements.json'
const IMAGE_BUCKET = 'announcement-images'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
// Toàn hệ thống chỉ giữ 20 file ảnh mới nhất của announcement.
const MAX_ANNOUNCEMENT_IMAGES_SYSTEM = 20
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const NOTIFY_TYPES = new Set(['normal', 'hot', 'urgent'])
const SECTIONS = new Set(['main', 'important', 'discipline'])
const DOCUMENT_KINDS = new Set(['thong_bao', 'bao_cao'])
let memoryCache = null

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

async function readStore() {
  const parsed = await readDbStore({ key: 'announcements', legacyPath: DATA_PATH, empty: { items: [] }, label: 'thông báo' })
  return { items: Array.isArray(parsed?.items) ? parsed.items : [] }
}

async function writeStore(store) {
  await writeDbStore({ key: 'announcements', value: store, label: 'thông báo' })
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

function isExpired(item, now = Date.now()) {
  if (!item?.expires_at) return false
  const t = new Date(item.expires_at).getTime()
  return Number.isFinite(t) && t <= now
}

function parseSection(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return SECTIONS.has(value) ? value : 'main'
}
function parseDocumentKind(raw) {
  return DOCUMENT_KINDS.has(raw) ? raw : 'thong_bao'
}
function nextShortId(items, documentKind) {
  return items.reduce((max, row) => {
    if (parseDocumentKind(row?.document_kind) !== documentKind) return max
    const value = Number(row?.short_id)
    return Number.isInteger(value) && value > max ? value : max
  }, 0) + 1
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const notify = NOTIFY_TYPES.has(raw.notify_type) ? raw.notify_type : 'normal'
  const images = Array.isArray(raw.images)
    ? raw.images.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  const hidden = raw.hidden === true
  return {
    id,
    title: String(raw.title || '').trim(),
    document_kind: parseDocumentKind(raw.document_kind),
    short_id: Number.isInteger(Number(raw.short_id)) && Number(raw.short_id) > 0 ? Number(raw.short_id) : null,
    content: String(raw.content || '').trim(),
    images,
    notify_type: notify,
    section: parseSection(raw.section),
    expires_at: raw.expires_at ? String(raw.expires_at) : null,
    created_at: String(raw.created_at || new Date().toISOString()),
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_by_name: String(raw.created_by_name || 'Admin').trim() || 'Admin',
    source_homework_id: raw.source_homework_id ? String(raw.source_homework_id) : null,
    is_exam_reminder: raw.is_exam_reminder === true,
    is_system: raw.is_system === true,
    hidden,
    hidden_at: hidden && raw.hidden_at ? String(raw.hidden_at) : null,
    hidden_by: hidden && raw.hidden_by ? String(raw.hidden_by) : null,
    hidden_by_name: hidden ? String(raw.hidden_by_name || '').trim() || null : null,
    subject_user_id: raw.subject_user_id ? String(raw.subject_user_id) : null,
    subject_user_name: raw.subject_user_name ? String(raw.subject_user_name) : null,
    from_level: raw.from_level ? String(raw.from_level) : null,
    to_level: raw.to_level ? String(raw.to_level) : null,
  }
}

async function loadAll() {
  const store = await readStore()
  const items = store.items.map(normalizeItem).filter(Boolean)
  const counters = new Map()
  let changed = false
  for (const item of items) {
    const kind = parseDocumentKind(item.document_kind)
    const current = counters.get(kind) || 0
    if (Number.isInteger(item.short_id) && item.short_id > current) counters.set(kind, item.short_id)
  }
  for (const item of items) {
    if (!item.short_id) {
      const kind = parseDocumentKind(item.document_kind)
      const next = (counters.get(kind) || 0) + 1
      counters.set(kind, next)
      item.short_id = next
      changed = true
    }
  }
  if (changed) await writeStore({ items })
  return { items }
}

async function saveAll(items) {
  await writeStore({ items })
  memoryCache = { items }
}

async function mutateStore(mutator) {
  const data = await loadAll()
  const result = await mutator(data.items)
  await writeStore({ items: data.items })
  memoryCache = { items: data.items }
  return result
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
  if (bytes.length > MAX_IMAGE_BYTES) throw new AppError('Mỗi ảnh tối đa 8MB.')
  await ensureImageBucket()
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const { error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  })
  if (error) throw new AppError('Không tải được ảnh lên: ' + error.message, 502)
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

async function enforceAnnouncementImageQuota(max = MAX_ANNOUNCEMENT_IMAGES_SYSTEM) {
  const { items } = await loadAll()
  const refs = []
  const seenPaths = new Set()
  for (const item of items) {
    const createdAt = new Date(item.created_at || 0).getTime() || 0
    for (const [index, url] of (item.images || []).entries()) {
      const path = extractStoragePath(url)
      if (!path || !path.startsWith('posts/') || seenPaths.has(path)) continue
      seenPaths.add(path)
      refs.push({ item, url, path, createdAt, index })
    }
  }
  if (refs.length <= max) return
  refs.sort((a, b) => b.createdAt - a.createdAt || b.index - a.index)
  const removeRefs = refs.slice(max)
  const paths = removeRefs.map((ref) => ref.path)
  const { error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).remove(paths)
  if (error) {
    console.warn('[announcements] quota ảnh: không xóa được ảnh cũ:', error.message)
    return
  }
  const removed = new Set(paths)
  let changed = false
  for (const item of items) {
    const nextImages = (item.images || []).filter((url) => !removed.has(extractStoragePath(url)))
    if (nextImages.length !== item.images.length) {
      item.images = nextImages
      changed = true
    }
  }
  if (changed) await writeStore({ items })
}

async function notifyPush(item) {
  try {
    const { broadcastPush } = await import('./push.service.js')
    const preview = String(item.content || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const title =
      item.section === 'discipline'
        ? '⚠️ Vi phạm kỷ luật cao — 10A4'
        : item.is_exam_reminder || item.notify_type === 'urgent'
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

function sortNewest(items) {
  return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export async function purgeExpired() {
  return mutateStore(async (items) => {
    const now = Date.now()
    const alive = []
    const expired = []
    for (const item of items) {
      if (isExpired(item, now)) expired.push(item)
      else alive.push(item)
    }
    for (const item of expired) await removeImages(item.images)
    items.splice(0, items.length, ...alive)
    return sortNewest(alive)
  })
}

export async function listAnnouncements() {
  await purgeExpired()
  await enforceAnnouncementImageQuota()
  const { items } = await loadAll()
  return items.filter((item) => !isExpired(item) && item.hidden !== true)
}

export async function listArchive(section) {
  await purgeExpired()
  await enforceAnnouncementImageQuota()
  const { items } = await loadAll()
  const hidden = items.filter((item) => !isExpired(item) && item.hidden === true)
  if (!section) return hidden
  const key = parseSection(section)
  return hidden.filter((item) => item.section === key)
}

export async function getAnnouncementById(id) {
  const targetId = String(id || '').trim()
  if (!targetId) return null
  const alive = await purgeExpired()
  return alive.find((row) => row.id === targetId) || null
}

function parseExpiresAt(raw, { requiredFuture = true } = {}) {
  if (!raw) return null
  const t = new Date(raw)
  if (Number.isNaN(t.getTime())) throw new AppError('Thời gian tự xóa không hợp lệ.')
  if (requiredFuture && t.getTime() <= Date.now()) {
    throw new AppError('Thời gian tự xóa phải lớn hơn thời gian hiện tại.')
  }
  return t.toISOString()
}

export async function createAnnouncement(payload, profile) {
  const content = String(payload?.content || '').trim()
  const title = String(payload?.title || '').trim()
  const documentKind = parseDocumentKind(payload?.document_kind)
  const files = Array.isArray(payload?.images) ? payload.images : []
  if (!content && files.length === 0) {
    throw new AppError('Vui lòng nhập nội dung hoặc chọn ít nhất 1 ảnh.')
  }
  const requested = String(payload?.section || '').trim().toLowerCase()
  if (requested === 'discipline') {
    throw new AppError('Mục vi phạm kỷ luật cao do hệ thống tự đăng, không đăng tay được.', 403)
  }
  const section = requested === 'important' ? 'important' : 'main'
  const notifyType = NOTIFY_TYPES.has(payload?.notify_type)
    ? payload.notify_type
    : section === 'important'
      ? 'hot'
      : 'normal'
  const expiresAt = parseExpiresAt(payload?.expires_at)
  const imageUrls = []
  for (const file of files) imageUrls.push(await uploadOneImage(file))
  const item = {
    id: randomUUID(),
    title,
    document_kind: documentKind,
    short_id: null,
    content,
    images: imageUrls,
    notify_type: notifyType,
    section,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
    source_homework_id: null,
    is_exam_reminder: false,
    is_system: false,
    hidden: false,
    hidden_at: null,
    hidden_by: null,
    hidden_by_name: null,
  }
  await mutateStore((items) => {
    item.short_id = nextShortId(items, documentKind)
    const next = [item, ...items.filter((row) => !isExpired(row))]
    items.splice(0, items.length, ...next)
  })
  await enforceAnnouncementImageQuota()
  void notifyPush(item)
  return item
}

export async function createExamReminderAnnouncement(payload, profile) {
  const content = String(payload?.content || '').trim()
  if (!content) throw new AppError('Thiếu nội dung thông báo kiểm tra.')
  let expiresAt = null
  if (payload?.expires_at) {
    const t = new Date(payload.expires_at)
    if (!Number.isNaN(t.getTime()) && t.getTime() > Date.now()) expiresAt = t.toISOString()
  }
  const item = {
    id: randomUUID(),
    content,
    images: [],
    title: String(payload?.title || '').trim(),
    document_kind: 'bao_cao',
    short_id: null,
    notify_type: 'urgent',
    section: 'important',
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
    source_homework_id: payload?.source_homework_id ? String(payload.source_homework_id) : null,
    is_exam_reminder: true,
    is_system: false,
    hidden: false,
    hidden_at: null,
    hidden_by: null,
    hidden_by_name: null,
  }
  await mutateStore((items) => {
    item.short_id = nextShortId(items, item.document_kind)
    const next = [item, ...items.filter((row) => !isExpired(row))]
    items.splice(0, items.length, ...next)
  })
  void notifyPush(item)
  return item
}

export async function createImportantHomeworkAnnouncement(payload, profile) {
  const content = String(payload?.content || '').trim()
  if (!content) throw new AppError('Thiếu nội dung báo bài quan trọng.')
  let expiresAt = null
  if (payload?.expires_at) {
    const t = new Date(payload.expires_at)
    if (!Number.isNaN(t.getTime()) && t.getTime() > Date.now()) expiresAt = t.toISOString()
  }
  const item = {
    id: randomUUID(),
    content,
    images: [],
    title: String(payload?.title || '').trim(),
    document_kind: 'bao_cao',
    short_id: null,
    notify_type: NOTIFY_TYPES.has(payload?.notify_type) ? payload.notify_type : 'hot',
    section: 'important',
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
    source_homework_id: payload?.source_homework_id ? String(payload.source_homework_id) : null,
    is_exam_reminder: false,
    is_system: false,
    hidden: false,
    hidden_at: null,
    hidden_by: null,
    hidden_by_name: null,
  }
  await mutateStore((items) => {
    item.short_id = nextShortId(items, item.document_kind)
    const next = [item, ...items.filter((row) => !isExpired(row))]
    items.splice(0, items.length, ...next)
  })
  void notifyPush(item)
  return item
}

export async function createSystemDisciplineAnnouncement(payload) {
  const name = String(payload?.name || 'Thành viên').trim() || 'Thành viên'
  const fromLabel = String(payload?.fromLabel || payload?.fromLevel || '').trim()
  const toLabel = String(payload?.toLabel || payload?.toLevel || '').trim()
  const content =
    String(payload?.content || '').trim() ||
    `⚠️ ${name} đã tụt 1 bậc trạng thái uy tín` +
      (fromLabel && toLabel ? `: ${fromLabel} → ${toLabel}.` : '.')
  const item = {
    id: randomUUID(),
    content,
    images: [],
    notify_type: 'urgent',
    section: 'discipline',
    expires_at: null,
    created_at: new Date().toISOString(),
    created_by: null,
    created_by_name: 'Hệ thống',
    source_homework_id: null,
    is_exam_reminder: false,
    is_system: true,
    hidden: false,
    hidden_at: null,
    hidden_by: null,
    hidden_by_name: null,
    subject_user_id: payload?.userId ? String(payload.userId) : null,
    subject_user_name: name,
    from_level: payload?.fromLevel ? String(payload.fromLevel) : null,
    to_level: payload?.toLevel ? String(payload.toLevel) : null,
  }
  await mutateStore((items) => {
    const next = [item, ...items.filter((row) => !isExpired(row))]
    items.splice(0, items.length, ...next)
  })
  void notifyPush(item)
  return item
}

export async function hideAnnouncement(id, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)
  return mutateStore((items) => {
    const idx = items.findIndex((row) => row.id === targetId)
    if (idx === -1) throw new AppError('Không tìm thấy thông báo.', 404)
    const current = items[idx]
    if (isExpired(current)) throw new AppError('Thông báo đã hết hạn.', 404)
    if (current.hidden === true) return current
    items[idx] = { ...current, hidden: true, hidden_at: new Date().toISOString(), hidden_by: profile?.id || null, hidden_by_name: String(profile?.username || '').trim() || null }
    return items[idx]
  })
}

export async function unhideAnnouncement(id) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)
  return mutateStore((items) => {
    const idx = items.findIndex((row) => row.id === targetId)
    if (idx === -1) throw new AppError('Không tìm thấy thông báo.', 404)
    const current = items[idx]
    if (isExpired(current)) throw new AppError('Thông báo đã hết hạn.', 404)
    items[idx] = { ...current, hidden: false, hidden_at: null, hidden_by: null, hidden_by_name: null }
    return items[idx]
  })
}

export async function deleteAnnouncement(id) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)
  return mutateStore(async (items) => {
    const found = items.find((row) => row.id === targetId)
    if (!found) throw new AppError('Không tìm thấy thông báo.', 404)
    await removeImages(found.images)
    items.splice(0, items.length, ...items.filter((row) => row.id !== targetId))
    return { id: targetId }
  })
}

export async function deleteAnnouncementsByHomeworkId(homeworkId) {
  const target = String(homeworkId || '').trim()
  if (!target) return { deleted: 0 }
  return mutateStore(async (items) => {
    const toRemove = items.filter((row) => row.source_homework_id === target)
    if (!toRemove.length) return { deleted: 0 }
    for (const item of toRemove) await removeImages(item.images)
    items.splice(0, items.length, ...items.filter((row) => row.source_homework_id !== target))
    return { deleted: toRemove.length }
  })
}

/** Chỉ xóa thông báo kiểm tra (is_exam_reminder) gắn với báo bài — giữ bài báo bài thường. */
export async function deleteExamRemindersByHomeworkId(homeworkId) {
  const target = String(homeworkId || '').trim()
  if (!target) return { deleted: 0 }
  return mutateStore(async (items) => {
    const toRemove = items.filter((row) => row.source_homework_id === target && row.is_exam_reminder === true)
    if (!toRemove.length) return { deleted: 0 }
    for (const item of toRemove) await removeImages(item.images)
    items.splice(0, items.length, ...items.filter((row) => !(row.source_homework_id === target && row.is_exam_reminder === true)))
    return { deleted: toRemove.length }
  })
}

export async function updateAnnouncementExpiry(id, expiresAtRaw) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)
  const expiresAt = parseExpiresAt(expiresAtRaw)
  return mutateStore((items) => {
    const idx = items.findIndex((row) => row.id === targetId)
    if (idx === -1) throw new AppError('Không tìm thấy thông báo.', 404)
    items[idx] = { ...items[idx], expires_at: expiresAt }
    return items[idx]
  })
}
