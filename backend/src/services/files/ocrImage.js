import { HttpError } from '../../lib/httpError.js'
const ENDPOINT = 'https://api.ocr.space/parse/image'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'])
export async function extractTextFromImage({ buffer, filename = 'image.jpg', contentType = 'image/jpeg', apiKey, fetchImpl = fetch }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new HttpError('Không nhận được ảnh.', 400, 'image_empty')
  if (buffer.length > MAX_IMAGE_BYTES) throw new HttpError('Ảnh quá lớn (tối đa 8 MB).', 413, 'file_too_large')
  if (!IMAGE_TYPES.has(contentType)) throw new HttpError('Định dạng ảnh không được hỗ trợ.', 415, 'unsupported_file')
  if (!apiKey) throw new HttpError('OCR chưa được cấu hình trên máy chủ.', 503, 'ocr_not_configured')
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: contentType }), filename)
  form.append('language', 'auto')
  form.append('isOverlayRequired', 'false')
  form.append('OCREngine', '2')
  let response
  try { response = await fetchImpl(ENDPOINT, { method: 'POST', headers: { apikey: apiKey }, body: form }) } catch { throw new HttpError('Không kết nối được dịch vụ OCR. Vui lòng thử lại.', 503, 'ocr_unavailable') }
  if (!response.ok) throw new HttpError('Dịch vụ OCR tạm thời không khả dụng.', 503, 'ocr_unavailable')
  let payload
  try { payload = await response.json() } catch { throw new HttpError('OCR trả về dữ liệu không hợp lệ.', 502, 'ocr_invalid_output') }
  const text = (payload?.ParsedResults || []).map((item) => item?.ParsedText || '').join('\n').replace(/\u0000/g, '').trim()
  if (payload?.IsErroredOnProcessing || !text) throw new HttpError('Không đọc được nội dung trong ảnh. Hãy thử ảnh rõ hơn.', 422, 'ocr_empty')
  return { text, provider: 'ocr.space' }
}
