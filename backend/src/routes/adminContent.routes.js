import { Router } from 'express'
import * as controller from '../controllers/adminContent.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireAdmin } from '../middlewares/admin.middleware.js'
const router = Router()
router.use(requireAuth, requireAdmin)
router.get('/game-rooms', controller.rooms)
router.patch('/game-rooms/:id', controller.updateRoom)
router.delete('/game-rooms/:id', controller.deleteRoom)
router.get('/quizzes', controller.quizzes)
router.get('/quizzes/:id/questions', controller.questions)
router.patch('/questions/:id', controller.updateQuestion)
router.delete('/questions/:id', controller.deleteQuestion)
export default router
