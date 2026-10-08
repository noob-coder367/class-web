import { supabase } from '../lib/supabaseClient.js'
import { apiClient } from './apiClient.js'

const BUCKET = 'game-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
})

function toPublicImage(row) {
  if (!row?.image_path) return null
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(row.image_path)
  return { ...row, image_url: data.publicUrl }
}

export async function listGameModeImages(gameKeys) {
  const keys = [...new Set((gameKeys || []).filter(Boolean))]
  if (!keys.length) return []

  const { data, error } = await supabase
    .from('game_mode_images')
    .select('game_key, image_path, updated_at')
    .in('game_key', keys)
    .limit(Math.min(keys.length, 100))

  if (error) throw error
  return (data || []).map(toPublicImage)
}

export async function uploadGameModeImage(gameKey, file) {
  if (!MIME_EXTENSIONS[file?.type]) {
    throw new Error('Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.')
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ảnh phải có dung lượng từ 1 byte đến 5 MB.')
  }

  const result = await apiClient.put(
    `/admin/game-mode-images/${encodeURIComponent(gameKey)}`,
    file,
    { auth: true, rawBody: true, contentType: file.type, timeoutMs: 60_000 },
  )
  return toPublicImage(result.image)
}

export async function deleteGameModeImage(gameKey) {
  await apiClient.delete(`/admin/game-mode-images/${encodeURIComponent(gameKey)}`, { auth: true })
}
