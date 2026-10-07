import { Router } from 'express'
import * as quizController from '../controllers/quiz.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireGoogle } from '../middlewares/googleOnly.middleware.js'

const router = Router()

router.use(requireAuth)
// Cho mọi tài khoản đã đăng nhập: chỉ trả quyền (không có dữ liệu nhạy cảm).
router.get('/access', quizController.access)

// Mọi thao tác còn lại: chỉ phiên Google + chỉ dữ liệu của chính chủ (kiểm tra trong service).
router.use(requireGoogle)
router.get('/', quizController.list)
router.post('/', quizController.create)
router.get('/:id', quizController.get)
router.put('/:id', quizController.update)
router.delete('/:id', quizController.remove)

export default router
