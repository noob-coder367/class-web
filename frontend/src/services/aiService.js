import { apiClient } from './apiClient.js'

const AI_TIMEOUT_MS = 90_000

/**
 * Gọi AI tạo câu hỏi (chỉ trả về bản xem trước, KHÔNG lưu DB).
 * - mode 'text': gửi JSON.
 * - mode 'file': gửi file thô (application/octet-stream), KHÔNG base64; tuỳ chọn nằm ở query string.
 */
export async function generateQuestions({ mode, text, file, count, types, difficulty }) {
  const common = { auth: true, retry: false, timeoutMs: AI_TIMEOUT_MS }
  if (mode === 'file') {
    const query = new URLSearchParams({ count: String(count), difficulty })
    if (types?.length) query.set('types', types.join(','))
    return apiClient.post(`/ai/generate-questions?${query}`, file, {
      ...common,
      rawBody: true,
      contentType: file.type?.startsWith('image/') ? file.type : 'application/octet-stream',
      headers: { 'X-File-Name': encodeURIComponent(file.name) },
    })
  }
  return apiClient.post('/ai/generate-questions', { text, count, types: types || undefined, difficulty }, common)
}
export async function ocrImage(file) {
  return apiClient.post('/ai/ocr-image', file, {
    auth: true,
    retry: false,
    rawBody: true,
    contentType: file.type || 'image/jpeg',
    timeoutMs: 60_000,
    headers: { 'X-File-Name': encodeURIComponent(file.name || 'image.jpg') },
  })
}
