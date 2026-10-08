import express, { Router } from 'express'
import * as controller from '../controllers/gameModeImage.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireAdmin } from '../middlewares/admin.middleware.js'

const router = Router()
router.use(requireAuth, requireAdmin)
router.patch('/:gameKey', controller.saveContent)
router.put('/:gameKey', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], limit: '5mb' }), controller.upload)
router.delete('/:gameKey', controller.remove)

export default router
