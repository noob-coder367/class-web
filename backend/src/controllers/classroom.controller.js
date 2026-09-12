import * as classroomService from '../services/classroom.service.js'
import * as timetableService from '../services/timetable.service.js'
import * as rulesService from '../services/rules.service.js'
import * as announcementsService from '../services/announcements.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

export async function getAccess(req, res, next) {
  try {
    noStore(res)
    res.json({
      ok: true,
      is_member: req.profile?.is_member === true,
      role: req.profile?.role || 'user',
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

export async function createAnnouncement(req, res, next) {
  try {
    noStore(res)
    const item = await announcementsService.createAnnouncement(req.body || {}, req.profile)
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

export async function getLeaderboard(req, res, next) {
  try {
    noStore(res)
    const [members, violationData, rules] = await Promise.all([
      classroomService.listClassMembers(),
      rulesService.getViolations(),
      rulesService.getRules(),
    ])
    const leaderboard = rulesService.buildLeaderboard(members, violationData.items, rules)
    res.json({ leaderboard, members })
  } catch (err) {
    next(err)
  }
}
