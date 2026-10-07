/**
 * Xác định provider ĐÁNG TIN của phiên đăng nhập.
 *
 * - `user` phải là kết quả của supabaseAdmin.auth.getUser(token): Supabase đã xác minh chữ ký/hạn
 *   của token và trả identities từ chính bảng auth.identities (client không sửa được).
 * - `claims` là payload JWT của CHÍNH token đó (token đã được xác minh ở bước trên nên đọc
 *   payload là an toàn). Claim `amr` cho biết phiên này được tạo bằng phương thức nào
 *   (oauth / password ...), nên tài khoản email có link thêm Google nhưng đăng nhập bằng
 *   mật khẩu vẫn KHÔNG được xem là phiên Google.
 *
 * Không dùng email domain, user_metadata, localStorage hay bất kỳ cờ nào từ frontend.
 */
export function decodeJwtClaims(token) {
  try {
    const payload = String(token || '').split('.')[1]
    if (!payload) return null
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return claims && typeof claims === 'object' ? claims : null
  } catch {
    return null
  }
}

export function getIdentityProviders(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : []
  return identities.map((identity) => identity?.provider).filter(Boolean)
}

export function isGoogleSession(user, claims) {
  const providers = getIdentityProviders(user)
  if (!providers.includes('google')) return false

  const amr = Array.isArray(claims?.amr) ? claims.amr : null
  if (amr) {
    return amr.some((entry) => entry?.method === 'oauth' && (!entry.provider || entry.provider === 'google'))
  }
  // Token không có amr (hiếm): chỉ chấp nhận khi tài khoản không có identity email/password.
  return !providers.includes('email')
}

export function describeSessionProvider(user, claims) {
  if (isGoogleSession(user, claims)) return 'google'
  const providers = getIdentityProviders(user)
  if (providers.includes('email')) return 'email'
  return providers[0] || 'unknown'
}
