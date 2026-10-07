import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js'

const AUTH_READ_ONLY_PATHS = new Set(['/me'])

function clientKey(req) {
  const auth = String(req.headers.authorization || '')
  if (auth.startsWith('Bearer ') && auth.length > 30) return `u:${auth.slice(7, 87)}`
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown')
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

function ipKey(req) {
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown')
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

function tooManyRequestsHandler(_req, res, _next, options) {
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
}

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }))
  // Quiz tối đa 100 câu và text AI tối đa 30.000 ký tự nên 2 MB là dư; file upload dùng parser riêng (8 MB).
  app.use(express.json({ limit: '2mb' }))
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    skip: (req, res) => res.statusCode < 400 && (req.path === '/api/health' || req.originalUrl === '/api/health'),
  }))

  app.use('/api/auth', rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    limit: 250,
    skip: (req) => req.method === 'OPTIONS' || AUTH_READ_ONLY_PATHS.has(req.path) || req.path.endsWith('/me'),
  }))
  app.use('/api/auth/me', rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, limit: 600 }))
  // Chặn flood theo IP trước khi tốn lượt xác thực Supabase; quota theo user nằm trong ai.routes.
  app.use('/api/ai', rateLimit({ ...limiterBase, keyGenerator: ipKey, windowMs: 15 * 60 * 1000, limit: 120 }))
  app.use('/api/quizzes', rateLimit({ ...limiterBase, keyGenerator: ipKey, windowMs: 15 * 60 * 1000, limit: 600 }))
  app.use('/api', routes)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
