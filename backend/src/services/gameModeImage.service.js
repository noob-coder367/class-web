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
const IMAGE_ROW_FIELDS = 'game_key, image_path, display_title, display_note, text_color, updated_at'

function validateGameKey(gameKey) {
  if (typeof gameKey !== 'string' || gameKey.length > 64 || !GAME_KEY_PATTERN.test(gameKey)) {
    throw new HttpError('Mã Game Mode không hợp lệ.', 400, 'invalid_game_key')
  }
}

function validateImage(buffer, contentType) {
  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase()
  const format = IMAGE_FORMATS[normalizedType]
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
  return { contentType: normalizedType, extension: format.extension }
}

async function getExistingImage(gameKey) {
  const { data, error } = await supabaseAdmin
    .from('game_mode_images')
    .select(IMAGE_ROW_FIELDS)
    .eq('game_key', gameKey)
    .maybeSingle()
  if (error) throw new HttpError('Không thể đọc thông tin Game Mode hiện tại.', 503, 'game_image_database_error')
  return data
}

async function removeStoragePath(path) {
  if (!path) return null
  const { error } = await supabaseAdmin.storage.from(GAME_IMAGE_BUCKET).remove([path])
  return error || null
}

function publicImage(row) {
  const imageUrl = row.image_path
    ? supabaseAdmin.storage.from(GAME_IMAGE_BUCKET).getPublicUrl(row.image_path).data.publicUrl
    : null
  return { ...row, image_url: imageUrl }
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
    .upsert({
      game_key: gameKey,
      image_path: imagePath,
      display_title: existing?.display_title || null,
      display_note: existing?.display_note || null,
      text_color: existing?.text_color || null,
    }, { onConflict: 'game_key' })
    .select(IMAGE_ROW_FIELDS)
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

export async function saveGameModeContent(gameKey, input) {
  validateGameKey(gameKey)
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError('Thông tin trò chơi không hợp lệ.', 400, 'invalid_game_content')
  }

  const displayTitle = typeof input.display_title === 'string'
    ? input.display_title.trim().replace(/\s+/g, ' ')
    : ''
  const displayNote = typeof input.display_note === 'string' ? input.display_note.trim() : ''
  const textColor = typeof input.text_color === 'string' ? input.text_color.trim().toUpperCase() : ''

  if (displayTitle.length < 1 || displayTitle.length > 60) {
    throw new HttpError('Tên trò chơi cần từ 1 đến 60 ký tự.', 400, 'invalid_game_title')
  }
  if (displayNote.length > 300) {
    throw new HttpError('Ghi chú không được dài quá 300 ký tự.', 400, 'invalid_game_note')
  }
  if (!/^#[0-9A-F]{6}$/.test(textColor)) {
    throw new HttpError('Màu chữ phải là mã HEX dạng #RRGGBB.', 400, 'invalid_text_color')
  }

  const existing = await getExistingImage(gameKey)
  const { data, error } = await supabaseAdmin
    .from('game_mode_images')
    .upsert({
      game_key: gameKey,
      image_path: existing?.image_path || null,
      display_title: displayTitle,
      display_note: displayNote || null,
      text_color: textColor,
    }, { onConflict: 'game_key' })
    .select(IMAGE_ROW_FIELDS)
    .single()

  if (error || !data) {
    console.error('[game-image] Content save failed:', error?.message || error)
    throw new HttpError('Không thể lưu thiết lập trò chơi.', 503, 'game_image_database_error')
  }
  return publicImage(data)
}

export async function deleteGameModeImage(gameKey) {
  validateGameKey(gameKey)
  const existing = await getExistingImage(gameKey)
  if (!existing?.image_path) return { deleted: false }

  const { error } = await supabaseAdmin.from('game_mode_images').update({ image_path: null }).eq('game_key', gameKey)
  if (error) throw new HttpError('Không thể xóa ảnh Game Mode.', 503, 'game_image_database_error')

  const cleanupError = await removeStoragePath(existing.image_path)
  if (cleanupError) console.warn('[game-image] Could not remove deleted image:', cleanupError.message || cleanupError)
  return { deleted: true }
}
