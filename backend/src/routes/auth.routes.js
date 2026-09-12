import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { validateBody } from '../middlewares/validate.middleware.js'

const router = Router()

router.post(
  '/register',
  validateBody({ username: 'string', email: 'string', password: 'string' }),
  authController.register
)

router.post(
  '/verify-otp',
  validateBody({ email: 'string', otp: 'string' }),
  authController.verifyOtp
)

router.post(
  '/resend-otp',
  validateBody({ email: 'string' }),
  authController.resendOtp
)

router.post(
  '/login',
  validateBody({ username: 'string', password: 'string' }),
  authController.login
)

router.post(
  '/forgot-password',
  validateBody({ username: 'string' }),
  authController.forgotPassword
)

router.post(
  '/reset-password',
  validateBody({ email: 'string', otp: 'string', newPassword: 'string' }),
  authController.resetPassword
)

router.get('/me', requireAuth, authController.me)

router.post(
  '/display-name',
  requireAuth,
  validateBody({ username: 'string' }),
  authController.setDisplayName
)

router.post(
  '/change-username',
  requireAuth,
  validateBody({ username: 'string' }),
  authController.changeUsername
)

router.get('/username-change-status', requireAuth, authController.usernameChangeStatus)

export default router
