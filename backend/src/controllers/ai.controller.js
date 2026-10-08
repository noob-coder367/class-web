import path from 'node:path'
import { env } from '../config/env.js'
import { HttpError } from '../lib/httpError.js'
import { getAIProvider } from '../services/ai/aiProvider.js'
import { generateQuestions, normalizeGenerateOptions } from '../services/ai/aiQuestion.service.js'
import { extractTextFromFile } from '../services/files/extractText.js'
import { extractTextFromImage } from '../services/files/ocrImage.js'

// Mỗi user chỉ có 1 yêu cầu AI đang chạy tại một thời điểm.
const inflight = new Set()

function readFileName(req) {
  try {
    const name = path.basename(decodeURIComponent(String(req.headers['x-file-name'] || '')))
    if (name && name.length <= 255) return name
  } catch { /* fall through */ }
  throw new HttpError('Thiếu hoặc sai tên file.', 400, 'validation_error')
}

/**
 * POST /api/ai/generate-questions
 *  - application/json: { text, count?, types?, difficulty? }
 *  - application/octet-stream: file thô (PDF/DOCX/TXT/IMAGE) + header X-File-Name, tuỳ chọn ở query string
 * Chỉ trả JSON để xem trước. TUYỆT ĐỐI không ghi DB ở đây.
 */
export async function generate(req, res, next) {
  const userId = req.user.id
  if (inflight.has(userId)) {
    return next(new HttpError('Bạn đang có một yêu cầu AI đang xử lý. Hãy đợi hoàn tất.', 429, 'ai_busy'))
  }
  inflight.add(userId)
  try {
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    let sourceText
    let optionsInput
    let truncate = false
    let kind = 'text'

    // Kiểm tra rẻ trước (tuỳ chọn, cấu hình provider) rồi mới tốn công đọc file.
    if (contentType === 'application/json') {
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      if (typeof body.text !== 'string') throw new HttpError('Vui lòng nhập nội dung hoặc chủ đề.', 400, 'validation_error')
      sourceText = body.text
      optionsInput = body
    } else if (contentType === 'application/octet-stream' || contentType.startsWith('image/')) {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError('Không nhận được file.', 400, 'validation_error')
      optionsInput = req.query
    } else {
      throw new HttpError('Định dạng yêu cầu không được hỗ trợ.', 415, 'unsupported_media_type')
    }

    normalizeGenerateOptions(optionsInput)
    const provider = getAIProvider(env)

    if (contentType === 'application/octet-stream') {
      const filename = readFileName(req)
      const extracted = await extractTextFromFile({ buffer: req.body, filename })
      req.body = null // giải phóng Buffer sớm
      sourceText = extracted.text
      truncate = true
      kind = extracted.kind
    } else if (contentType.startsWith('image/')) {
      const extracted = await extractTextFromImage({ buffer: req.body, filename: readFileName(req), contentType, apiKey: env.OCR_SPACE_API_KEY })
      req.body = null
      sourceText = extracted.text
      truncate = true
      kind = 'image'
    }

    const result = await generateQuestions({ sourceText, options: optionsInput, provider, truncate })
    res.json({ ...result, source: { kind } })
  } catch (error) {
    next(error)
  } finally {
    inflight.delete(userId)
  }
}

export async function ocrImage(req, res, next) {
  try {
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    const result = await extractTextFromImage({ buffer: req.body, filename: readFileName(req), contentType, apiKey: env.OCR_SPACE_API_KEY })
    res.json(result)
  } catch (error) { next(error) }
}
