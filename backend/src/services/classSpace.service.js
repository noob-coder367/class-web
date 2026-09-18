import { randomUUID, createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'class-space.json'
const IMAGE_BUCKET = 'class-space-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

let memoryCache = null

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function hashPassword(raw) {
  return createHash('sha256').update(String(raw || '')).digest('hex')
}

async function ensureDataBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(DATA_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(DATA_BUCKET, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho dữ liệu lớp học: ' + error.message, 502)
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
      throw new AppError('Không tạo được kho ảnh lớp học: ' + error.message, 502)
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
    throw new AppError('Không lưu được lớp học: ' + error.message, 502)
  }
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const isPublic = raw.isPublic !== false
  return {
    id,
    title: String(raw.title || '').trim() || 'Lớp học',
    cover: String(raw.cover || ''),
    isPublic,
    passwordHash: isPublic ? '' : String(raw.passwordHash || ''),
    shuffle: raw.shuffle === true,
    questions: Array.isArray(raw.questions) ? raw.questions : [],
    ownerId: raw.ownerId ? String(raw.ownerId) : '',
    ownerName: String(raw.ownerName || 'Ẩn danh').trim() || 'Ẩn danh',
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : new Date().toISOString(),
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

function toPublicMeta(item) {
  // Danh sách lưới "Lớp học": KHÔNG gửi passwordHash hay toàn bộ câu hỏi ra ngoài.
  return {
    id: item.id,
    title: item.title,
    cover: item.cover,
    isPublic: item.isPublic,
    shuffle: item.shuffle,
    questionCount: item.questions.length,
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function toFullPayload(item) {
  // Dùng khi người xem đã được phép vào lớp (public / đúng chủ / đúng mật khẩu).
  const { passwordHash, ...rest } = item
  return { ...rest, questions: item.questions }
}

function stripDataUrl(contentBase64) {
  const raw = String(contentBase64 || '').trim()
  const match = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  return match ? match[1] : raw.replace(/\s+/g, '')
}

export async function uploadClassSpaceImage(payload) {
  const mime = String(payload?.mimeType || '').toLowerCase()
  const ext = ALLOWED_MIME[mime]
  if (!ext) throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.')
  const pure = stripDataUrl(payload?.contentBase64)
  if (!pure) throw new AppError('Thiếu dữ liệu ảnh.')
  let bytes
  try {
    bytes = Buffer.from(pure, 'base64')
  } catch {
    throw new AppError('Ảnh không hợp lệ.')
  }
  if (!bytes.length) throw new AppError('Ảnh trống.')
  if (bytes.length > MAX_IMAGE_BYTES) throw new AppError('Mỗi ảnh tối đa 10MB.')
  await ensureImageBucket()
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const { error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  })
  if (error) throw new AppError('Không tải được ảnh lên: ' + error.message, 502)
  return publicImageUrl(path)
}

export async function listClassSpace() {
  const data = await loadAll()
  const items = [...data.items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return items.map(toPublicMeta)
}

export async function getClassSpaceById(id, { password, profile } = {}) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const data = await loadAll()
  const item = data.items.find((row) => row.id === targetId)
  if (!item) throw new AppError('Không tìm thấy lớp học.', 404)

  const isOwner = !!profile?.id && profile.id === item.ownerId
  if (item.isPublic || isOwner) return toFullPayload(item)

  if (!password) {
    const err = new AppError('Lớp học riêng tư, vui lòng nhập mật khẩu.', 401)
    err.code = 'PASSWORD_REQUIRED'
    throw err
  }
  if (hashPassword(password) !== item.passwordHash) {
    const err = new AppError('Mật khẩu không đúng.', 403)
    err.code = 'WRONG_PASSWORD'
    throw err
  }
  return toFullPayload(item)
}

export async function createClassSpace(payload, profile) {
  const title = String(payload?.title || '').trim()
  if (!title) throw new AppError('Vui lòng nhập tiêu đề lớp học.', 400)
  const isPublic = payload?.isPublic !== false
  if (!isPublic && String(payload?.password || '').length !== 6) {
    throw new AppError('Lớp riêng tư cần mật khẩu đủ 6 chữ số.', 400)
  }
  const now = new Date().toISOString()
  const item = normalizeItem({
    id: randomUUID(),
    title,
    cover: payload?.cover || '',
    isPublic,
    passwordHash: isPublic ? '' : hashPassword(payload.password),
    shuffle: !!payload?.shuffle,
    questions: Array.isArray(payload?.questions) ? payload.questions : [],
    ownerId: profile?.id || '',
    ownerName: profile?.username || 'Ẩn danh',
    createdAt: now,
    updatedAt: now,
  })
  const data = await loadAll()
  await saveAll([...data.items, item])
  return toFullPayload(item)
}

export async function updateClassSpace(id, payload, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const data = await loadAll()
  const idx = data.items.findIndex((row) => row.id === targetId)
  if (idx === -1) throw new AppError('Không tìm thấy lớp học.', 404)
  const current = data.items[idx]
  if (!profile?.id || profile.id !== current.ownerId) {
    throw new AppError('Bạn không phải chủ lớp học này nên không thể chỉnh sửa.', 403)
  }

  const title = String(payload?.title || '').trim()
  if (!title) throw new AppError('Vui lòng nhập tiêu đề lớp học.', 400)
  const isPublic = payload?.isPublic !== false
  if (!isPublic && payload?.password && String(payload.password).length !== 6) {
    throw new AppError('Lớp riêng tư cần mật khẩu đủ 6 chữ số.', 400)
  }

  const passwordHash = isPublic
    ? ''
    : payload?.password
      ? hashPassword(payload.password)
      : current.passwordHash

  const updated = normalizeItem({
    ...current,
    title,
    cover: payload?.cover ?? current.cover,
    isPublic,
    passwordHash,
    shuffle: !!payload?.shuffle,
    questions: Array.isArray(payload?.questions) ? payload.questions : current.questions,
    updatedAt: new Date().toISOString(),
  })

  data.items[idx] = updated
  await saveAll(data.items)
  return toFullPayload(updated)
}
