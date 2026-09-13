import { Router } from 'express'
import * as classroomController from '../controllers/classroom.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireMember } from '../middlewares/member.middleware.js'
import {
  requireAdmin,
  requireAnnouncementAction,
  requireCapability,
} from '../middlewares/admin.middleware.js'

const router = Router()

// Mọi route: phải đăng nhập + là thành viên 10A4 (hoặc cán sự).
router.use(requireAuth, requireMember)

router.get('/access', classroomController.getAccess)
router.get('/tabs', classroomController.getTabs)
router.get('/tabs/:tab', classroomController.getTab)
router.get('/timetable', classroomController.getTimetable)
router.put('/timetable', requireAdmin, classroomController.putTimetable)
router.delete('/timetable/notice', requireAdmin, classroomController.dismissTimetableNotice)
// POST fallback — một số proxy/host chặn DELETE
router.post('/timetable/notice/dismiss', requireAdmin, classroomController.dismissTimetableNotice)

router.get('/announcements', classroomController.listAnnouncements)
router.get(
  '/announcements/archive',
  requireAnnouncementAction('archive'),
  classroomController.listAnnouncementsArchive
)
router.post(
  '/announcements',
  requireAnnouncementAction('create'),
  classroomController.createAnnouncement
)
router.delete(
  '/announcements/:id',
  requireAnnouncementAction('delete'),
  classroomController.deleteAnnouncement
)
router.patch(
  '/announcements/:id/expiry',
  requireAnnouncementAction('expiry'),
  classroomController.updateAnnouncementExpiry
)
router.patch(
  '/announcements/:id/hide',
  requireAnnouncementAction('hide'),
  classroomController.hideAnnouncement
)
router.patch(
  '/announcements/:id/unhide',
  requireAnnouncementAction('unhide'),
  classroomController.unhideAnnouncement
)

router.get('/homework', classroomController.listHomework)
router.post('/homework', requireCapability('homework'), classroomController.createHomework)
router.delete('/homework/:id', requireCapability('homework'), classroomController.deleteHomework)

router.get('/rules', classroomController.getRules)
router.put('/rules', requireCapability('rules'), classroomController.putRules)
router.get('/violations', classroomController.getViolations)
router.post('/violations', requireCapability('rules'), classroomController.postViolation)
router.delete('/violations/:id', requireCapability('rules'), classroomController.deleteViolation)
router.get('/cleaning-duty/schedule', classroomController.getCleaningSchedule)
router.get('/cleaning-duty/schedules', classroomController.listCleaningSchedules)
router.put(
  '/cleaning-duty/schedule',
  requireCapability('cleaningDuty'),
  classroomController.putCleaningSchedule
)
router.get('/cleaning-duty/status', classroomController.getCleaningStatus)
router.patch(
  '/cleaning-duty/status/:date',
  requireCapability('cleaningDuty'),
  classroomController.patchCleaningStatus
)

router.get('/members', classroomController.getMembers)
router.get('/directory', requireCapability('directory'), classroomController.getDirectory)
router.get('/leaderboard', classroomController.getLeaderboard)

export default router
