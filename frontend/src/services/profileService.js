import { apiClient } from './apiClient.js'

const text = (value) => String(value || '').trim() || null

export class ProfileServiceError extends Error {
  constructor(kind, message, { code = '', operation = '' } = {}) {
    super(message)
    this.name = 'ProfileServiceError'
    this.kind = kind
    this.code = code
    this.operation = operation
  }
}

/** Đọc hồ sơ chính chủ qua backend; backend lấy user id từ token đã xác minh. */
export async function fetchOwnProfile() {
  const result = await apiClient.get('/auth/me/profile', { auth: true })
  if (!result?.profile) throw new ProfileServiceError('missing', 'Hồ sơ tài khoản chưa được khởi tạo.', { operation: 'fetchOwnProfile' })
  return result.profile
}

export async function updateOwnProfile(_userId, values) {
  const result = await apiClient.patch('/auth/me/profile', {
    full_name: text(values.full_name),
    gender: text(values.gender),
    province: text(values.province),
    school: text(values.school),
    phone: text(String(values.phone || '').replace(/\s+/g, '')),
    facebook_url: text(values.facebook_url),
  }, { auth: true })
  if (!result?.profile) throw new ProfileServiceError('missing', 'Hồ sơ tài khoản chưa được khởi tạo.', { operation: 'updateOwnProfile' })
  return result.profile
}

/** Xác định identity từ backend sau khi token đã được xác minh. */
export async function fetchAuthIdentity() {
  const result = await apiClient.get('/auth/me/profile', { auth: true })
  if (!result?.identity) throw new ProfileServiceError('session', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.', { operation: 'fetchAuthIdentity' })
  return { ...result.identity, userId: result.profile?.id || null }
}

export async function changePassword({ email, currentPassword, newPassword }) {
  // Đổi mật khẩu vẫn dùng Supabase Auth ở authService; import động giữ profile flow không phụ thuộc PostgREST.
  const { supabase } = await import('../lib/supabaseClient.js')
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (verifyError) throw new Error('Mật khẩu hiện tại chưa chính xác.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    throw new Error(/different|same/i.test(error.message || '')
      ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
      : 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.')
  }
}
