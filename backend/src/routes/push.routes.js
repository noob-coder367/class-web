import { Router } from 'express'
import * as pushController from '../controllers/push.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireMember } from '../middlewares/member.middleware.js'

const router = Router()

router.get('/vapid-public-key', pushController.getVapidPublicKey)

router.post('/subscribe', requireAuth, requireMember, pushController.subscribe)
router.post('/unsubscribe', requireAuth, requireMember, pushController.unsubscribe)

export default router
