import { apiClient } from './apiClient.js'
import { supabase } from '../lib/supabaseClient.js'

export async function listEvents() {
  const data = await apiClient.get('/events')
  return data.items || []
}

export async function uploadEventImages(files) {
  const list = Array.from(files || [])
  if (!list.length) return []
  const intent = await apiClient.post('/events/image-upload-urls', { files: list.map((file) => ({ mimeType: file.type || 'image/jpeg', sizeBytes: file.size })) }, { auth: true })
  const uploads = intent.uploads || []
  if (uploads.length !== list.length) throw new Error('Không tạo đủ liên kết tải ảnh.')
  const metadata = []
  for (let index = 0; index < list.length; index += 1) {
    const upload = uploads[index]
    const { error } = await supabase.storage.from(intent.bucket || 'event-images').uploadToSignedUrl(upload.path, upload.token, list[index], { contentType: upload.mimeType, upsert: false })
    if (error) throw new Error(error.message || 'Không tải được ảnh sự kiện lên Storage.')
    metadata.push({ path: upload.path, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes })
  }
  return metadata
}
export async function createEvent(payload) {
  return apiClient.post('/events', payload, { auth: true })
}

export async function deleteEvent(id) {
  return apiClient.delete(`/events/${encodeURIComponent(id)}`, { auth: true })
}

export async function updateEventExpiry(id, expires_at) {
  return apiClient.patch(
    `/events/${encodeURIComponent(id)}/expiry`,
    { expires_at },
    { auth: true }
  )
}
