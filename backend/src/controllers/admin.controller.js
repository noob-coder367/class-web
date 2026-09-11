import * as adminService from '../services/admin.service.js'
import * as timetableService from '../services/timetable.service.js'

export async function getUsers(req, res, next) {
  try {
    const users = await adminService.listUsers()
    res.json({ users })
  } catch (err) {
    next(err)
  }
}

export async function patchUsername(req, res, next) {
  try {
    const { id } = req.params
    const { username } = req.body
    const profile = await adminService.updateUsername(id, username)
    res.json({ message: 'Đã cập nhật tên hiển thị.', profile })
  } catch (err) {
    next(err)
  }
}

export async function patchMember(req, res, next) {
  try {
    const { id } = req.params
    const { currentStatus } = req.body
    await adminService.toggleMember(id, currentStatus)
    res.json({ message: 'Cập nhật trạng thái thành viên thành công.' })
  } catch (err) {
    next(err)
  }
}

export async function patchRole(req, res, next) {
  try {
    const { id } = req.params
    const { currentRole } = req.body
    await adminService.toggleRole(id, currentRole, req.profile.id)
    res.json({ message: 'Cập nhật quyền thành công.' })
  } catch (err) {
    next(err)
  }
}

export async function removeUser(req, res, next) {
  try {
    const { id } = req.params
    await adminService.deleteUser(id, req.profile.id)
    res.json({ message: 'Xóa tài khoản thành công.' })
  } catch (err) {
    next(err)
  }
}

export async function getTimetable(req, res, next) {
  try {
    const timetable = await timetableService.getTimetable()
    res.json({ timetable })
  } catch (err) {
    next(err)
  }
}

export async function putTimetable(req, res, next) {
  try {
    const timetable = await timetableService.saveTimetable(
      req.body?.timetable,
      req.profile?.id
    )
    res.json({ message: 'Đã lưu thời khoá biểu.', timetable })
  } catch (err) {
    next(err)
  }
}
