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

export async function listEvents() {
  await cleanupExpired()
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new AppError('Không tải được sự kiện: ' + error.message, 500)
  return data || []
}

export async function createEvent(payload, profile) {
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
