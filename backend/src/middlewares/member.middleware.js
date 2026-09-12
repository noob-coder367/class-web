import { isStaffRole } from '../lib/roles.js'

/**
 * Phải chạy SAU requireAuth.
 * Chỉ thành viên lớp (is_member) hoặc cán sự (admin / lớp phó) mới được đọc nội dung khu vực lớp.
 * Không tin cờ is_member phía client — luôn kiểm tra lại profile từ token.
 */
export function requireMember(req, res, next) {
  const isStaff = isStaffRole(req.profile?.role)
  const isMember = req.profile?.is_member === true

  if (!isStaff && !isMember) {
    return res.status(403).json({
      message: 'Chỉ thành viên lớp 10A4 mới được xem nội dung này.',
    })
  }

  next()
}
