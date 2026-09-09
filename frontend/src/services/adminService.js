import { apiClient } from './apiClient.js'

export async function getUsers() {
  const data = await apiClient.get('/admin/users', { auth: true })
  return data.users
}

export async function toggleMember(userId, currentStatus) {
  return apiClient.patch(
    `/admin/users/${userId}/member`,
    { currentStatus },
    { auth: true }
  )
}

export async function toggleRole(userId, currentRole) {
  return apiClient.patch(
    `/admin/users/${userId}/role`,
    { currentRole },
    { auth: true }
  )
}

export async function deleteUser(userId) {
  return apiClient.delete(`/admin/users/${userId}`, { auth: true })
}

export async function getPublicSiteImages() {
  return apiClient.get('/images')
}

export async function getSiteImages() {
  return apiClient.get('/admin/images', { auth: true })
}

export async function uploadSiteImage(payload) {
  return apiClient.post('/admin/images', payload, { auth: true })
}

export async function deleteSiteImage(path) {
  return apiClient.delete('/admin/images', { auth: true, body: { path } })
}
