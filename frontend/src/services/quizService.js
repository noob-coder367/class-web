import { apiClient } from './apiClient.js'

/** Hỏi backend xem phiên hiện tại có được tạo phòng không (backend tự suy ra provider từ session). */
export const fetchAccess = () => apiClient.get('/quizzes/access', { auth: true })

export async function fetchQuiz(id) {
  const { quiz } = await apiClient.get(`/quizzes/${id}`, { auth: true })
  return quiz
}

/** Lưu (upsert) cả phòng + câu hỏi. Idempotent theo id nên bấm lưu nhiều lần không tạo bản sao. */
export async function saveQuiz(id, payload) {
  const { quiz } = await apiClient.put(`/quizzes/${id}`, payload, { auth: true, retry: false, timeoutMs: 30_000 })
  return quiz
}

/** Chuyển lỗi API thành thông báo thân thiện, không lộ chi tiết kỹ thuật. */
export function describeApiError(error, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  if (!error) return fallback
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (error.code === 'google_required') return 'Tính năng này yêu cầu đăng nhập bằng Google.'
  if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (error.code === 'timeout') return 'AI timeout: máy chủ phản hồi quá lâu. Vui lòng thử lại.'
  return error.message || fallback
}
