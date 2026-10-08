import { AppError } from '../services/auth.service.js'
import { HttpError } from '../lib/httpError.js'

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    })
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message, ...(err.code ? { code: err.code } : {}) })
  }

  // Lỗi của body-parser (JSON hỏng, body quá lớn)
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Dữ liệu tải lên vượt quá giới hạn dung lượng cho phép.', code: 'payload_too_large' })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Dữ liệu gửi lên không hợp lệ.', code: 'bad_request' })
  }

  console.error('[Unhandled Error]', err)
  return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Không tìm thấy endpoint.' })
}
