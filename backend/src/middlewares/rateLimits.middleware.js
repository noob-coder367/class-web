import rateLimit from 'express-rate-limit'

function userKey(prefix) {
  // Đặt SAU requireAuth nên req.user.id đáng tin (không thể giả mạo để đốt quota người khác).
  return (req) => `${prefix}:${req.user?.id || 'anonymous'}`
}

function handler(message) {
  return (_req, res, _next, options) => {
    const retryAfter = res.getHeader('Retry-After')
    res.status(options.statusCode).json({ message, code: 'rate_limited', retryAfter: retryAfter ? Number(retryAfter) : undefined })
  }
}

const base = { standardHeaders: true, legacyHeaders: false, skip: (req) => req.method === 'OPTIONS' }

/** 12 lượt / 10 phút / user */
export const aiBurstLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  limit: 12,
  keyGenerator: userKey('ai-burst'),
  handler: handler('Bạn tạo câu hỏi bằng AI quá nhanh. Hãy đợi vài phút rồi thử lại.'),
})

/** 80 lượt / ngày / user */
export const aiDailyLimiter = rateLimit({
  ...base,
  windowMs: 24 * 60 * 60 * 1000,
  limit: 80,
  keyGenerator: userKey('ai-day'),
  handler: handler('Bạn đã dùng hết lượt tạo câu hỏi bằng AI hôm nay. Hãy quay lại vào ngày mai.'),
})

/** OCR cũng gọi dịch vụ bên ngoài: giới hạn riêng để không dùng chung quota tạo câu hỏi. */
export const ocrBurstLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: userKey('ocr-burst'),
  handler: handler('Bạn gửi yêu cầu OCR quá nhanh. Hãy đợi vài phút rồi thử lại.'),
})

/** 120 lượt OCR / ngày / user; đủ cho nhu cầu lớp học nhưng chặn lạm dụng kéo dài. */
export const ocrDailyLimiter = rateLimit({
  ...base,
  windowMs: 24 * 60 * 60 * 1000,
  limit: 120,
  keyGenerator: userKey('ocr-day'),
  handler: handler('Bạn đã dùng hết lượt OCR hôm nay. Hãy quay lại vào ngày mai.'),
})
