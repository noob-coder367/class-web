import {
  canEdit,
  canHardDelete,
  canHide,
  canManageArchive,
  canPostToSection,
  hasCapability,
  isAdminRole,
  normalizeSection,
} from '../lib/roles.js'
import * as announcementsService from '../services/announcements.service.js'

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

function deny(res, message = 'Bạn không có quyền thực hiện thao tác này.') {
  return res.status(403).json({ message })
}

/**
 * Kiểm tra quyền theo section của bài đăng.
 *  - create: đọc section từ req.body.section (mặc định 'main'). Chặn 'discipline'.
 *  - hide / unhide / delete / expiry: load bài theo :id, gắn vào req.announcement.
 */
export function requireAnnouncementAction(action) {
  return function announcementActionGuard(req, res, next) {
    Promise.resolve()
      .then(async () => {
        const role = req.profile?.role

        if (action === 'create') {
          const requested = String(req.body?.section || '').trim().toLowerCase()
          if (requested === 'discipline') {
            return deny(res, 'Mục vi phạm kỷ luật cao do hệ thống tự đăng, không đăng tay được.')
          }
          const section = requested === 'important' ? 'important' : 'main'
          if (!canPostToSection(role, section)) {
            return deny(res, 'Bạn không có quyền đăng bài ở mục này.')
          }
          req.announcementSection = section
          return next()
        }

        if (action === 'archive') {
          if (!canManageArchive(role)) {
            return deny(res, 'Chỉ LPSK / Admin được xem kho lưu trữ.')
          }
          return next()
        }

        if (action === 'unhide') {
          if (!canManageArchive(role)) {
            return deny(res, 'Chỉ LPSK / Admin được bỏ ẩn bài.')
          }
        }

        const item = await announcementsService.getAnnouncementById(req.params.id)
        if (!item) {
          return res.status(404).json({ message: 'Không tìm thấy thông báo.' })
        }
        req.announcement = item
        const section = normalizeSection(item.section)

        if (action === 'hide' && !canHide(role, section)) {
          return deny(res, 'Bạn không có quyền ẩn bài ở mục này.')
        }
        if (action === 'delete' && !canHardDelete(role, section)) {
          return deny(res, 'Bạn không có quyền xóa vĩnh viễn bài này. Hãy dùng Ẩn.')
        }
        if (action === 'expiry' && !canEdit(role, section)) {
          return deny(res, 'Bạn không có quyền sửa bài ở mục này.')
        }

        return next()
      })
      .catch(next)
  }
}
