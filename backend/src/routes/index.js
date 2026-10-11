import { Router } from 'express'
import authRoutes from './auth.routes.js'
import quizRoutes from './quiz.routes.js'
import aiRoutes from './ai.routes.js'
import adminAccountRoutes from './adminAccount.routes.js'
import adminGameModeImageRoutes from './adminGameModeImage.routes.js'
import gameRoomRoutes from './gameRoom.routes.js'
import wordChainRoutes from './wordChain.routes.js'
import adminContentRoutes from './adminContent.routes.js'
import adminDashboardBackgroundRoutes from './adminDashboardBackground.routes.js'
import classMoneyRoutes from './classMoney.routes.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireAdmin } from '../middlewares/admin.middleware.js'

const router = Router()

router.get('/health', (_req, res) => res.json({ status: 'ok' }))
router.use('/auth', authRoutes)
router.use('/quizzes', quizRoutes)
router.use('/ai', aiRoutes)
router.use('/admin/accounts', adminAccountRoutes)
router.use('/admin/game-mode-images', adminGameModeImageRoutes)
router.use('/admin/dashboard-background', adminDashboardBackgroundRoutes)
router.use('/admin', adminContentRoutes)
router.use('/game-rooms', gameRoomRoutes)
router.use('/word-chain', wordChainRoutes)
// Legacy class-money APIs are private to administrators only.
router.use('/classroom/money', requireAuth, requireAdmin, classMoneyRoutes)

export default router
