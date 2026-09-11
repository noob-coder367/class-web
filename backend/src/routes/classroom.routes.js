import { Router } from 'express'
import * as classroomController from '../controllers/classroom.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireMember } from '../middlewares/member.middleware.js'

const router = Router()

// Mọi route: phải đăng nhập + là thành viên 10A4 (hoặc admin).
router.use(requireAuth, requireMember)

router.get('/access', classroomController.getAccess)
router.get('/tabs', classroomController.getTabs)
router.get('/tabs/:tab', classroomController.getTab)

export default router
