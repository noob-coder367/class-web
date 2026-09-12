import { apiClient } from './apiClient.js'

export async function listEvents() {
  const data = await apiClient.get('/events')
  return data.items || []
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
