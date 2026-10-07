import { isAdminRole } from '../lib/roles.js'
import { HttpError } from '../lib/httpError.js'

export function requireAdmin(req, _res, next) {
  if (!isAdminRole(req.profile?.role)) {
    return next(new HttpError('Bạn không có quyền quản trị.', 403, 'admin_required'))
  }
  next()
}
