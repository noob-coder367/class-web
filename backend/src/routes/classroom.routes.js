import express, { Router } from 'express'
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
router.put('/timetable', requireCapability('timetable'), classroomController.putTimetable)
router.delete('/timetable/notice', requireCapability('timetable'), classroomController.dismissTimetableNotice)
// POST fallback — một số proxy/host chặn DELETE
router.post('/timetable/notice/dismiss', requireCapability('timetable'), classroomController.dismissTimetableNotice)

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
router.get('/cleaning-duty/photos', classroomController.listCleaningPhotos)
router.post(
  '/cleaning-duty/photos',
  requireCapability('cleaningDuty'),
  express.json({ limit: '700mb' }),
  classroomController.uploadCleaningPhotos
)
router.delete(
  '/cleaning-duty/photos/:id',
  requireCapability('cleaningDuty'),
  classroomController.deleteCleaningPhoto
)
router.get('/cleaning-duty/review', classroomController.getCleaningReview)
router.put('/cleaning-duty/review', classroomController.putCleaningReview)

router.get('/members', classroomController.getMembers)
router.get('/directory', requireCapability('directory'), classroomController.getDirectory)
router.get('/class-list', classroomController.getClassList)
router.get('/leaderboard', classroomController.getLeaderboard)

// Mục "Lớp học" (bộ câu hỏi tự tạo) — dùng chung cho mọi thiết bị/thành viên.
router.get('/class-space', classroomController.listClassSpace)
router.get('/class-space/creators', classroomController.listClassSpaceCreators)
router.get('/class-space/next-code', classroomController.getNextClassSpaceCode)
router.get('/utility-roster', classroomController.getUtilityRoster)
router.put('/utility-roster', classroomController.updateUtilityRoster)
router.get('/class-space/by-code/:code', classroomController.getClassSpaceByCode)
router.get('/class-space/:id', classroomController.getClassSpaceById)
router.post('/class-space', classroomController.createClassSpace)
router.put('/class-space/:id', classroomController.updateClassSpace)
router.patch('/class-space/:id/password', classroomController.updateClassSpacePassword)
router.delete('/class-space/:id', classroomController.deleteClassSpace)
router.post('/class-space/:id/start', classroomController.startClassSpaceAttempt)
router.post('/class-space/:id/result', classroomController.submitClassSpaceResult)
router.get('/class-space/:id/leaderboard', classroomController.getClassSpaceLeaderboard)
router.post('/class-space/upload-image', classroomController.uploadClassSpaceImage)

export default router
