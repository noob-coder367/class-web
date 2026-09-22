import { AppError } from '../services/auth.service.js'

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    const body = { message: err.message }
    if (err.code) body.code = err.code
    return res.status(err.statusCode).json(body)
  }

  console.error('[Unhandled Error]', err)
  return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Không tìm thấy endpoint.' })
}
