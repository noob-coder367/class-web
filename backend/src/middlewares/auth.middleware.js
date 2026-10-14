import { getUserFromAccessToken } from '../services/auth.service.js'
import { normalizeRole } from '../lib/roles.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Đọc "Authorization: Bearer <access_token>" (access_token do Supabase
 * cấp sau khi đăng nhập thành công), xác thực bằng service role
 * key, rồi gắn req.user / req.profile để các middleware/controller sau
 * dùng lại (không cần query lại DB nhiều lần).
 *
 * Role được normalize theo allowlist — role lạ từ DB bị hạ thành 'user',
 * không thể tự phong quyền bằng cách ghi giá trị tùy ý vào cột role.
 *
 * req.accessToken được giữ lại (đã xác minh) để middleware requireGoogle đọc claim amr.
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
    req.accessToken = token
    req.profile = {
      ...result.profile,
      role: normalizeRole(result.profile.role),
    }
    next()
  } catch (err) {
    next(err)
  }
}

/** Room APIs accept a verified account session or a stable, random guest ID. */
export async function requireRoomIdentity(req, res, next) {
  if (String(req.headers.authorization || '').startsWith('Bearer ')) {
    return requireAuth(req, res, next)
  }

  const guestId = String(req.get('X-Guest-Id') || '')
  if (!UUID_RE.test(guestId)) {
    return res.status(400).json({ message: 'Thiếu mã khách hợp lệ. Hãy tải lại trang và thử lại.', code: 'guest_identity_required' })
  }

  req.user = { id: guestId, is_anonymous: true }
  req.profile = null
  req.isGuest = true
  return next()
}
