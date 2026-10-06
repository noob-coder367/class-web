import { supabase } from '../lib/supabaseClient.js'

const COLUMNS = 'id, email, username, role, full_name, gender, province, school, phone, facebook_url'
const text = (value) => String(value || '').trim() || null

/** Hồ sơ của chính user (RLS: chỉ đọc/sửa được dòng có id = auth.uid()). */
export async function fetchOwnProfile(userId) {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).single()
  if (error) throw new Error('Không thể tải hồ sơ. Vui lòng thử lại.')
  return data
}

export async function updateOwnProfile(userId, values) {
  const payload = {
    full_name: text(values.full_name),
    gender: text(values.gender),
    province: text(values.province),
    school: text(values.school),
    phone: text(String(values.phone || '').replace(/\s+/g, '')),
    facebook_url: text(values.facebook_url),
  }
  const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select(COLUMNS).single()
  if (error) throw new Error('Không thể lưu hồ sơ. Vui lòng thử lại.')
  return data
}

/**
 * Xác định cách đăng nhập từ Supabase Auth (user.identities), KHÔNG đoán từ UI.
 * hasPassword = tài khoản có identity "email" (đăng ký bằng email/mật khẩu).
 */
export async function fetchAuthIdentity() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error('Không thể xác định tài khoản. Vui lòng đăng nhập lại.')
  const fromIdentities = (data.user.identities || []).map((identity) => identity.provider)
  const providers = fromIdentities.length ? fromIdentities : data.user.app_metadata?.providers || []
  return { providers, hasPassword: providers.includes('email') }
}

export async function changePassword({ email, currentPassword, newPassword }) {
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (verifyError) throw new Error('Mật khẩu hiện tại chưa chính xác.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    throw new Error(/different|same/i.test(error.message || '')
      ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
      : 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.')
  }
}
