import { apiClient } from './apiClient.js'

export async function checkAccess() {
  return apiClient.get('/classroom/access', { auth: true })
}

export async function getTabContent(tab) {
  return apiClient.get(`/classroom/tabs/${encodeURIComponent(tab)}`, {
    auth: true,
  })
}

export async function getTimetable() {
  return apiClient.get('/classroom/timetable', { auth: true })
}

export async function saveTimetable(timetable) {
  return apiClient.put('/classroom/timetable', { timetable }, { auth: true })
}

export async function dismissTimetableNotice() {
  return apiClient.delete('/classroom/timetable/notice', { auth: true })
}

export async function getAnnouncements() {
  return apiClient.get('/classroom/announcements', { auth: true })
}

export async function createAnnouncement(payload) {
  return apiClient.post('/classroom/announcements', payload, { auth: true })
}

export async function deleteAnnouncement(id) {
  return apiClient.delete(`/classroom/announcements/${encodeURIComponent(id)}`, {
    auth: true,
  })
}

export async function updateAnnouncementExpiry(id, expires_at) {
  return apiClient.patch(
    `/classroom/announcements/${encodeURIComponent(id)}/expiry`,
    { expires_at },
    { auth: true }
  )
}

export async function getRules() {
  return apiClient.get('/classroom/rules', { auth: true })
}

export async function saveRules(rules) {
  return apiClient.put('/classroom/rules', { rules }, { auth: true })
}

export async function getViolations() {
  return apiClient.get('/classroom/violations', { auth: true })
}

export async function addViolation(violation) {
  return apiClient.post('/classroom/violations', { violation }, { auth: true })
}

export async function deleteViolation(id) {
  return apiClient.delete(`/classroom/violations/${encodeURIComponent(id)}`, {
    auth: true,
  })
}

export async function getMembers() {
  return apiClient.get('/classroom/members', { auth: true })
}

export async function getDirectory() {
  return apiClient.get('/classroom/directory', { auth: true })
}

export async function getLeaderboard() {
  return apiClient.get('/classroom/leaderboard', { auth: true })
}
