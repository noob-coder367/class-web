import { apiClient } from './apiClient.js'

export async function listAccounts() {
  const data = await apiClient.get('/admin/accounts', { auth: true })
  return data.accounts || []
}

export async function updateGhostDisplayName(id, displayName) {
  return apiClient.patch(`/admin/accounts/${encodeURIComponent(id)}/display-name`, { displayName }, { auth: true })
}

export async function deleteGhostAccount(id) {
  return apiClient.delete(`/admin/accounts/${encodeURIComponent(id)}`, { auth: true })
}
