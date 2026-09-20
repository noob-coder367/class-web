import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js'

// Các route auth chỉ đọc dữ liệu (cần token hợp lệ, không thể brute-force)
// nên không tính vào giới hạn chống brute-force login bên dưới.
const AUTH_READ_ONLY_PATHS = new Set(['/me', '/username-change-status', '/ghost-preview'])

function clientKey(req) {
  const auth = String(req.headers.authorization || '')
  if (auth.startsWith('Bearer ') && auth.length > 30) {
    return `u:${auth.slice(7, 87)}`
  }
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown')
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

function tooManyRequestsHandler(req, res, _next, options) {
  const retryAfter = res.getHeader('Retry-After')
  res.status(options.statusCode).json({
    message: 'Hệ thống đang đông, thử lại sau vài giây.',
    retryAfter: retryAfter ? Number(retryAfter) : undefined,
  })
}

const limiterBase = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: tooManyRequestsHandler,
  skip: (req) => req.method === 'OPTIONS',
  validate: {
    keyGeneratorIpFallback: false,
  },
}

export function createApp() {
  const app = express()

  // Render chỉ có 1 lớp proxy/load balancer phía trước container.
  // Cần khai báo để express-rate-limit (và req.ip nói chung) đọc đúng
  // IP thật của từng client từ header X-Forwarded-For, thay vì đọc
  // nhầm IP của proxy (khiến toàn bộ user bị tính chung 1 IP).
  app.set('trust proxy', 1)

  app.use(helmet())
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    })
  )
  // 15MB để nhận ảnh base64 (ảnh gốc tối đa 10MB) khi admin upload lên GitHub.
  app.use(express.json({ limit: '15mb' }))
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      skip: (req, res) =>
        res.statusCode < 400 && (req.path === '/api/health' || req.originalUrl === '/api/health'),
    })
  )

  // Giới hạn số request cho các route auth nhạy cảm (login/register/quên mật khẩu...)
  // để hạn chế brute-force / spam email xác nhận. Bỏ qua các route chỉ đọc profile
  // (vd /auth/me) vì chúng được gọi thường xuyên khi dùng web bình thường
  // (mỗi lần mở trang, refresh, đổi tab) và đã được bảo vệ bằng token qua
  // requireAuth, không phải mục tiêu brute-force.
  //
  // Cả lớp (~40+) hay dùng chung 1 IP WiFi trường — nới cửa sổ đủ cho
  // buổi học đồng loạt đăng nhập, vẫn chặn quét mật khẩu.
  const authLimiter = rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    limit: 250,
    skip: (req) => {
      if (req.method === 'OPTIONS') return true
      const path = req.path || ''
      return (
        AUTH_READ_ONLY_PATHS.has(path) ||
        path.endsWith('/me') ||
        path.endsWith('/username-change-status') ||
        path.endsWith('/ghost-preview')
      )
    },
  })
  app.use('/api/auth', authLimiter)

  // Limiter riêng, nới hơn nhiều, cho các route auth chỉ đọc kể trên.
  // Key theo token (mỗi học sinh một quota), fallback IP nếu chưa đăng nhập.
  const authReadLimiter = rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    limit: 600,
  })
  app.use('/api/auth/me', authReadLimiter)
  app.use('/api/auth/username-change-status', authReadLimiter)

  // Toàn bộ route /api/classroom đã bắt buộc requireAuth + requireMember
  // (xem classroom.routes.js) nên không phải bề mặt brute-force - nới hơn
  // để chịu được việc frontend polling định kỳ để cập nhật badge "thời
  // gian thực", kể cả khi nhiều học sinh dùng chung 1 IP (mạng trường).
  const classroomLimiter = rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    limit: 1200,
  })
  app.use('/api/classroom', classroomLimiter)

  const pushReceiptLimiter = rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    limit: 400,
  })
  app.use('/api/push/receipt', pushReceiptLimiter)

  app.use('/api', routes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
