import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const IMAGE_BUCKET = 'event-images'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const NOTIFY_TYPES = new Set(['normal', 'hot', 'urgent'])

async function ensureImageBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(IMAGE_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho ảnh sự kiện: ' + error.message, 502)
    }
  } else if (data.public === false) {
    await supabaseAdmin.storage.updateBucket(IMAGE_BUCKET, { public: true })
  }
}

function publicImageUrl(path) {
  const { data } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

export async function createEventImageUploadUrls(files) {
  const list = Array.isArray(files) ? files : []
  if (!list.length || list.length > 5) throw new AppError('Mỗi sự kiện tải tối đa 5 ảnh.', 400)
  await ensureImageBucket()
  const uploads = await Promise.all(list.map(async (file) => {
    const mimeType = String(file?.mimeType || '').toLowerCase()
    const ext = ALLOWED_MIME[mimeType]
    const sizeBytes = Number(file?.sizeBytes ?? file?.size)
    if (!ext) throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.', 400)
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) throw new AppError('Mỗi ảnh tối đa 8MB.', 400)
    const path = `posts/${randomUUID()}.${ext}`
    const result = await supabaseAdmin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path, { upsert: false })
    if (result.error) throw new AppError('Không tạo được liên kết tải ảnh sự kiện.', 502)
    return { path, token: result.data.token, signedUrl: result.data.signedUrl, mimeType, sizeBytes }
  }))
  return { bucket: IMAGE_BUCKET, uploads }
}

async function verifyEventImage(file) {
  const path = String(file?.path || '')
  const mimeType = String(file?.mimeType || '').toLowerCase()
  const ext = ALLOWED_MIME[mimeType]
  const sizeBytes = Number(file?.sizeBytes)
  if (!path.startsWith('posts/') || path.includes('..') || path.split('/').length !== 2 || !ext) throw new AppError('Ảnh sự kiện không hợp lệ.', 400)
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) throw new AppError('Mỗi ảnh tối đa 8MB.', 400)
  const name = path.split('/').pop()
  const { data, error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).list('posts', { limit: 100, search: name })
  if (error) throw new AppError('Không thể xác minh ảnh sự kiện.', 502)
  const object = (data || []).find((row) => row.name === name)
  if (!object) throw new AppError('Ảnh chưa được tải lên Storage.', 400)
  if (Number.isFinite(Number(object.metadata?.size)) && Number(object.metadata.size) !== sizeBytes) throw new AppError('Kích thước ảnh không khớp.', 400)
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
    console.warn('[events] xóa ảnh thất bại:', err.message)
  }
}

async function cleanupExpired() {
  try {
    await supabaseAdmin.rpc('delete_expired_events')
  } catch (err) {
    console.warn('[events] dọn sự kiện hết hạn thất bại:', err.message)
  }
}

export async function listEvents(query = {}) {
  await cleanupExpired()
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 50))
  const from = (page - 1) * pageSize
  const { data, error, count } = await supabaseAdmin
    .from('events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) {
    console.error('[events] list query failed', { code: error.code || 'UNKNOWN' })
    throw new AppError('Không tải được sự kiện. Vui lòng thử lại sau.', 503)
  }
  const rows = data || []
  return Object.assign(rows, { pagination: { page, pageSize, total: count || 0, hasMore: from + rows.length < (count || 0) } })
}

export async function createEvent(payload, profile) {
  const content = String(payload?.content || '').trim()
  const files = Array.isArray(payload?.images) ? payload.images : []
  if (files.length > 5) throw new AppError('Mỗi sự kiện tải tối đa 5 ảnh.', 400)
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
    if (!file?.path) throw new AppError('Tải ảnh bằng Base64 đã bị tắt; hãy tải trực tiếp lên Storage.', 400)
    imageUrls.push(await verifyEventImage(file))
  }

  const row = {
    content,
    images: imageUrls,
    notify_type: notifyType,
    expires_at: expiresAt,
    created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert([row])
    .select('*')
    .maybeSingle()

  if (error) {
    await removeImages(imageUrls)
    throw new AppError('Đăng sự kiện thất bại: ' + error.message, 500)
  }
  return data
}

export async function deleteEvent(id) {
  const eventId = String(id || '').trim()
  if (!eventId) throw new AppError('Thiếu mã sự kiện.', 400)

  const { data: existing, error: readError } = await supabaseAdmin
    .from('events')
    .select('id, images')
    .eq('id', eventId)
    .maybeSingle()

  if (readError) throw new AppError('Không đọc được sự kiện.', 500)
  if (!existing) throw new AppError('Không tìm thấy sự kiện.', 404)

  const { error } = await supabaseAdmin.from('events').delete().eq('id', eventId)
  if (error) throw new AppError('Xóa sự kiện thất bại: ' + error.message, 500)

  await removeImages(existing.images)
  return { id: eventId }
}

export async function updateEventExpiry(id, expiresAtRaw) {
  const eventId = String(id || '').trim()
  if (!eventId) throw new AppError('Thiếu mã sự kiện.', 400)

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

  const { data, error } = await supabaseAdmin
    .from('events')
    .update({ expires_at: expiresAt })
    .eq('id', eventId)
    .select('*')
    .maybeSingle()

  if (error) throw new AppError('Cập nhật thời gian tự xóa thất bại: ' + error.message, 500)
  if (!data) throw new AppError('Không tìm thấy sự kiện.', 404)
  return data
}
