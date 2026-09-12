import { Router } from 'express'
import authRoutes from './auth.routes.js'
import adminRoutes from './admin.routes.js'
import imagesRoutes from './images.routes.js'
import classroomRoutes from './classroom.routes.js'
import pushRoutes from './push.routes.js'
import eventsRoutes from './events.routes.js'

const router = Router()

router.get('/health', (req, res) => res.json({ status: 'ok' }))
router.use('/auth', authRoutes)
router.use('/images', imagesRoutes)
router.use('/admin', adminRoutes)
router.use('/classroom', classroomRoutes)
router.use('/push', pushRoutes)
router.use('/events', eventsRoutes)

export default router
