import { supabase } from '../lib/supabaseClient.js'
import { classifySupabaseError, PROFILE_ERROR_MESSAGES } from '../lib/profileErrors.js'

const COLUMNS = 'id, email, username, role, full_name, gender, province, school, phone, facebook_url'
const text = (value) => String(value || '').trim() || null

const FRIENDLY_MESSAGES = PROFILE_ERROR_MESSAGES

export class ProfileServiceError extends Error {
  constructor(kind, message, { code = '', operation = '' } = {}) {
    super(message || FRIENDLY_MESSAGES[kind] || FRIENDLY_MESSAGES.unknown)
    this.name = 'ProfileServiceError'
    this.kind = kind
    this.code = code
    this.operation = operation
  }
}


function reportSupabaseError(operation, error, userId = '') {
  const kind = classifySupabaseError(error)
  // Chỉ log metadata an toàn; không log session/token, request headers hay payload.
  console.warn('[profile]', {
    operation,
    kind,
    code: String(error?.code || ''),
    message: String(error?.message || '').slice(0, 240),
    details: String(error?.details || '').slice(0, 240),
    userIdPrefix: userId ? `${String(userId).slice(0, 8)}…` : undefined,
  })
  return new ProfileServiceError(kind, FRIENDLY_MESSAGES[kind], {
    code: String(error?.code || ''),
    operation,
  })
}

/** Hồ sơ của chính user (RLS: chỉ đọc/sửa được dòng có id = auth.uid()). */
export async function fetchOwnProfile(userId) {
  if (!userId) throw new ProfileServiceError('session', FRIENDLY_MESSAGES.session, { operation: 'fetchOwnProfile' })
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).single()
  if (error) throw reportSupabaseError('fetchOwnProfile', error, userId)
  if (!data || data.id !== userId) {
    throw new ProfileServiceError('missing', FRIENDLY_MESSAGES.missing, { code: 'PROFILE_ID_MISMATCH', operation: 'fetchOwnProfile' })
  }
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
  if (error) throw reportSupabaseError('updateOwnProfile', error, userId)
  if (!data || data.id !== userId) {
    throw new ProfileServiceError('missing', FRIENDLY_MESSAGES.missing, { code: 'PROFILE_ID_MISMATCH', operation: 'updateOwnProfile' })
  }
  return data
}

/** Xác định cách đăng nhập từ Supabase Auth (user.identities), không đoán từ UI. */
export async function fetchAuthIdentity() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    if (error) throw reportSupabaseError('fetchAuthIdentity', error)
    throw new ProfileServiceError('session', FRIENDLY_MESSAGES.session, { operation: 'fetchAuthIdentity' })
  }
  const fromIdentities = (data.user.identities || []).map((identity) => identity.provider)
  const providers = fromIdentities.length ? fromIdentities : data.user.app_metadata?.providers || []
  return { userId: data.user.id, providers, hasPassword: providers.includes('email') }
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
