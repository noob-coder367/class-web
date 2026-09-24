import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { createHash } from 'node:crypto'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireMember } from '../middlewares/member.middleware.js'
import * as aiController from '../controllers/ai.controller.js'

const router = Router()

const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) return `u:${req.user.id}`
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown')
    return `ip:${createHash('sha256').update(ip).digest('hex')}`
  },
  handler: (_req, res) => {
    res.status(429).json({
      message: 'Bạn đã dùng hết 20 lượt hỏi AI trong hôm nay. Vui lòng thử lại vào ngày mai.',
    })
  },
})

router.use(requireAuth, requireMember, dailyLimiter)
router.post('/chat', aiController.chat)

export default router
