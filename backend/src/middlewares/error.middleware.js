import { AppError } from '../services/auth.service.js'

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message })
  }

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Mỗi ảnh không được vượt quá 15MB.' })
  }
  if (err?.code === 'LIMIT_FILE_COUNT' || err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ message: 'Mỗi lượt chỉ được tải tối đa 20 ảnh.' })
  }

  console.error('[Unhandled Error]', err)
  return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Không tìm thấy endpoint.' })
}
