import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireMember } from '../middlewares/member.middleware.js'
import * as aiController from '../controllers/ai.controller.js'
import * as aiHistoryController from '../controllers/ai-history.controller.js'

const router = Router()

router.use(requireAuth, requireMember)
router.get('/quota', aiHistoryController.quota)
router.get('/conversations', aiHistoryController.listConversations)
router.post('/conversations', aiHistoryController.createConversation)
router.get('/conversations/:id', aiHistoryController.getConversation)
router.delete('/conversations/:id', aiHistoryController.deleteConversation)
router.post('/chat', aiController.chat)

export default router
