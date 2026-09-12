import { getUserFromAccessToken } from '../services/auth.service.js'
import { normalizeRole } from '../lib/roles.js'

/**
 * Đọc "Authorization: Bearer <access_token>" (access_token do Supabase
 * cấp sau khi login/verify OTP thành công), xác thực bằng service role
 * key, rồi gắn req.user / req.profile để các middleware/controller sau
 * dùng lại (không cần query lại DB nhiều lần).
 *
 * Role được normalize theo allowlist — role lạ từ DB bị hạ thành 'user',
 * không thể tự phong quyền bằng cách ghi giá trị tùy ý vào cột role.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null

    if (!token) {
      return res.status(401).json({ message: 'Thiếu token xác thực.' })
    }

    const result = await getUserFromAccessToken(token)

    if (!result || !result.profile) {
      return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' })
    }

    req.user = result.user
    req.profile = {
      ...result.profile,
      role: normalizeRole(result.profile.role),
    }
    next()
  } catch (err) {
    next(err)
  }
}
