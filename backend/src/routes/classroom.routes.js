import { Router } from 'express'
import * as classroomController from '../controllers/classroom.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireMember } from '../middlewares/member.middleware.js'
import { requireAdmin } from '../middlewares/admin.middleware.js'

const router = Router()

// Mọi route: phải đăng nhập + là thành viên 10A4 (hoặc admin).
router.use(requireAuth, requireMember)

router.get('/access', classroomController.getAccess)
router.get('/tabs', classroomController.getTabs)
router.get('/tabs/:tab', classroomController.getTab)
router.get('/timetable', classroomController.getTimetable)
router.put('/timetable', requireAdmin, classroomController.putTimetable)
router.get('/rules', classroomController.getRules)
router.put('/rules', requireAdmin, classroomController.putRules)
router.get('/violations', classroomController.getViolations)
router.post('/violations', requireAdmin, classroomController.postViolation)
router.delete('/violations/:id', requireAdmin, classroomController.deleteViolation)
router.get('/members', classroomController.getMembers)
router.get('/directory', requireAdmin, classroomController.getDirectory)
router.get('/leaderboard', classroomController.getLeaderboard)

export default router
