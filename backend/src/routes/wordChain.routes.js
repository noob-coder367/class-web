import { Router } from 'express'
import { requireRoomIdentity } from '../middlewares/auth.middleware.js'
import rateLimit from 'express-rate-limit'
import * as controller from '../controllers/wordChain.controller.js'

const router = Router()
// Chế độ 1 máy không cần đăng nhập, nên endpoint phân tích nguồn mở công khai nhưng giới hạn theo IP (vì có gọi AI).
const ipKey = (req) => String(req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '')
const limit = (windowMs, max) => rateLimit({ windowMs, limit: max, standardHeaders: true, legacyHeaders: false, keyGenerator: ipKey, skip: (req) => req.method === 'OPTIONS', handler: (_req, res) => res.status(429).json({ message: 'Bạn phân tích nguồn quá nhanh. Hãy đợi vài phút rồi thử lại.', code: 'rate_limited' }) })
router.post('/source', limit(10 * 60 * 1000, 15), limit(24 * 60 * 60 * 1000, 150), controller.source)
router.get('/rooms/open', controller.open)
router.use(requireRoomIdentity)
router.post('/rooms', controller.create)
router.get('/rooms/:code', controller.get)
router.post('/rooms/:code/join', controller.join)
router.post('/rooms/:code/close', controller.close)
router.post('/rooms/:code/start', controller.start)
router.post('/rooms/:code/answer', controller.answer)
router.post('/rooms/:code/skip', controller.skip)
// Hết 60 giây: lấy đáp án gợi ý của hệ thống (máy chủ tự kiểm tra đã hết giờ).
router.post('/rooms/:code/reveal', controller.reveal)
export default router
