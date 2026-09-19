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
    const items = await announcementsService.listAnnouncements()
    res.json({ items })
  } catch (err) {
    next(err)
  }
}

export async function listAnnouncementsArchive(req, res, next) {
  try {
    noStore(res)
    const items = await announcementsService.listArchive(req.query?.section)
    res.json({ items })
  } catch (err) {
    next(err)
  }
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
    const items = await homeworkService.listHomework()
    res.json({ items })
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
    const data = await rulesService.getViolations()
    res.json({ violations: data.items, updatedAt: data.updatedAt })
  } catch (err) {
    next(err)
  }
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

export async function getLeaderboard(req, res, next) {
  try {
    noStore(res)
    const [members, violationData, rules] = await Promise.all([
      classRosterService.listClassRoster(),
      rulesService.getViolations(),
      rulesService.getRules(),
    ])
    const leaderboard = rulesService.buildLeaderboard(members, violationData.items, rules)
    res.json({ leaderboard, members })
  } catch (err) {
    next(err)
  }
}

export async function listClassSpace(req, res, next) {
  try {
    noStore(res)
    const items = await classSpaceService.listClassSpace(req.profile)
    res.json({ items })
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
    const data = await classSpaceService.getClassSpaceLeaderboard(req.params.id, req.profile)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

export async function uploadClassSpaceImage(req, res, next) {
  try {
    noStore(res)
    const url = await classSpaceService.uploadClassSpaceImage(req.body || {})
    res.status(201).json({ url })
  } catch (err) {
    next(err)
  }
}
