import { supabase } from '../lib/supabaseClient.js'
import { apiClient } from './apiClient.js'

const BUCKET = 'game-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_GALLERY_IMAGES = 8
const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
})

function publicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

function toPublicImage(row) {
  if (!row) return null
  const galleryPaths = Array.isArray(row.gallery_paths) ? row.gallery_paths : []
  return {
    ...row,
    gallery_paths: galleryPaths,
    image_url: row.image_path ? publicUrl(row.image_path) : null,
    gallery: galleryPaths.map((path) => ({ path, url: publicUrl(path) })),
  }
}

function assertImageFile(file) {
  if (!MIME_EXTENSIONS[file?.type]) throw new Error('Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.')
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Ảnh phải có dung lượng từ 1 byte đến 5 MB.')
}

export async function listGameModeImages(gameKeys) {
  const keys = [...new Set((gameKeys || []).filter(Boolean))]
  if (!keys.length) return []

  const { data, error } = await supabase
    .from('game_mode_images')
    .select('game_key, image_path, display_title, display_note, overlay_content, detail_description, gallery_paths, text_color, updated_at')
    .in('game_key', keys)
    .limit(Math.min(keys.length, 100))

  if (error) throw error
  return (data || []).map(toPublicImage)
}

export async function uploadGameModeImage(gameKey, file) {
  assertImageFile(file)
  const result = await apiClient.put(
    `/admin/game-mode-images/${encodeURIComponent(gameKey)}`,
    file,
    { auth: true, rawBody: true, contentType: file.type, timeoutMs: 60_000 },
  )
  return toPublicImage(result.image)
}

export async function saveGameModeContent(gameKey, content) {
  const result = await apiClient.patch(`/admin/game-mode-images/${encodeURIComponent(gameKey)}`, content, { auth: true })
  return toPublicImage(result.image)
}

export async function deleteGameModeImage(gameKey) {
  await apiClient.delete(`/admin/game-mode-images/${encodeURIComponent(gameKey)}`, { auth: true })
}

export async function uploadGameGalleryImage(gameKey, file) {
  assertImageFile(file)
  const result = await apiClient.put(
    `/admin/game-mode-images/${encodeURIComponent(gameKey)}/gallery`,
    file,
    { auth: true, rawBody: true, contentType: file.type, timeoutMs: 60_000 },
  )
  return toPublicImage(result.image)
}

export async function deleteGameGalleryImage(gameKey, path) {
  const result = await apiClient.delete(
    `/admin/game-mode-images/${encodeURIComponent(gameKey)}/gallery?path=${encodeURIComponent(path)}`,
    { auth: true },
  )
  return toPublicImage(result.image)
}
