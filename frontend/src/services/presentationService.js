import { apiClient } from './apiClient.js'

export async function listPresentations() {
  return apiClient.get('/presentations', { auth: true })
}

export async function getPresentation(id, password = '') {
  const query = password ? `?password=${encodeURIComponent(password)}` : ''
  return apiClient.get(`/presentations/${encodeURIComponent(id)}${query}`, { auth: true })
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
