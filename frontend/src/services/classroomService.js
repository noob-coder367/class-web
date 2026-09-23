import { apiClient } from './apiClient.js'

const GET_CACHE_TTL_MS = 5_000
const getCache = new Map()

function cachedGet(key, loader) {
  const now = Date.now()
  const hit = getCache.get(key)
  if (hit && (hit.promise || hit.expiresAt > now)) return hit.promise || Promise.resolve(hit.value)

  const promise = loader()
    .then((value) => {
      getCache.set(key, { value, expiresAt: Date.now() + GET_CACHE_TTL_MS })
      return value
    })
    .finally(() => {
      const current = getCache.get(key)
      if (current?.promise === promise) getCache.delete(key)
    })
  getCache.set(key, { promise })
  return promise
}

function invalidate(...keys) {
  keys.forEach((key) => getCache.delete(key))
}

export function clearClassroomCache() {
  getCache.clear()
}

export async function checkAccess() {
  return apiClient.get('/classroom/access', { auth: true })
}

export async function getTabContent(tab) {
  return apiClient.get(`/classroom/tabs/${encodeURIComponent(tab)}`, {
    auth: true,
  })
}

export async function getTimetable() {
  return cachedGet('timetable', () => apiClient.get('/classroom/timetable', { auth: true }))
}

export async function saveTimetable(timetable) {
  const result = await apiClient.put('/classroom/timetable', { timetable }, { auth: true })
  invalidate('timetable')
  return result
}

/** Ẩn thông báo thay đổi TKB. Ưu tiên POST để tránh host/proxy chặn DELETE. */
export async function dismissTimetableNotice() {
  try {
    const result = await apiClient.post('/classroom/timetable/notice/dismiss', {}, { auth: true })
    invalidate('timetable')
    return result
  } catch (err) {
    if (err?.status === 404) {
      const result = await apiClient.delete('/classroom/timetable/notice', { auth: true })
      invalidate('timetable')
      return result
    }
    throw err
  }
}

export async function getAnnouncements() {
  return cachedGet('announcements', () => apiClient.get('/classroom/announcements', { auth: true }))
}

export async function createAnnouncement(payload) {
  const result = await apiClient.post('/classroom/announcements', payload, { auth: true })
  invalidate('announcements')
  return result
}

export async function deleteAnnouncement(id) {
  const result = await apiClient.delete(`/classroom/announcements/${encodeURIComponent(id)}`, {
    auth: true,
  })
  invalidate('announcements')
  return result
}

export async function updateAnnouncementExpiry(id, expires_at) {
  const result = await apiClient.patch(
    `/classroom/announcements/${encodeURIComponent(id)}/expiry`,
    { expires_at },
    { auth: true }
  )
  invalidate('announcements')
  return result
}

export async function hideAnnouncement(id) {
  const result = await apiClient.patch(
    `/classroom/announcements/${encodeURIComponent(id)}/hide`,
    {},
    { auth: true }
  )
  invalidate('announcements')
  return result
}

export async function unhideAnnouncement(id) {
  const result = await apiClient.patch(
    `/classroom/announcements/${encodeURIComponent(id)}/unhide`,
    {},
    { auth: true }
  )
  invalidate('announcements')
  return result
}

export async function getAnnouncementsArchive(section) {
  const query = section ? `?section=${encodeURIComponent(section)}` : ''
  return apiClient.get(`/classroom/announcements/archive${query}`, { auth: true })
}

export async function getHomework() {
  return cachedGet('homework', () => apiClient.get('/classroom/homework', { auth: true }))
}

export async function createHomework(payload) {
  const result = await apiClient.post('/classroom/homework', payload, { auth: true })
  invalidate('homework', 'announcements')
  return result
}

export async function deleteHomework(id) {
  const result = await apiClient.delete(`/classroom/homework/${encodeURIComponent(id)}`, {
    auth: true,
  })
  invalidate('homework', 'announcements')
  return result
}

export async function getRules() {
  return cachedGet('rules', () => apiClient.get('/classroom/rules', { auth: true }))
}

export async function saveRules(rules) {
  const result = await apiClient.put('/classroom/rules', { rules }, { auth: true })
  invalidate('rules')
  return result
}

export async function getViolations() {
  return cachedGet('violations', () => apiClient.get('/classroom/violations', { auth: true }))
}

export async function addViolation(violation) {
  const result = await apiClient.post('/classroom/violations', { violation }, { auth: true })
  invalidate('violations')
  return result
}

export async function deleteViolation(id) {
  const result = await apiClient.delete(`/classroom/violations/${encodeURIComponent(id)}`, {
    auth: true,
  })
  invalidate('violations')
  return result
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

// Bộ lọc phòng — danh sách tài khoản đã từng tạo phòng (chỉ ownerId/ownerName,
// không kèm thông tin phòng nào) để đổ vào dropdown "Được tạo bởi".
export async function getClassSpaceCreators() {
  return apiClient.get('/classroom/class-space/creators', { auth: true })
}

export async function getUtilityRoster() {
  return apiClient.get('/classroom/utility-roster', { auth: true })
}

export async function saveUtilityRoster(roster) {
  return apiClient.put('/classroom/utility-roster', roster, { auth: true })
}

export async function getClassSpace(id, password) {
  const query = password ? `?password=${encodeURIComponent(password)}` : ''
  return apiClient.get(`/classroom/class-space/${encodeURIComponent(id)}${query}`, { auth: true })
}

// Mã phòng 6 số — xem trước mã sẽ được cấp khi tạo phòng mới (mã thật do
// server sinh và khoá lại ngay lúc tạo, xem createClassSpace).
export async function getNextClassSpaceCode() {
  return apiClient.get('/classroom/class-space/next-code', { auth: true })
}

// Tra cứu phòng theo mã 6 số — dùng cho ô "Vào bằng mã phòng" ở đầu trang,
// hoạt động với mọi phòng (công khai/riêng tư, đang hiện hay đang ẩn trong lớp).
export async function getClassSpaceByCode(code) {
  return apiClient.get(`/classroom/class-space/by-code/${encodeURIComponent(code)}`, { auth: true })
}

export async function createClassSpace(payload) {
  return apiClient.post('/classroom/class-space', payload, { auth: true })
}

export async function updateClassSpace(id, payload) {
  return apiClient.put(`/classroom/class-space/${encodeURIComponent(id)}`, payload, { auth: true })
}

// Đổi riêng mật khẩu 6 số của phòng riêng tư (nút Lưu cạnh ô mật khẩu ở màn
// hình chỉnh sửa phòng) — chỉ chủ phòng, không đụng tới các cài đặt khác.
export async function updateClassSpacePassword(id, password) {
  return apiClient.patch(
    `/classroom/class-space/${encodeURIComponent(id)}/password`,
    { password },
    { auth: true }
  )
}

export async function deleteClassSpace(id) {
  return apiClient.delete(`/classroom/class-space/${encodeURIComponent(id)}`, { auth: true })
}

export async function startClassSpaceAttempt(id) {
  return apiClient.post(`/classroom/class-space/${encodeURIComponent(id)}/start`, {}, { auth: true })
}

export async function submitClassSpaceResult(id, payload) {
  return apiClient.post(`/classroom/class-space/${encodeURIComponent(id)}/result`, payload, { auth: true })
}

export async function getClassSpaceLeaderboard(id) {
  return apiClient.get(`/classroom/class-space/${encodeURIComponent(id)}/leaderboard`, { auth: true })
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
