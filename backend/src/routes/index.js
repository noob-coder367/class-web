import { Router } from 'express'
import authRoutes from './auth.routes.js'
import aiRoutes from './ai.routes.js'

const router = Router()

router.get('/health', (_req, res) => res.json({ status: 'ok' }))
router.use('/auth', authRoutes)
router.use('/ai', aiRoutes)

export default router
