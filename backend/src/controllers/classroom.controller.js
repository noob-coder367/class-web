import * as classroomService from '../services/classroom.service.js'
import * as timetableService from '../services/timetable.service.js'

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
