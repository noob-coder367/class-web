import { apiClient } from './apiClient.js'

export async function getAdminDashboardBackground() {
  const result = await apiClient.get('/admin/dashboard-background', { auth: true })
  return result.background || null
}

export async function uploadAdminDashboardBackground(file) {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  if (!allowed.has(file?.type)) throw new Error('Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.')
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Ảnh phải có dung lượng từ 1 byte đến 5 MB.')
  const result = await apiClient.put('/admin/dashboard-background', file, {
    auth: true,
    rawBody: true,
    contentType: file.type,
    timeoutMs: 60_000,
  })
  return result.background
}

export async function deleteAdminDashboardBackground() {
  return apiClient.delete('/admin/dashboard-background', { auth: true })
}
