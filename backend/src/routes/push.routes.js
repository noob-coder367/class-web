import { Router } from 'express'
import * as pushController from '../controllers/push.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/vapid-public-key', pushController.getVapidPublicKey)

// Mọi user đã đăng nhập đều bật/tắt Web Push được — không bắt buộc thành viên 10A4
router.post('/subscribe', requireAuth, pushController.subscribe)
router.post('/unsubscribe', requireAuth, pushController.unsubscribe)

export default router
