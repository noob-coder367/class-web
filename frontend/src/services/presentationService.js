import { apiClient } from './apiClient.js'

export async function listPresentations() {
  return apiClient.get('/presentations', { auth: true })
}

export async function getPresentation(id, password = '') {
  if (password) {
    return apiClient.post(`/presentations/${encodeURIComponent(id)}/unlock`, { password }, { auth: true })
  }
  return apiClient.get(`/presentations/${encodeURIComponent(id)}`, { auth: true })
}

export async function createPresentation(payload) {
  return apiClient.post('/presentations', payload, { auth: true })
}

export async function updatePresentation(id, payload) {
  return apiClient.put(`/presentations/${encodeURIComponent(id)}`, payload, { auth: true })
}

export async function deletePresentation(id) {
  return apiClient.delete(`/presentations/${encodeURIComponent(id)}`, { auth: true })
}
