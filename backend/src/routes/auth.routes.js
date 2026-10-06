import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { validateBody } from '../middlewares/validate.middleware.js'

const router = Router()

router.post('/register', validateBody({ displayName: 'string', email: 'string', password: 'string' }), authController.register)
router.post('/login', validateBody({ email: 'string', password: 'string' }), authController.login)
router.get('/me', requireAuth, authController.me)

export default router
