import { hasCapability, isAdminRole } from '../lib/roles.js'

/**
 * Phải chạy SAU requireAuth.
 * Chỉ Admin (role === 'admin') mới vào được — lớp phó không được.
 * Dùng cho /api/admin/* (truyền chức, duyệt thành viên, xóa user, ảnh website).
 */
export function requireAdmin(req, res, next) {
  if (!isAdminRole(req.profile?.role)) {
    return res.status(403).json({ message: 'Bạn không có quyền admin.' })
  }
  next()
}

/**
 * Phải chạy SAU requireAuth.
 * capability phải là tên đã khai báo trong lib/roles.js — capability lạ = 403.
 * Role lấy từ profiles sau khi verify token, không lấy từ body/query client.
 */
export function requireCapability(capability) {
  return function capabilityGuard(req, res, next) {
    if (!hasCapability(req.profile?.role, capability)) {
      return res.status(403).json({
        message: 'Bạn không có quyền thực hiện thao tác này.',
      })
    }
    next()
  }
}
