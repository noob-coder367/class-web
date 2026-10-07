import { decodeJwtClaims, isGoogleSession } from '../lib/authProvider.js'
import { HttpError } from '../lib/httpError.js'

/**
 * Chạy SAU requireAuth. Chỉ cho phiên đăng nhập bằng Google đi tiếp.
 * Provider được suy ra từ identities do Supabase trả về + claim amr của chính access token đã xác minh;
 * không đọc bất kỳ dữ liệu phân quyền nào do frontend gửi lên.
 */
export function requireGoogle(req, _res, next) {
  const claims = decodeJwtClaims(req.accessToken)
  if (!req.user || !isGoogleSession(req.user, claims)) {
    return next(new HttpError('Tính năng này yêu cầu đăng nhập bằng Google.', 403, 'google_required'))
  }
  next()
}
