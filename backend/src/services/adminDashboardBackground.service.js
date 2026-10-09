import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { HttpError } from '../lib/httpError.js'

export const ADMIN_BACKGROUND_BUCKET = 'admin-dashboard-assets'
export const ADMIN_BACKGROUND_MAX_BYTES = 5 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 60 * 60
const IMAGE_FORMATS = Object.freeze({
  'image/jpeg': { extension: 'jpg', matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: 'png', matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
  'image/gif': { extension: 'gif', matches: (buffer) => buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6)) },
})
const ROW_FIELDS = 'id, background_image_path, updated_at'

function validateImage(buffer, contentType) {
  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase()
  const format = IMAGE_FORMATS[normalizedType]
  if (!format) throw new HttpError('Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.', 415, 'unsupported_image_type')
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new HttpError('Tệp ảnh đang trống hoặc không hợp lệ.', 400, 'invalid_image')
  if (buffer.length > ADMIN_BACKGROUND_MAX_BYTES) throw new HttpError('Ảnh vượt quá giới hạn 5 MB.', 413, 'image_too_large')
  if (!format.matches(buffer)) throw new HttpError('Nội dung tệp không khớp định dạng ảnh đã chọn.', 415, 'invalid_image_signature')
  return { contentType: normalizedType, extension: format.extension }
}

async function getSettings() {
  const { data, error } = await supabaseAdmin.from('admin_dashboard_settings').select(ROW_FIELDS).eq('id', true).maybeSingle()
  if (error) throw new HttpError('Không thể đọc ảnh nền dashboard.', 503, 'admin_background_database_error')
  return data || { id: true, background_image_path: null, updated_at: null }
}

async function removeStoragePath(path) {
  if (!path) return null
  const { error } = await supabaseAdmin.storage.from(ADMIN_BACKGROUND_BUCKET).remove([path])
  return error || null
}

async function present(settings) {
  let imageUrl = null
  if (settings.background_image_path) {
    const { data, error } = await supabaseAdmin.storage.from(ADMIN_BACKGROUND_BUCKET).createSignedUrl(settings.background_image_path, SIGNED_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) throw new HttpError('Không thể tạo đường dẫn ảnh nền an toàn.', 503, 'admin_background_url_error')
    imageUrl = data.signedUrl
  }
  return { ...settings, image_url: imageUrl }
}

export async function getAdminDashboardBackground() {
  return present(await getSettings())
}

export async function uploadAdminDashboardBackground(buffer, contentType) {
  const format = validateImage(buffer, contentType)
  const existing = await getSettings()
  const imagePath = `background/${randomUUID()}.${format.extension}`
  const { error: storageError } = await supabaseAdmin.storage.from(ADMIN_BACKGROUND_BUCKET).upload(imagePath, buffer, {
    contentType: format.contentType,
    cacheControl: '3600',
    upsert: false,
  })
  if (storageError) throw new HttpError('Không thể tải ảnh lên Storage. Vui lòng thử lại.', 503, 'admin_background_storage_error')

  const { data, error: databaseError } = await supabaseAdmin.from('admin_dashboard_settings')
    .update({ background_image_path: imagePath, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select(ROW_FIELDS)
    .single()
  if (databaseError || !data) {
    await removeStoragePath(imagePath)
    throw new HttpError('Ảnh đã tải lên nhưng không thể lưu cấu hình. Vui lòng thử lại.', 503, 'admin_background_database_error')
  }
  if (existing.background_image_path && existing.background_image_path !== imagePath) {
    const cleanupError = await removeStoragePath(existing.background_image_path)
    if (cleanupError) console.warn('[admin-background] Could not remove replaced image:', cleanupError.message || cleanupError)
  }
  return present(data)
}

export async function deleteAdminDashboardBackground() {
  const existing = await getSettings()
  if (!existing.background_image_path) return { deleted: false, background: await present(existing) }

  const { data, error } = await supabaseAdmin.from('admin_dashboard_settings')
    .update({ background_image_path: null, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select(ROW_FIELDS)
    .single()
  if (error || !data) throw new HttpError('Không thể cập nhật cấu hình xóa ảnh nền.', 503, 'admin_background_database_error')

  const cleanupError = await removeStoragePath(existing.background_image_path)
  if (cleanupError) {
    console.error('[admin-background] Storage delete failed after metadata update:', cleanupError.message || cleanupError)
    const { error: restoreError } = await supabaseAdmin.from('admin_dashboard_settings')
      .update({ background_image_path: existing.background_image_path, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (restoreError) console.error('[admin-background] Metadata rollback failed:', restoreError.message || restoreError)
    throw new HttpError('Đã xóa cấu hình nhưng chưa thể xóa tệp trong Storage. Vui lòng thử lại.', 503, 'admin_background_storage_error')
  }
  return { deleted: true, background: await present(data) }
}
