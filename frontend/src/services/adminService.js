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
