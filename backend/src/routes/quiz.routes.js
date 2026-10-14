import { Router } from 'express'
import * as quizController from '../controllers/quiz.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireGoogle } from '../middlewares/googleOnly.middleware.js'

const router = Router()
router.get('/public', quizController.listPublic)
router.get('/room-catalog', (req, res, next) => {
  if (String(req.headers.authorization || '').startsWith('Bearer ')) {
    return requireAuth(req, res, () => quizController.list(req, res, next))
  }
  return quizController.listPublic(req, res, next)
})
router.use(requireAuth)
// Cho mọi tài khoản đã đăng nhập: chỉ trả quyền (không có dữ liệu nhạy cảm).
router.get('/access', quizController.access)

// Danh mục chỉ chứa metadata quiz của chủ và quiz công khai; mọi tài khoản đăng nhập đều có thể xem.
router.get('/', quizController.list)

// Tạo/sửa/xóa và đọc toàn bộ câu hỏi: chỉ phiên Google + chỉ dữ liệu của chính chủ.
router.use(requireGoogle)
router.post('/', quizController.create)
router.get('/:id', quizController.get)
router.put('/:id', quizController.update)
router.delete('/:id', quizController.remove)

export default router
