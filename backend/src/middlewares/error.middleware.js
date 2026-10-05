import { AppError } from '../services/auth.service.js'

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.quota ? { quota: err.quota } : {}),
    })
  }

  if (err?.code === 'VERSION_CONFLICT' || err?.status === 409) {
    return res.status(409).json({ message: 'Dữ liệu vừa thay đổi. Vui lòng tải lại rồi thử lại.' })
  }
  if (err?.status === 503 || err?.code === 'PERMISSION_DENIED' || err?.code === 'MISSING_TABLE' || String(err?.code || '').endsWith('_ERROR')) {
    console.error('[Persistence Error]', {
      status: err.status,
      code: err.code,
      key: err.key,
      operation: err.operation,
      table: err.table,
    })
    return res.status(503).json({ message: 'Dịch vụ dữ liệu hiện không khả dụng. Vui lòng thử lại sau.' })
  }

  if (err?.code === 'LIMIT_FILE_SIZE' || err?.type === 'entity.too.large') {
    const isCleaningUpload = req.originalUrl.split('?')[0].endsWith('/api/classroom/cleaning-duty/photos')
    const isResourceUpload = req.originalUrl.includes('/api/resources/') && req.originalUrl.endsWith('/files')
    return res.status(413).json({ error: 'FILE_TOO_LARGE', message: isCleaningUpload ? 'Ảnh hoặc tổng dữ liệu upload vượt quá giới hạn 25MB/ảnh.' : isResourceUpload ? 'File vượt quá giới hạn 50MB.' : 'Dữ liệu upload quá lớn.' })
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
