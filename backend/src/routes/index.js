import { Router } from 'express'
import authRoutes from './auth.routes.js'
import quizRoutes from './quiz.routes.js'
import aiRoutes from './ai.routes.js'
import adminAccountRoutes from './adminAccount.routes.js'

const router = Router()

router.get('/health', (_req, res) => res.json({ status: 'ok' }))
router.use('/auth', authRoutes)
router.use('/quizzes', quizRoutes)
router.use('/ai', aiRoutes)
router.use('/admin/accounts', adminAccountRoutes)

export default router
