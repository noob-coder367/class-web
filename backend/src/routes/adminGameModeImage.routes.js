import express, { Router } from 'express'
import * as controller from '../controllers/gameModeImage.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireAdmin } from '../middlewares/admin.middleware.js'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const router = Router()
router.use(requireAuth, requireAdmin)
router.patch('/:gameKey', controller.saveContent)
router.put('/:gameKey', express.raw({ type: IMAGE_TYPES, limit: '5mb' }), controller.upload)
router.delete('/:gameKey', controller.remove)
router.put('/:gameKey/gallery', express.raw({ type: IMAGE_TYPES, limit: '5mb' }), controller.uploadGallery)
router.delete('/:gameKey/gallery', controller.removeGallery)

export default router
