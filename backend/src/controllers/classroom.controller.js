import * as classroomService from '../services/classroom.service.js'
import * as timetableService from '../services/timetable.service.js'
import * as rulesService from '../services/rules.service.js'
import * as announcementsService from '../services/announcements.service.js'
import * as homeworkService from '../services/homework.service.js'
import * as cleaningDutyService from '../services/cleaningDuty.service.js'
import * as classRosterService from '../services/classRoster.service.js'
import * as classSpaceService from '../services/classSpace.service.js'
import { capabilitiesFor, normalizeRole } from '../lib/roles.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

export async function getAccess(req, res, next) {
  try {
    noStore(res)
    const role = normalizeRole(req.profile?.role)
    res.json({
      ok: true,
      is_member: req.profile?.is_member === true,
      role,
      capabilities: capabilitiesFor(role),
    })
  } catch (err) {
    next(err)
  }
}

export async function getTabs(req, res, next) {
  try {
    noStore(res)
    res.json({ tabs: classroomService.listTabs() })
  } catch (err) {
    next(err)
  }
}

export async function getTab(req, res, next) {
  try {
    noStore(res)
    const data = await classroomService.getTabContent(req.params.tab)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

export async function getTimetable(req, res, next) {
  try {
    noStore(res)
    const timetable = await timetableService.getTimetable()
    res.json({ timetable })
  } catch (err) {
    next(err)
  }
}

export async function putTimetable(req, res, next) {
  try {
    noStore(res)
    const timetable = await timetableService.saveTimetable(req.body?.timetable || req.body)
    res.json({ message: 'Đã lưu thời khoá biểu.', timetable })
  } catch (err) {
    next(err)
  }
}

export async function dismissTimetableNotice(req, res, next) {
  try {
    noStore(res)
    const timetable = await timetableService.dismissChangeNotice()
    res.json({ message: 'Đã ẩn thông báo thay đổi TKB.', timetable })
  } catch (err) {
    next(err)
  }
}

export async function listAnnouncements(req, res, next) {
  try {
    noStore(res)
    const items = await announcementsService.listAnnouncements(req.query)
    res.json({ items, pagination: items.pagination })
  } catch (err) {
    next(err)
  }
}

export async function listAnnouncementsArchive(req, res, next) {
  try {
    noStore(res)
    const items = await announcementsService.listArchive(req.query?.section, req.query)
    res.json({ items, pagination: items.pagination })
  } catch (err) {
    next(err)
  }
}

export async function createAnnouncementImageUploadUrls(req, res, next) {
  try {
    noStore(res)
    res.json(await announcementsService.createAnnouncementImageUploadUrls(req.body?.files))
  } catch (err) { next(err) }
}

export async function createAnnouncement(req, res, next) {
  try {
    noStore(res)
    const body = { ...(req.body || {}) }
    if (req.announcementSection) body.section = req.announcementSection
    const item = await announcementsService.createAnnouncement(body, req.profile)
    res.status(201).json({ message: 'Đã đăng thông báo.', item })
  } catch (err) {
    next(err)
  }
}

export async function deleteAnnouncement(req, res, next) {
  try {
    noStore(res)
    const result = await announcementsService.deleteAnnouncement(req.params.id)
    res.json({ message: 'Đã xoá thông báo.', ...result })
  } catch (err) {
    next(err)
  }
}

export async function hideAnnouncement(req, res, next) {
  try {
    noStore(res)
    const item = await announcementsService.hideAnnouncement(req.params.id, req.profile)
    res.json({ message: 'Đã ẩn thông báo.', item })
  } catch (err) {
    next(err)
  }
}

export async function unhideAnnouncement(req, res, next) {
  try {
    noStore(res)
    const item = await announcementsService.unhideAnnouncement(req.params.id)
    res.json({ message: 'Đã bỏ ẩn thông báo.', item })
  } catch (err) {
    next(err)
  }
}

export async function updateAnnouncementExpiry(req, res, next) {
  try {
    noStore(res)
    const item = await announcementsService.updateAnnouncementExpiry(
      req.params.id,
      req.body?.expires_at ?? null
    )
    res.json({ message: 'Đã cập nhật thời gian tự xóa.', item })
  } catch (err) {
    next(err)
  }
}

export async function listHomework(req, res, next) {
  try {
    noStore(res)
    const data = await homeworkService.listHomeworkPage(req.query)
    res.json({ items: data.items, pagination: data.pagination })
  } catch (err) {
    next(err)
  }
}

export async function createHomework(req, res, next) {
  try {
    noStore(res)
    const item = await homeworkService.createHomework(req.body || {}, req.profile)
    res.status(201).json({ message: 'Đã đăng báo bài.', item })
  } catch (err) {
    next(err)
  }
}

export async function deleteHomework(req, res, next) {
  try {
    noStore(res)
    const result = await homeworkService.deleteHomework(req.params.id)
    res.json({ message: 'Đã xoá báo bài.', ...result })
  } catch (err) {
    next(err)
  }
}

export async function getRules(req, res, next) {
  try {
    noStore(res)
    const rules = await rulesService.getRules()
    res.json({ rules })
  } catch (err) {
    next(err)
  }
}

export async function putRules(req, res, next) {
  try {
    noStore(res)
    const rules = await rulesService.saveRules(req.body?.rules || req.body)
    res.json({ message: 'Đã lưu nội quy.', rules })
  } catch (err) {
    next(err)
  }
}

export async function getViolations(req, res, next) {
  try {
    noStore(res)
    const data = await rulesService.getViolations(req.query)
    res.json({ violations: data.items, updatedAt: data.updatedAt, pagination: data.pagination })
  } catch (err) {
    next(err)
  }
}

export async function createViolationPhotoUploadUrls(req, res, next) {
  try { noStore(res); res.json(await rulesService.createViolationPhotoUploadUrls(req.body?.files)) } catch (err) { next(err) }
}
export async function postViolation(req, res, next) {
  try {
    noStore(res)
    const violation = await rulesService.addViolation(req.body?.violation || req.body)
    res.status(201).json({ message: 'Đã thêm vi phạm.', violation })
  } catch (err) {
    next(err)
  }
}

export async function deleteViolation(req, res, next) {
  try {
    noStore(res)
    const result = await rulesService.removeViolation(req.params.id)
    res.json({ message: 'Đã xoá vi phạm.', ...result })
  } catch (err) {
    next(err)
  }
}

export async function getMembers(req, res, next) {
  try {
    noStore(res)
    const members = await classroomService.listClassMembers({ membersOnly: true })
    res.json({ members })
  } catch (err) {
    next(err)
  }
}

export async function getDirectory(req, res, next) {
  try {
    noStore(res)
    const members = await classroomService.listClassMembers({ membersOnly: false })
    res.json({ members })
  } catch (err) {
    next(err)
  }
}

export async function getClassList(req, res, next) {
  try {
    noStore(res)
    const items = await classRosterService.listClassRoster()
    res.json({ items })
  } catch (err) {
    next(err)
  }
}

export async function getCleaningSchedule(req, res, next) {
  try {
    noStore(res)
    const schedule = await cleaningDutyService.getSchedule(req.query?.week_start)
    res.json({ schedule })
  } catch (err) {
    next(err)
  }
}

export async function listCleaningSchedules(req, res, next) {
  try {
    noStore(res)
    const schedules = await cleaningDutyService.listSchedules(req.query?.limit)
    res.json({ schedules })
  } catch (err) {
    next(err)
  }
}

export async function putCleaningSchedule(req, res, next) {
  try {
    noStore(res)
    const schedule = await cleaningDutyService.saveSchedule(req.body || {}, req.profile)
    res.json({ message: 'Đã lưu lịch trực vệ sinh.', schedule })
  } catch (err) {
    next(err)
  }
}

export async function getCleaningStatus(req, res, next) {
  try {
    noStore(res)
    const status = await cleaningDutyService.getWeekStatus(req.query?.week_start)
    res.json(status)
  } catch (err) {
    next(err)
  }
}

export async function patchCleaningStatus(req, res, next) {
  try {
    noStore(res)
    const item = await cleaningDutyService.updateDayStatus(
      req.params.date,
      req.body || {},
      req.profile
    )
    res.json({ message: 'Đã cập nhật trạng thái vệ sinh.', item })
  } catch (err) {
    next(err)
  }
}

export async function listCleaningPhotos(req, res, next) {
  try {
    noStore(res)
    res.json(await cleaningDutyService.listDutyPhotos(req.query?.week_start, req.query?.duty_date, req.query?.day_id))
  } catch (err) { next(err) }
}

export async function uploadCleaningPhotos(req, res, next) {
  try {
    noStore(res)
    res.status(201).json(await cleaningDutyService.createDutyPhotoUploadIntent({
      weekStart: req.body?.week_start,
      dutyDate: req.body?.duty_date,
      dayId: req.body?.day_id,
      photos: req.body?.photos,
    }, req.profile))
  } catch (err) { next(err) }
}

export async function completeCleaningPhotoUpload(req, res, next) {
  try {
    noStore(res)
    res.status(201).json(await cleaningDutyService.completeDutyPhotoUpload(req.body?.intent_id, req.profile))
  } catch (err) { next(err) }
}

export async function cancelCleaningPhotoUpload(req, res, next) {
  try {
    noStore(res)
    res.json(await cleaningDutyService.cancelDutyPhotoUpload(req.params.intentId, req.profile))
  } catch (err) { next(err) }
}

export async function deleteCleaningPhoto(req, res, next) {
  try {
    noStore(res)
    res.json(await cleaningDutyService.deleteDutyPhoto(req.params.id))
  } catch (err) { next(err) }
}

export async function getCleaningReview(req, res, next) {
  try {
    noStore(res)
    res.json(await cleaningDutyService.getDutyReview(req.query?.week_start, req.query?.duty_date, req.query?.day_id, req.profile))
  } catch (err) { next(err) }
}

export async function putCleaningReview(req, res, next) {
  try {
    noStore(res)
    res.json(await cleaningDutyService.saveDutyReview(req.body?.week_start, req.body?.duty_date, req.body?.day_id, req.body || {}, req.profile))
  } catch (err) { next(err) }
}

export async function getLeaderboard(req, res, next) {
  try {
    noStore(res)
    const [members, rules] = await Promise.all([
      classRosterService.listClassRoster(),
      rulesService.getRules(),
    ])
    const leaderboard = await rulesService.buildLeaderboardFromDatabase(members, rules)
    res.json({ leaderboard, members })
  } catch (err) {
    next(err)
  }
}

export async function listClassSpace(req, res, next) {
  try {
    noStore(res)
    const items = await classSpaceService.listClassSpace(req.profile, req.query)
    res.json({ items, pagination: items.pagination })
  } catch (err) {
    next(err)
  }
}

export async function listClassSpaceCreators(req, res, next) {
  try {
    noStore(res)
    const creators = await classSpaceService.listClassSpaceCreators()
    res.json({ creators })
  } catch (err) {
    next(err)
  }
}

export async function getNextClassSpaceCode(req, res, next) {
  try {
    noStore(res)
    const code = await classSpaceService.previewNextClassSpaceCode()
    res.json({ code })
  } catch (err) {
    next(err)
  }
}

export async function getClassSpaceByCode(req, res, next) {
  try {
    noStore(res)
    const item = await classSpaceService.getClassSpaceByCode(req.params.code, req.profile)
    res.json({ item })
  } catch (err) {
    next(err)
  }
}

export async function getClassSpaceById(req, res, next) {
  try {
    noStore(res)
    const item = await classSpaceService.getClassSpaceById(req.params.id, {
      password: req.query?.password || req.body?.password || '',
      profile: req.profile,
    })
    res.json({ item })
  } catch (err) {
    next(err)
  }
}

export async function createClassSpace(req, res, next) {
  try {
    noStore(res)
    const item = await classSpaceService.createClassSpace(req.body || {}, req.profile)
    res.status(201).json({ message: 'Đã tạo lớp học.', item })
  } catch (err) {
    next(err)
  }
}

export async function updateClassSpace(req, res, next) {
  try {
    noStore(res)
    const item = await classSpaceService.updateClassSpace(req.params.id, req.body || {}, req.profile)
    res.json({ message: 'Đã lưu lớp học.', item })
  } catch (err) {
    next(err)
  }
}

export async function getUtilityRoster(req, res, next) {
  try {
    noStore(res)
    const roster = await classSpaceService.getUtilityRoster()
    res.json({ roster })
  } catch (err) {
    next(err)
  }
}

export async function updateUtilityRoster(req, res, next) {
  try {
    noStore(res)
    const roster = await classSpaceService.updateUtilityRoster(req.body || {}, req.profile)
    res.json({ message: 'Đã lưu danh sách PDF.', roster })
  } catch (err) {
    next(err)
  }
}

export async function updateClassSpacePassword(req, res, next) {
  try {
    noStore(res)
    const data = await classSpaceService.updateClassSpacePassword(
      req.params.id,
      req.body || {},
      req.profile
    )
    res.json({ message: 'Đã lưu mật khẩu mới.', ...data })
  } catch (err) {
    next(err)
  }
}

export async function deleteClassSpace(req, res, next) {
  try {
    noStore(res)
    const result = await classSpaceService.deleteClassSpace(req.params.id, req.profile)
    res.json({ message: 'Đã xoá phòng.', ...result })
  } catch (err) {
    next(err)
  }
}

export async function startClassSpaceAttempt(req, res, next) {
  try {
    noStore(res)
    const data = await classSpaceService.startClassSpaceAttempt(req.params.id, req.profile)
    res.json({ message: 'Đã ghi nhận thời điểm bắt đầu.', ...data })
  } catch (err) {
    next(err)
  }
}

export async function submitClassSpaceResult(req, res, next) {
  try {
    noStore(res)
    const data = await classSpaceService.submitClassSpaceResult(req.params.id, req.body || {}, req.profile)
    res.json({ message: 'Đã lưu kết quả.', ...data })
  } catch (err) {
    next(err)
  }
}

export async function getClassSpaceLeaderboard(req, res, next) {
  try {
    noStore(res)
    const data = await classSpaceService.getClassSpaceLeaderboard(req.params.id, req.profile, req.query)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

export async function uploadClassSpaceImage(req, res, next) {
  try {
    noStore(res)
    res.json(await classSpaceService.createClassSpaceImageUploadUrl(req.body || {}))
  } catch (err) { next(err) }
}
export async function completeClassSpaceImageUpload(req, res, next) {
  try {
    noStore(res)
    res.json(await classSpaceService.completeClassSpaceImageUpload(req.body || {}))
  } catch (err) { next(err) }
}
