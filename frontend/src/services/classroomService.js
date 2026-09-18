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

/** Ẩn thông báo thay đổi TKB. Ưu tiên POST để tránh host/proxy chặn DELETE. */
export async function dismissTimetableNotice() {
  try {
    return await apiClient.post('/classroom/timetable/notice/dismiss', {}, { auth: true })
  } catch (err) {
    if (err?.status === 404) {
      return apiClient.delete('/classroom/timetable/notice', { auth: true })
    }
    throw err
  }
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

export async function hideAnnouncement(id) {
  return apiClient.patch(
    `/classroom/announcements/${encodeURIComponent(id)}/hide`,
    {},
    { auth: true }
  )
}

export async function unhideAnnouncement(id) {
  return apiClient.patch(
    `/classroom/announcements/${encodeURIComponent(id)}/unhide`,
    {},
    { auth: true }
  )
}

export async function getAnnouncementsArchive(section) {
  const query = section ? `?section=${encodeURIComponent(section)}` : ''
  return apiClient.get(`/classroom/announcements/archive${query}`, { auth: true })
}

export async function getHomework() {
  return apiClient.get('/classroom/homework', { auth: true })
}

export async function createHomework(payload) {
  return apiClient.post('/classroom/homework', payload, { auth: true })
}

export async function deleteHomework(id) {
  return apiClient.delete(`/classroom/homework/${encodeURIComponent(id)}`, {
    auth: true,
  })
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

export async function getClassList() {
  return apiClient.get('/classroom/class-list', { auth: true })
}

export async function getLeaderboard() {
  return apiClient.get('/classroom/leaderboard', { auth: true })
}

// Mục "Lớp học" (bộ câu hỏi tự tạo) — lưu ở backend nên mọi máy/thành viên
// đăng nhập vào đều thấy chung một danh sách, không còn phụ thuộc localStorage.
export async function listClassSpace() {
  return apiClient.get('/classroom/class-space', { auth: true })
}

export async function getClassSpace(id, password) {
  const query = password ? `?password=${encodeURIComponent(password)}` : ''
  return apiClient.get(`/classroom/class-space/${encodeURIComponent(id)}${query}`, { auth: true })
}

export async function createClassSpace(payload) {
  return apiClient.post('/classroom/class-space', payload, { auth: true })
}

export async function updateClassSpace(id, payload) {
  return apiClient.put(`/classroom/class-space/${encodeURIComponent(id)}`, payload, { auth: true })
}

export async function uploadClassSpaceImage({ contentBase64, mimeType, filename }) {
  return apiClient.post(
    '/classroom/class-space/upload-image',
    { contentBase64, mimeType, filename },
    { auth: true }
  )
}

export async function getCleaningSchedule(weekStart) {
  const query = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : ''
  return apiClient.get(`/classroom/cleaning-duty/schedule${query}`, { auth: true })
}

export async function getCleaningSchedules(limit) {
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : ''
  return apiClient.get(`/classroom/cleaning-duty/schedules${query}`, { auth: true })
}

export async function saveCleaningSchedule(payload) {
  return apiClient.put('/classroom/cleaning-duty/schedule', payload, { auth: true })
}

export async function getCleaningStatus(weekStart) {
  const query = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : ''
  return apiClient.get(`/classroom/cleaning-duty/status${query}`, { auth: true })
}

export async function updateCleaningStatus(date, payload) {
  return apiClient.patch(
    `/classroom/cleaning-duty/status/${encodeURIComponent(date)}`,
    payload,
    { auth: true }
  )
}
