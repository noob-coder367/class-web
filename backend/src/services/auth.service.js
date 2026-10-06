import { supabaseAdmin } from '../config/supabaseClient.js'
import { env } from '../config/env.js'
import { normalizeRole } from '../lib/roles.js'

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const PROFILE_COLUMNS = 'id, username, email, is_member, role, created_at, updated_at'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeDisplayName(value) {
  const displayName = String(value || '').trim().replace(/\s+/g, ' ')
  if (displayName.length < 2 || displayName.length > 40) {
    throw new AppError('Tên hiển thị cần từ 2 đến 40 ký tự.')
  }
  return displayName
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new AppError('Vui lòng nhập địa chỉ email hợp lệ.')
  return email
}

export function toPublicProfile(profile, user = null) {
  if (!profile) return null
  const displayName = String(user?.user_metadata?.display_name || user?.email?.split('@')[0] || '')
  return {
    id: profile.id,
    display_name: displayName,
    email: profile.email || '',
    role: normalizeRole(profile.role),
    created_at: profile.created_at,
  }
}

async function findProfileById(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new AppError('Không thể tải thông tin tài khoản.', 503)
  return data
}

async function sendSignupConfirmation(email) {
  const { error } = await supabaseAdmin.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: env.FRONTEND_ORIGIN },
  })
  if (!error) return
  const message = /rate limit|too many/i.test(String(error.message || ''))
    ? 'Bạn vừa yêu cầu email xác nhận. Hãy đợi một phút rồi thử lại.'
    : 'Tài khoản đã được tạo nhưng không thể gửi email xác nhận lúc này.'
  throw new AppError(message, error.status === 429 ? 429 : 503)
}

export async function registerUser({ displayName, email: rawEmail, password }) {
  const email = normalizeEmail(rawEmail)
  const name = normalizeDisplayName(displayName)
  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError('Mật khẩu cần có ít nhất 8 ký tự.')
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { display_name: name },
  })
  if (createError || !created?.user) {
    const message = String(createError?.message || '')
    if (/already|registered|exists/i.test(message)) throw new AppError('Email này đã được sử dụng.')
    throw new AppError('Không thể tạo tài khoản lúc này.', 503)
  }

  const userId = created.user.id
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    username: `account-${userId.replaceAll('-', '').slice(0, 24)}`,
    email,
    is_member: false,
  }, { onConflict: 'id' })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw new AppError('Không thể khởi tạo hồ sơ. Vui lòng thử lại.', 503)
  }

  try {
    await sendSignupConfirmation(email)
  } catch (error) {
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw error
  }
  return { email }
}

export async function loginUser({ email: rawEmail, password }) {
  const email = normalizeEmail(rawEmail)
  if (typeof password !== 'string' || !password) throw new AppError('Vui lòng nhập mật khẩu.')

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
  if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(error?.message || '')) {
    throw new AppError('Email chưa được xác nhận. Hãy kiểm tra hộp thư của bạn.')
  }
  if (error || !data?.user || !data?.session) {
    throw new AppError('Email hoặc mật khẩu chưa chính xác.', 401)
  }

  const profile = await findProfileById(data.user.id)
  if (!profile) throw new AppError('Không tìm thấy hồ sơ tài khoản.', 401)
  return { session: data.session, profile: toPublicProfile(profile, data.user) }
}

export async function getUserFromAccessToken(accessToken) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data?.user) return null
  const profile = await findProfileById(data.user.id)
  if (!profile) return null
  return { user: data.user, profile }
}
