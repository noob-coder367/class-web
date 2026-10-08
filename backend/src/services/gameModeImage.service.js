import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { HttpError } from '../lib/httpError.js'

export const GAME_IMAGE_BUCKET = 'game-images'
export const GAME_IMAGE_MAX_BYTES = 5 * 1024 * 1024

const IMAGE_FORMATS = Object.freeze({
  'image/jpeg': { extension: 'jpg', matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: 'png', matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
  'image/gif': { extension: 'gif', matches: (buffer) => buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6)) },
})
const GAME_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validateGameKey(gameKey) {
  if (typeof gameKey !== 'string' || gameKey.length > 64 || !GAME_KEY_PATTERN.test(gameKey)) {
    throw new HttpError('Mã Game Mode không hợp lệ.', 400, 'invalid_game_key')
  }
}

function validateImage(buffer, contentType) {
  const format = IMAGE_FORMATS[String(contentType || '').split(';')[0].trim().toLowerCase()]
  if (!format) throw new HttpError('Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.', 415, 'unsupported_image_type')
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new HttpError('Tệp ảnh đang trống hoặc không hợp lệ.', 400, 'invalid_image')
  }
  if (buffer.length > GAME_IMAGE_MAX_BYTES) {
    throw new HttpError('Ảnh vượt quá giới hạn 5 MB.', 413, 'image_too_large')
  }
  if (!format.matches(buffer)) {
    throw new HttpError('Nội dung tệp không khớp định dạng ảnh đã chọn.', 415, 'invalid_image_signature')
  }
  return { contentType: String(contentType).split(';')[0].trim().toLowerCase(), extension: format.extension }
}

async function getExistingImage(gameKey) {
  const { data, error } = await supabaseAdmin
    .from('game_mode_images')
    .select('game_key, image_path')
    .eq('game_key', gameKey)
    .maybeSingle()
  if (error) throw new HttpError('Không thể đọc ảnh Game Mode hiện tại.', 503, 'game_image_database_error')
  return data
}

async function removeStoragePath(path) {
  if (!path) return null
  const { error } = await supabaseAdmin.storage.from(GAME_IMAGE_BUCKET).remove([path])
  return error || null
}

function publicImage(row) {
  const { data } = supabaseAdmin.storage.from(GAME_IMAGE_BUCKET).getPublicUrl(row.image_path)
  return { ...row, image_url: data.publicUrl }
}

export async function uploadGameModeImage(gameKey, buffer, contentType) {
  validateGameKey(gameKey)
  const format = validateImage(buffer, contentType)
  const existing = await getExistingImage(gameKey)
  const imagePath = `${gameKey}/${randomUUID()}.${format.extension}`

  const { error: storageError } = await supabaseAdmin.storage
    .from(GAME_IMAGE_BUCKET)
    .upload(imagePath, buffer, { contentType: format.contentType, cacheControl: '3600', upsert: false })
  if (storageError) {
    console.error('[game-image] Storage upload failed:', storageError.message || storageError)
    throw new HttpError('Không thể tải ảnh lên Storage. Vui lòng thử lại.', 503, 'game_image_storage_error')
  }

  const { data, error: databaseError } = await supabaseAdmin
    .from('game_mode_images')
    .upsert({ game_key: gameKey, image_path: imagePath }, { onConflict: 'game_key' })
    .select('game_key, image_path, updated_at')
    .single()

  if (databaseError || !data) {
    await removeStoragePath(imagePath)
    console.error('[game-image] Metadata save failed:', databaseError?.message || databaseError)
    throw new HttpError('Ảnh đã tải lên nhưng không thể lưu thông tin. Vui lòng thử lại.', 503, 'game_image_database_error')
  }

  if (existing?.image_path && existing.image_path !== imagePath) {
    const cleanupError = await removeStoragePath(existing.image_path)
    if (cleanupError) console.warn('[game-image] Could not remove replaced image:', cleanupError.message || cleanupError)
  }
  return publicImage(data)
}

export async function deleteGameModeImage(gameKey) {
  validateGameKey(gameKey)
  const existing = await getExistingImage(gameKey)
  if (!existing) return { deleted: false }

  const { error } = await supabaseAdmin.from('game_mode_images').delete().eq('game_key', gameKey)
  if (error) throw new HttpError('Không thể xóa thông tin ảnh Game Mode.', 503, 'game_image_database_error')

  const cleanupError = await removeStoragePath(existing.image_path)
  if (cleanupError) console.warn('[game-image] Could not remove deleted image:', cleanupError.message || cleanupError)
  return { deleted: true }
}
