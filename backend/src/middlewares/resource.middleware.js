import { hasCapability } from '../lib/roles.js'
export function requireResourceAccess(req, res, next) {
  if (!hasCapability(req.profile?.role, 'resourceManagement')) return res.status(403).json({ message: 'Bạn không có quyền truy cập Quản lý tài nguyên.' })
  next()
}
