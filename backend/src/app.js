import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js'

// Các route auth chỉ đọc dữ liệu (cần token hợp lệ, không thể brute-force)
// nên không tính vào giới hạn chống brute-force login/OTP bên dưới.
const AUTH_READ_ONLY_PATHS = new Set(['/me', '/username-change-status'])

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
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  // Giới hạn số request cho các route auth nhạy cảm (login/register/OTP...)
  // để hạn chế brute-force / spam OTP. Bỏ qua các route chỉ đọc profile
  // (vd /auth/me) vì chúng được gọi thường xuyên khi dùng web bình thường
  // (mỗi lần mở trang, refresh, đổi tab) và đã được bảo vệ bằng token qua
  // requireAuth, không phải mục tiêu brute-force.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => AUTH_READ_ONLY_PATHS.has(req.path),
  })
  app.use('/api/auth', authLimiter)

  // Limiter riêng, nới hơn nhiều, cho các route auth chỉ đọc kể trên -
  // để tránh bị chặn oan khi nhiều học sinh cùng dùng chung 1 mạng/IP.
  const authReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use('/api/auth/me', authReadLimiter)
  app.use('/api/auth/username-change-status', authReadLimiter)

  // Toàn bộ route /api/classroom đã bắt buộc requireAuth + requireMember
  // (xem classroom.routes.js) nên không phải bề mặt brute-force - nới hơn
  // để chịu được việc frontend polling định kỳ để cập nhật badge "thời
  // gian thực", kể cả khi nhiều học sinh dùng chung 1 IP (mạng trường).
  const classroomLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use('/api/classroom', classroomLimiter)

  app.use('/api', routes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
