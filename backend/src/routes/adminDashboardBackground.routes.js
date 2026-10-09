import express, { Router } from 'express'
import * as controller from '../controllers/adminDashboardBackground.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireAdmin } from '../middlewares/admin.middleware.js'

const router = Router()
router.use(requireAuth, requireAdmin)
router.get('/', controller.get)
router.put('/', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], limit: '5mb' }), controller.upload)
router.delete('/', controller.remove)
export default router
