import crypto from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { env } from '../config/env.js'
import { normalizeRole } from '../lib/roles.js'

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const PROFILE_COLUMNS = 'id, username, email, is_member, role, full_name, gender, province, school, phone, facebook_url, created_at, updated_at'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GHOST_EMAIL_DOMAIN = 'ghost.com'
export const GHOST_DAILY_LIMIT = 2

export function isGhostEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith(`@${GHOST_EMAIL_DOMAIN}`)
}

export function ghostEmailFor(index) {
  return `taikhoanma-${index}@${GHOST_EMAIL_DOMAIN}`
}

export function normalizeDisplayName(value) {
  const displayName = String(value || '').trim().replace(/\s+/g, ' ')
  if (displayName.length < 2 || displayName.length > 60) throw new AppError('Tên hiển thị cần từ 2 đến 60 ký tự.')
  return displayName
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new AppError('Vui lòng nhập địa chỉ email hợp lệ.')
  return email
}

export function toOwnProfile(profile, user = null) {
  if (!profile) return null
  return {
    id: profile.id,
    email: profile.email || user?.email || '',
    username: profile.username || '',
    role: normalizeRole(profile.role),
    full_name: profile.full_name || null,
    gender: profile.gender || null,
    province: profile.province || null,
    school: profile.school || null,
    phone: profile.phone || null,
    facebook_url: profile.facebook_url || null,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }
}

export function identityForUser(user) {
  const providers = (user?.identities || []).map((identity) => identity.provider)
  const fallback = providers.length ? providers : user?.app_metadata?.providers || []
  return { providers: fallback, hasPassword: fallback.includes('email') }
}

export async function updateOwnProfile(userId, values) {
  const text = (value) => String(value || '').trim() || null
  const payload = {
    full_name: text(values?.full_name),
    gender: text(values?.gender),
    province: text(values?.province),
    school: text(values?.school),
    phone: text(String(values?.phone || '').replace(/\s+/g, '')),
    facebook_url: text(values?.facebook_url),
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single()
  if (error) throw new AppError('Không thể lưu hồ sơ. Vui lòng kiểm tra thông tin và thử lại.', 400)
  return data
}

export function toPublicProfile(profile, user = null) {
  if (!profile) return null
  const meta = user?.user_metadata || {}
  const isGhost = Boolean(meta.is_ghost) || isGhostEmail(profile.email)
  const hasGoogleIdentity = Array.isArray(user?.identities) && user.identities.some((identity) => identity?.provider === 'google')
  const needsDisplayName = !profile.full_name && (isGhost || hasGoogleIdentity)
  const displayName = String(profile.full_name || meta.display_name || meta.full_name || meta.name || user?.email?.split('@')[0] || '')
  return {
    id: profile.id,
    display_name: displayName,
    email: profile.email || user?.email || '',
    role: normalizeRole(profile.role),
    created_at: profile.created_at,
    ...(isGhost ? { is_ghost: true } : {}),
    ...(needsDisplayName ? { needs_display_name: true } : {}),
  }
}

async function findProfileById(userId) {
  const { data, error } = await supabaseAdmin.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()
  if (error) throw new AppError('Không thể tải thông tin tài khoản.', 503)
  return data
}

async function ensureProfileForUser(user) {
  let profile = await findProfileById(user.id)
  if (profile) return profile
  const email = String(user.email || '').trim().toLowerCase()
  const { error } = await supabaseAdmin.from('profiles').upsert({
    id: user.id,
    username: `account-${user.id.replaceAll('-', '').slice(0, 24)}`,
    email,
    full_name: user.user_metadata?.is_ghost ? null : null,
    is_member: false,
  }, { onConflict: 'id' })
  if (error) throw new AppError('Không thể khởi tạo hồ sơ tài khoản.', 503)
  profile = await findProfileById(user.id)
  if (!profile) throw new AppError('Không tìm thấy hồ sơ tài khoản.', 503)
  return profile
}

async function sendSignupConfirmation(email) {
  const { error } = await supabaseAdmin.auth.resend({ type: 'signup', email, options: { emailRedirectTo: env.FRONTEND_ORIGIN } })
  if (!error) return
  const message = /rate limit|too many/i.test(String(error.message || ''))
    ? 'Bạn vừa yêu cầu email xác nhận. Hãy đợi một phút rồi thử lại.'
    : 'Tài khoản đã được tạo nhưng không thể gửi email xác nhận lúc này.'
  throw new AppError(message, error.status === 429 ? 429 : 503)
}

export async function previewGhostAccount() {
  const { data, error } = await supabaseAdmin.from('ghost_account_reservations').select('local_day, status').eq('local_day', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())).in('status', ['reserved', 'created'])
  if (error) throw new AppError('Tính năng tài khoản ma chưa được khởi tạo.', 503)
  const remainingToday = Math.max(0, GHOST_DAILY_LIMIT - (data || []).length)
  return { remainingToday, limit: GHOST_DAILY_LIMIT }
}

async function reserveGhost() {
  const { data, error } = await supabaseAdmin.rpc('ghost_reserve_account')
  if (error) {
    if (/ghost_daily_limit/i.test(error.message || '')) throw new AppError('Hôm nay đã hết lượt tài khoản ma (tối đa 2 tài khoản/ngày).', 429)
    throw new AppError('Không thể tạo tài khoản ma lúc này.', 503)
  }
  return data
}

async function releaseGhost(id) {
  if (id) await supabaseAdmin.rpc('ghost_release_reservation', { p_reservation_id: id })
}

async function registerGhostUser({ secretCode }) {
  if (!env.SECRET_CODE || secretCode !== env.SECRET_CODE) throw new AppError('Mã thành viên không chính xác.')
  const reservation = await reserveGhost()
  const email = ghostEmailFor(reservation.ghost_index)
  const password = crypto.randomBytes(24).toString('base64url')
  let userId
  try {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { is_ghost: true },
    })
    if (error || !created?.user) throw new AppError('Không thể tạo tài khoản ma lúc này.', 503)
    userId = created.user.id
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId, username: `account-${userId.replaceAll('-', '').slice(0, 24)}`, email, full_name: null, is_member: true,
    }, { onConflict: 'id' })
    if (profileError) throw new AppError('Không thể khởi tạo hồ sơ tài khoản ma.', 503)
    const { data: finalized, error: finalizeError } = await supabaseAdmin.rpc('ghost_finalize_account', { p_reservation_id: reservation.id, p_user_id: userId })
    if (finalizeError || !finalized) throw new AppError('Không thể hoàn tất tài khoản ma.', 503)
    const { data: signedIn, error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password })
    if (signInError || !signedIn?.session) throw new AppError('Không thể đăng nhập tài khoản ma.', 503)
    const profile = await findProfileById(userId)
    return { email, ghost: true, session: signedIn.session, profile: toPublicProfile(profile, signedIn.user) }
  } catch (error) {
    if (userId) {
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
    }
    await releaseGhost(reservation.id)
    throw error
  }
}

export async function registerUser({ displayName, email: rawEmail, password, ghost, secretCode }) {
  if (ghost === true) return registerGhostUser({ secretCode })
  const email = normalizeEmail(rawEmail)
  const name = normalizeDisplayName(displayName)
  if (typeof password !== 'string' || password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new AppError('Mật khẩu cần có ít nhất 8 ký tự, gồm 1 chữ hoa và 1 chữ số.')
  }
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { display_name: name } })
  if (createError || !created?.user) {
    if (/already|registered|exists/i.test(String(createError?.message || ''))) throw new AppError('Email này đã được sử dụng.')
    throw new AppError('Không thể tạo tài khoản lúc này.', 503)
  }
  const userId = created.user.id
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({ id: userId, username: `account-${userId.replaceAll('-', '').slice(0, 24)}`, email, full_name: name, is_member: false }, { onConflict: 'id' })
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw new AppError('Không thể khởi tạo hồ sơ. Vui lòng thử lại.', 503)
  }
  try { await sendSignupConfirmation(email) } catch (error) {
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw error
  }
  return { email, ghost: false }
}

export async function loginUser({ displayName: rawDisplayName, password }) {
  const displayName = normalizeDisplayName(rawDisplayName)
  if (typeof password !== 'string' || !password) throw new AppError('Vui lòng nhập mật khẩu.')
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .ilike('full_name', displayName)
    .limit(2)
  if (profileError) throw new AppError('Không thể kiểm tra tên hiển thị lúc này.', 503)
  if (!profiles?.length) throw new AppError('Tên hiển thị hoặc mật khẩu chưa chính xác.', 401)
  if (profiles.length > 1) throw new AppError('Tên hiển thị này chưa duy nhất. Vui lòng liên hệ quản trị viên.', 409)
  const email = normalizeEmail(profiles[0].email)
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
  if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(error?.message || '')) throw new AppError('Email chưa được xác nhận. Hãy kiểm tra hộp thư của bạn.')
  if (error || !data?.user || !data?.session) throw new AppError('Tên hiển thị hoặc mật khẩu chưa chính xác.', 401)
  const profile = await ensureProfileForUser(data.user)
  return { session: data.session, profile: toPublicProfile(profile, data.user) }
}

export async function getUserFromAccessToken(accessToken) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data?.user) return null
  const profile = await ensureProfileForUser(data.user)
  return { user: data.user, profile }
}
