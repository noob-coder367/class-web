import * as adminService from '../services/admin.service.js'
import * as classRosterService from '../services/classRoster.service.js'

export async function getUsers(req, res, next) {
  try {
    const users = await adminService.listUsers()
    res.json({ users })
  } catch (err) {
    next(err)
  }
}

export async function getClassList(req, res, next) {
  try {
    const items = await classRosterService.listClassRoster()
    res.json({ items })
  } catch (err) {
    next(err)
  }
}

export async function postClassList(req, res, next) {
  try {
    const items = await classRosterService.addPlaceholder(req.body?.name, req.profile)
    res.status(201).json({ message: 'Đã thêm tên vào danh sách lớp.', items })
  } catch (err) {
    next(err)
  }
}

export async function deleteClassListItem(req, res, next) {
  try {
    const items = await classRosterService.removePlaceholder(req.params.id)
    res.json({ message: 'Đã xoá tên chờ kết nối.', items })
  } catch (err) {
    next(err)
  }
}

export async function connectClassListItem(req, res, next) {
  try {
    const result = await classRosterService.connectPlaceholder(
      req.params.id,
      req.body?.userId || req.body?.user_id
    )
    const moved = result.connected || {}
    res.json({
      message:
        `Đã kết nối "${moved.from_name}" với ${moved.username}. `
        + `Đồng bộ ${moved.violations || 0} vi phạm và ${moved.cleaning_weeks || 0} tuần trực.`,
      ...result,
    })
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
    const requestedRole = req.body?.role ?? req.body?.nextRole
    if (requestedRole) {
      await adminService.setRole(id, requestedRole, req.profile.id)
    } else {
      // payload cũ { currentRole } — toggle admin/user
      await adminService.toggleRole(id, req.body?.currentRole, req.profile.id)
    }
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
