import { supabase } from '../lib/supabaseClient.js'
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

export async function uploadAnnouncementImages(files) {
  const list = Array.from(files || [])
  if (!list.length) return []
  const intent = await apiClient.post('/classroom/announcements/upload-urls', {
    files: list.map((file) => ({ mimeType: file.type || 'image/jpeg', sizeBytes: file.size })),
  }, { auth: true })
  const uploads = intent.uploads || []
  if (uploads.length !== list.length) throw new Error('Không tạo đủ liên kết tải ảnh.')
  const metadata = []
  for (let index = 0; index < list.length; index += 1) {
    const upload = uploads[index]
    const { error } = await supabase.storage.from(intent.bucket || 'announcement-images')
      .uploadToSignedUrl(upload.path, upload.token, list[index], { contentType: upload.mimeType, upsert: false })
    if (error) throw new Error(error.message || 'Không tải được ảnh lên Storage.')
    metadata.push({ path: upload.path, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes })
  }
  return metadata
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

export async function uploadViolationPhotos(files) {
  const list = Array.from(files || [])
  if (!list.length) return []
  const intent = await apiClient.post('/classroom/violations/photo-upload-urls', { files: list.map((file) => ({ mimeType: file.type || 'image/jpeg', sizeBytes: file.size })) }, { auth: true })
  const uploads = intent.uploads || []
  if (uploads.length !== list.length) throw new Error('Không tạo đủ liên kết tải ảnh bằng chứng.')
  const metadata = []
  for (let index = 0; index < list.length; index += 1) {
    const upload = uploads[index]
    const { error } = await supabase.storage.from(intent.bucket).uploadToSignedUrl(upload.path, upload.token, list[index], { contentType: upload.mimeType, upsert: false })
    if (error) throw new Error(error.message || 'Không tải được ảnh bằng chứng lên Storage.')
    metadata.push({ path: upload.path, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes, filename: list[index].name })
  }
  return metadata
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
export async function listClassSpace({ page = 1, pageSize = 100 } = {}) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiClient.get(`/classroom/class-space?${query}`, { auth: true })
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

export async function getOrgChart() {
  return apiClient.get('/classroom/org-chart', { auth: true })
}

export async function saveOrgChart(nodes) {
  return apiClient.put('/classroom/org-chart', { nodes }, { auth: true })
}

export async function getMemberProfile() {
  return apiClient.get('/classroom/member-profile', { auth: true })
}

export async function saveMemberProfile(payload) {
  return apiClient.put('/classroom/member-profile', payload, { auth: true })
}

export async function getFeedback() {
  return apiClient.get('/classroom/feedback', { auth: true })
}

export async function createFeedback({ content, parentId }) {
  return apiClient.post('/classroom/feedback', { content, parentId: parentId || null }, { auth: true })
}

export async function toggleFeedbackLike(id) {
  return apiClient.post(`/classroom/feedback/${encodeURIComponent(id)}/like`, {}, { auth: true })
}

export async function deleteFeedback(id) {
  return apiClient.delete(`/classroom/feedback/${encodeURIComponent(id)}`, { auth: true })
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
  const blob = await fetch(contentBase64).then((response) => response.blob())
  const intent = await apiClient.post('/classroom/class-space/upload-image', { mimeType, filename, sizeBytes: blob.size }, { auth: true })
  const { error } = await supabase.storage.from(intent.bucket).uploadToSignedUrl(intent.path, intent.token, blob, { contentType: intent.mimeType, upsert: false })
  if (error) throw new Error(error.message || 'Không tải được ảnh lớp học lên Storage.')
  return apiClient.post('/classroom/class-space/upload-image/complete', { path: intent.path, mimeType: intent.mimeType, sizeBytes: intent.sizeBytes }, { auth: true })
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

export async function getCleaningPhotos({ weekStart, dutyDate, dayId }) {
  const query = new URLSearchParams({ week_start: weekStart, duty_date: dutyDate, day_id: dayId })
  return apiClient.get(`/classroom/cleaning-duty/photos?${query.toString()}`, { auth: true })
}

export async function uploadCleaningPhotos({ weekStart, dutyDate, dayId, files }) {
  if (!Array.isArray(files) || !files.length) throw new Error('Chưa chọn ảnh trực nhật.')
  if (files.length > 20) throw new Error('Mỗi lượt chỉ được tải tối đa 20 ảnh.')
  const tooLarge = files.find((file) => Number(file.size) > 25 * 1024 * 1024)
  if (tooLarge) throw new Error(`Ảnh "${tooLarge.name || 'không tên'}" vượt quá giới hạn 25MB.`)
  const manifest = files.map((file) => ({ name: file.name || 'cleaning-photo.jpg', mimeType: file.type || '', size: file.size }))
  const intent = await apiClient.post('/classroom/cleaning-duty/photos', {
    week_start: weekStart, duty_date: dutyDate, day_id: dayId, photos: manifest,
  }, { auth: true, retry: false })
  try {
    for (let index = 0; index < intent.files.length; index += 1) {
      const target = intent.files[index]
      const original = files[index]
      const { error } = await supabase.storage.from('classroom-data').uploadToSignedUrl(
        target.path, target.token, original, { contentType: target.mimeType, upsert: false }
      )
      if (error) throw new Error(`Không tải được ảnh "${target.name}" lên Storage.`)
    }
    return await apiClient.post('/classroom/cleaning-duty/photos/complete', { intent_id: intent.intent_id }, { auth: true, retry: false })
  } catch (error) {
    await apiClient.delete(`/classroom/cleaning-duty/photos/intents/${encodeURIComponent(intent.intent_id)}`, { auth: true, retry: false }).catch(() => {})
    throw error
  }
}
export async function deleteCleaningPhoto(id) {
  return apiClient.delete(`/classroom/cleaning-duty/photos/${encodeURIComponent(id)}`, { auth: true })
}

export async function getCleaningReview({ weekStart, dutyDate, dayId }) {
  const query = new URLSearchParams({ week_start: weekStart, duty_date: dutyDate, day_id: dayId })
  return apiClient.get(`/classroom/cleaning-duty/review?${query.toString()}`, { auth: true })
}

export async function saveCleaningReview({ weekStart, dutyDate, dayId, rating, comment }) {
  return apiClient.put('/classroom/cleaning-duty/review', { week_start: weekStart, duty_date: dutyDate, day_id: dayId, rating, comment }, { auth: true })
}

// ---- Bài tập về nhà → Nộp bài ----------------------------------------------
export async function getHomeworkAssignments() {
  return apiClient.get('/classroom/homework-assignments', { auth: true })
}

export async function createHomeworkAssignment(payload) {
  return apiClient.post('/classroom/homework-assignments', payload, { auth: true })
}

export async function deleteHomeworkAssignment(id) {
  return apiClient.delete(`/classroom/homework-assignments/${encodeURIComponent(id)}`, { auth: true })
}

export async function getHomeworkAssignmentStatus(id) {
  return apiClient.get(`/classroom/homework-assignments/${encodeURIComponent(id)}/status`, { auth: true })
}

export async function getHomeworkSubmissionDetail(id, userId) {
  return apiClient.get(
    `/classroom/homework-assignments/${encodeURIComponent(id)}/submissions/${encodeURIComponent(userId)}`,
    { auth: true }
  )
}

export async function getHomeworkGradingResult(submissionId) {
  return apiClient.get(
    `/classroom/homework-assignments/submissions/${encodeURIComponent(submissionId)}/grading`,
    { auth: true, retry: false }
  )
}

export async function submitHomeworkAssignment(id, fileList) {
  const files = Array.from(fileList || [])
  if (!files.length) throw new Error('Chưa chọn ảnh hoặc file để nộp.')
  if (files.length > 10) throw new Error('Mỗi lần nộp tối đa 10 file.')
  const tooLarge = files.find((file) => Number(file.size) > 20 * 1024 * 1024)
  if (tooLarge) throw new Error(`File "${tooLarge.name || 'không tên'}" vượt quá giới hạn 20MB.`)
  const manifest = files.map((file) => ({ name: file.name || 'file', size: file.size, mime: file.type || '' }))
  const intent = await apiClient.post(
    `/classroom/homework-assignments/${encodeURIComponent(id)}/submit`,
    { files: manifest }, { auth: true, retry: false }
  )
  try {
    for (let index = 0; index < files.length; index += 1) {
      const target = intent.files[index]
      const { error } = await supabase.storage.from('classroom-data').uploadToSignedUrl(
        target.path, target.token, files[index], { contentType: target.mime, upsert: false }
      )
      if (error) throw new Error(`Không tải được file "${files[index].name || 'file'}" lên Storage.`)
    }
    return await apiClient.post(
      `/classroom/homework-assignments/${encodeURIComponent(id)}/submit/complete`,
      { intent_id: intent.intent_id }, { auth: true, retry: false }
    )
  } catch (error) {
    await apiClient.delete(
      `/classroom/homework-assignments/${encodeURIComponent(id)}/submit/intents/${encodeURIComponent(intent.intent_id)}`,
      { auth: true, retry: false }
    ).catch(() => {})
    throw error
  }
}


// ---- Bài tập về nhà → Kiểm tra / Quản lý lớp → Kiểm tra ----------------------
const EXAM_MAX_IMAGE = 10 * 1024 * 1024
const EXAM_MAX_PDF = 30 * 1024 * 1024
const EXAM_MAX_TOTAL = 50 * 1024 * 1024
const examUrl = (id, tail = '') => `/classroom/exams/${encodeURIComponent(id)}${tail}`

export async function getExams() {
  return apiClient.get('/classroom/exams', { auth: true })
}

export async function getExam(id) {
  return apiClient.get(examUrl(id), { auth: true })
}

export async function startExam(id) {
  return apiClient.post(examUrl(id, '/start'), {}, { auth: true, retry: false })
}

export async function deleteExam(id) {
  return apiClient.delete(examUrl(id), { auth: true })
}

export async function getExamStatus(id) {
  return apiClient.get(examUrl(id, '/status'), { auth: true })
}

export async function getExamSubmissionDetail(id, userId) {
  return apiClient.get(examUrl(id, `/submissions/${encodeURIComponent(userId)}`), { auth: true })
}

export async function getExamGradingResult(submissionId) {
  return apiClient.get(
    `/classroom/exams/submissions/${encodeURIComponent(submissionId)}/grading`,
    { auth: true, retry: false }
  )
}

export async function createExam(payload, imageFiles = []) {
  const files = Array.from(imageFiles || [])
  let images = []
  if (files.length) {
    const intent = await apiClient.post('/classroom/exams/image-upload-urls', {
      files: files.map((f) => ({ name: f.name, size: f.size })),
    }, { auth: true, retry: false })
    const uploads = intent.uploads || []
    if (uploads.length !== files.length) throw new Error('Không tạo đủ liên kết tải ảnh đề.')
    for (let i = 0; i < files.length; i += 1) {
      const up = uploads[i]
      const { error } = await supabase.storage.from(intent.bucket).uploadToSignedUrl(
        up.path, up.token, files[i], { contentType: up.mime, upsert: false })
      if (error) throw new Error(`Không tải được ảnh "${files[i].name}" lên Storage.`)
      images.push({ path: up.path, name: up.name, size: up.size })
    }
  }
  return apiClient.post('/classroom/exams', { ...payload, images }, { auth: true, retry: false })
}

export async function submitExam(id, fileList, onProgress) {
  const files = Array.from(fileList || [])
  if (!files.length) throw new Error('Chưa chọn ảnh hoặc file để nộp.')
  let total = 0
  for (const file of files) {
    const isPdf = /\.pdf$/i.test(file.name || '')
    if (file.size > (isPdf ? EXAM_MAX_PDF : EXAM_MAX_IMAGE)) {
      throw new Error(`File "${file.name || 'không tên'}" vượt quá ${isPdf ? '30MB (PDF)' : '10MB (ảnh)'}.`)
    }
    total += file.size
  }
  if (total > EXAM_MAX_TOTAL) throw new Error('Tổng dung lượng bài nộp vượt quá 50MB.')
  const intent = await apiClient.post(examUrl(id, '/submit'),
    { files: files.map((f) => ({ name: f.name || 'file', size: f.size })) }, { auth: true, retry: false })
  try {
    for (let i = 0; i < files.length; i += 1) {
      const target = intent.files[i]
      const { error } = await supabase.storage.from('classroom-data').uploadToSignedUrl(
        target.path, target.token, files[i], { contentType: target.mime, upsert: false })
      if (error) throw new Error(`Không tải được file "${files[i].name || 'file'}" lên Storage.`)
      onProgress?.(i + 1, files.length)
    }
    return await apiClient.post(examUrl(id, '/submit/complete'), { intent_id: intent.intent_id }, { auth: true, retry: false })
  } catch (error) {
    await apiClient.delete(examUrl(id, `/submit/intents/${encodeURIComponent(intent.intent_id)}`), { auth: true, retry: false }).catch(() => {})
    throw error
  }
}
