import { AppError } from '../services/auth.service.js'

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.quota ? { quota: err.quota } : {}),
    })
  }

  if (err?.code === 'LIMIT_FILE_SIZE' || err?.type === 'entity.too.large') {
    const isCleaningUpload = req.originalUrl.split('?')[0].endsWith('/api/classroom/cleaning-duty/photos')
    return res.status(413).json({ error: 'FILE_TOO_LARGE', message: isCleaningUpload ? 'Ảnh hoặc tổng dữ liệu upload vượt quá giới hạn 25MB/ảnh.' : 'Dữ liệu upload quá lớn.' })
  }
  if (err?.code === 'LIMIT_FILE_COUNT' || err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'TOO_MANY_FILES', message: 'Mỗi lượt chỉ được tải tối đa 20 ảnh.' })
  }

  console.error('[Unhandled Error]', err)
  return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Không tìm thấy endpoint.' })
}
