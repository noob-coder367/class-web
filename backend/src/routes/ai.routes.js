import express, { Router } from 'express'
import * as aiController from '../controllers/ai.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireGoogle } from '../middlewares/googleOnly.middleware.js'
import { aiBurstLimiter, aiDailyLimiter, ocrBurstLimiter, ocrDailyLimiter } from '../middlewares/rateLimits.middleware.js'
import { FILE_LIMITS } from '../services/files/extractText.js'

const router = Router()

router.post(
  '/generate-questions',
  requireAuth,
  requireGoogle,
  aiBurstLimiter,
  aiDailyLimiter,
    express.raw({ type: ['application/octet-stream', 'image/*'], limit: FILE_LIMITS.MAX_BYTES }),
    aiController.generate,
)
router.post('/ocr-image', requireAuth, requireGoogle, ocrBurstLimiter, ocrDailyLimiter, express.raw({ type: 'image/*', limit: FILE_LIMITS.MAX_BYTES }), aiController.ocrImage)

export default router
