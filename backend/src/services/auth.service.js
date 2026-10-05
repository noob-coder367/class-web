import { supabaseAdmin } from '../config/supabaseClient.js'
import { env } from '../config/env.js'
import { normalizeRole } from '../lib/roles.js'

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const PENDING_USERNAME_PREFIX = 'pending:'
const PROFILE_COLUMNS = 'id, username, email, is_member, role, created_at, updated_at'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CHANGES_PER_WEEK = 2
const GHOST_EMAIL_PREFIX = 'taikhoanma-'
const GHOST_EMAIL_DOMAIN = 'ghost.com'
export const GHOST_DAILY_LIMIT = 2
const profileInflight = new Map()

export function isPendingUsername(username) {
  return !username || String(username).startsWith(PENDING_USERNAME_PREFIX)
}

export function pendingUsernameFor(userId) {
  return `${PENDING_USERNAME_PREFIX}${userId}`
}

export function isGhostEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  return value.endsWith(`@${GHOST_EMAIL_DOMAIN}`)
}

export function ghostEmailFor(index) {
  return `${GHOST_EMAIL_PREFIX}${index}@${GHOST_EMAIL_DOMAIN}`
}

function vietnamDayKey(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

export function toPublicProfile(profile) {
  if (!profile) return null
  const pending = isPendingUsername(profile.username)
  return {
    id: profile.id,
    username: pending ? '' : profile.username,
    email: profile.email,
    is_member: profile.is_member,
    role: normalizeRole(profile.role),
    created_at: profile.created_at,
    needs_display_name: pending,
    is_ghost: isGhostEmail(profile.email),
  }
}

export function normalizeDisplayName(raw) {
  const name = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!name) throw new AppError('Vui lòng nhập tên hiển thị!')
  if (name.length < 2) throw new AppError('Tên hiển thị phải có ít nhất 2 ký tự!')
  if (name.length > 40) throw new AppError('Tên hiển thị tối đa 40 ký tự!')
  if (name.toLowerCase().startsWith(PENDING_USERNAME_PREFIX)) {
    throw new AppError('Tên hiển thị không hợp lệ!')
  }
  return name
}

async function findProfileByUsername(username) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('username', username.trim())
    .maybeSingle()

  if (error) throw new AppError('Lỗi truy vấn tài khoản.', 500)
  return data
}

async function findProfileByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('email', String(email || '').trim().toLowerCase())
    .maybeSingle()

  if (error) throw new AppError('Lỗi truy vấn tài khoản.', 500)
  return data
}

async function findProfileById(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new AppError('Lỗi truy vấn hồ sơ.', 500)
  return data
}

async function ensureDataBucket() {
  return true
}

async function callGhostRpc(name, args = {}) {
  const { data, error } = await supabaseAdmin.rpc(name, args)
  if (error) {
    const message = String(error.message || '')
    if (message.includes('GHOST_DAILY_LIMIT')) {
      throw new AppError('Hôm nay đã hết lượt tài khoản ma (tối đa 2 tài khoản/ngày trên toàn hệ thống).')
    }
    console.error('[auth] ghost database operation failed', { operation: name, code: error.code })
    throw new AppError('Không thể xử lý đăng ký tài khoản ma. Vui lòng thử lại sau.', 503)
  }
  return data
}

export async function previewGhostAccount() {
  const data = await callGhostRpc('ghost_preview_account')
  return {
    email: data?.email || null,
    nextIndex: Number(data?.nextIndex) || 1,
    remainingToday: Number(data?.remainingToday) || 0,
    limit: GHOST_DAILY_LIMIT,
  }
}

function isEmailRateLimit(error) {
  const msg = String(error?.message || '')
  return error?.status === 429 || /rate limit|after \d+ seconds|too many/i.test(msg)
}

/**
 * Gửi email xác nhận đăng ký (Supabase template "Confirm signup",
 * chứa {{ .ConfirmationURL }}). User bấm link -> được đưa về FRONTEND_ORIGIN.
 * Không có bất kỳ fallback nào gửi mã số.
 */
async function sendSignupConfirmationEmail(email) {
  const { error } = await supabaseAdmin.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: env.FRONTEND_ORIGIN },
  })
  if (!error) return

  if (isEmailRateLimit(error)) {
    throw new AppError('Bạn vừa yêu cầu gửi email. Vui lòng đợi khoảng 1 phút rồi thử lại.', 429)
  }
  throw new AppError('Không thể gửi email xác nhận: ' + error.message, 500)
}

export async function getUsernameChangeStatus(userId) {
  const { count, error } = await supabaseAdmin
    .from('username_changes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('changed_at', new Date(Date.now() - WEEK_MS).toISOString())
  if (error) {
    console.error('[auth] username history query failed', { code: error.code })
    throw new AppError('Không thể tải lịch sử đổi tên.', 503)
  }
  const recentCount = Number(count) || 0
  return { remaining: Math.max(0, MAX_CHANGES_PER_WEEK - recentCount), max: MAX_CHANGES_PER_WEEK, recentCount }
}

async function upsertProfile({ userId, username, email, isMember }) {
  const profilePayload = {
    id: userId,
    username,
    email,
    is_member: isMember === true,
  }

  const existingProfile = await findProfileById(userId)
  let profileError = null
  if (existingProfile) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        username,
        email,
        is_member: isMember === true,
      })
      .eq('id', userId)
    profileError = error
  } else {
    const { error } = await supabaseAdmin.from('profiles').insert([profilePayload])
    profileError = error
    if (profileError && /duplicate key|profiles_pkey/i.test(profileError.message || '')) {
      const { error: upErr } = await supabaseAdmin
        .from('profiles')
        .update({
          username,
          email,
          is_member: isMember === true,
        })
        .eq('id', userId)
      profileError = upErr
    }
  }

  if (profileError) {
    const still = await findProfileById(userId)
    if (!still) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
    }
    throw new AppError('Tạo hồ sơ thất bại. Vui lòng thử lại sau.', 503)
  }

  return findProfileById(userId)
}

async function createAuthUser({ email, password, emailConfirm, reuseExisting = true }) {
  let user = null
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: emailConfirm,
  })

  if (createError) {
    const msg = String(createError.message || '')
    if (reuseExisting && /already|registered|exists/i.test(msg)) {
      const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      })
      if (listErr) throw new AppError(createError.message || 'Không thể tạo tài khoản!', 400)
      const found = (listed?.users || []).find(
        (u) => String(u.email || '').toLowerCase() === email
      )
      if (!found) throw new AppError('Email này đã được sử dụng!', 400)
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: emailConfirm,
      })
      if (pwErr) throw new AppError('Email này đã được sử dụng!', 400)
      user = found
    } else {
      throw new AppError(createError.message || 'Không thể tạo tài khoản!', 400)
    }
  } else {
    user = created?.user
  }

  if (!user) throw new AppError('Không thể tạo tài khoản!')
  return user
}

async function registerGhostUser({ password, isMember, secretCode }) {
  if (isMember !== true || secretCode !== env.SECRET_CODE) {
    throw new AppError('Tài khoản ma chỉ đăng ký được với mã thành viên 10A4!')
  }

  const reservation = await callGhostRpc('ghost_reserve_account')
  const reservationId = reservation?.reservationId
  const index = Number(reservation?.index)
  if (!reservationId || !Number.isSafeInteger(index) || index < 1) {
    throw new AppError('Không thể giữ lượt đăng ký tài khoản ma.', 503)
  }

  let user = null
  let cleanEmail = ghostEmailFor(index)
  let profile = null
  try {
    user = await createAuthUser({ email: cleanEmail, password, emailConfirm: true, reuseExisting: false })
    profile = await upsertProfile({
      userId: user.id,
      username: pendingUsernameFor(user.id),
      email: cleanEmail,
      isMember: true,
    })
    await callGhostRpc('ghost_finalize_account', { p_reservation_id: reservationId, p_user_id: user.id })
  } catch (error) {
    if (user?.id) {
      await supabaseAdmin.from('profiles').delete().eq('id', user.id)
      await supabaseAdmin.auth.admin.deleteUser(user.id)
    }
    await callGhostRpc('ghost_rollback_account', { p_reservation_id: reservationId, p_user_id: user?.id || null })
      .catch((rollbackError) => console.error('[auth] ghost reservation rollback failed', { code: rollbackError?.statusCode || 'RPC_ERROR' }))
    throw error
  }

  const { data: signed, error: signError } = await supabaseAdmin.auth.signInWithPassword({ email: cleanEmail, password })
  if (signError || !signed?.session) {
    throw new AppError('Tạo tài khoản ma thành công nhưng không đăng nhập được. Hãy thử đăng nhập lại.')
  }
  return { email: cleanEmail, ghost: true, session: signed.session, profile: toPublicProfile(profile) }
}

export async function registerUser({
  username,
  email,
  password,
  isMember,
  secretCode,
}) {
  const cleanEmail = (email || '').trim().toLowerCase()
  if (!cleanEmail) throw new AppError('Vui lòng nhập email!')
  if (!password || password.length < 8) {
    throw new AppError('Mật khẩu phải có ít nhất 8 ký tự!')
  }

  if (isGhostEmail(cleanEmail)) {
    return registerGhostUser({ password, isMember, secretCode })
  }

  const cleanUsername = normalizeDisplayName(username)
  if (isMember === true && secretCode !== env.SECRET_CODE) {
    throw new AppError('Mã thành viên không chính xác!')
  }

  const existing = await findProfileByUsername(cleanUsername)
  if (existing) throw new AppError('Username này đã được sử dụng!')

  const user = await createAuthUser({
    email: cleanEmail,
    password,
    emailConfirm: false,
  })

  await upsertProfile({
    userId: user.id,
    username: cleanUsername,
    email: cleanEmail,
    isMember,
  })

  await sendSignupConfirmationEmail(cleanEmail)

  return { email: cleanEmail, ghost: false }
}

export async function resendConfirmation({ email }) {
  if (!email) throw new AppError('Thiếu email.')
  if (isGhostEmail(email)) {
    throw new AppError('Tài khoản ma không cần xác nhận email.')
  }
  await sendSignupConfirmationEmail(email)
}

export async function loginUser({ username, password }) {
  const cleanUsername = (username || '').trim()
  if (!cleanUsername) throw new AppError('Vui lòng nhập username!')
  if (!password) throw new AppError('Vui lòng nhập mật khẩu!')
  if (isPendingUsername(cleanUsername)) {
    throw new AppError('Username hoặc mật khẩu không chính xác!')
  }

  const byEmail = cleanUsername.includes('@')
  const profile = byEmail
    ? await findProfileByEmail(cleanUsername.toLowerCase())
    : await findProfileByUsername(cleanUsername)

  if (!profile?.email || (!byEmail && isPendingUsername(profile.username))) {
    throw new AppError('Username hoặc mật khẩu không chính xác!')
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(error?.message || '')) {
    throw new AppError('Email chưa được xác nhận. Hãy kiểm tra email và bấm vào liên kết xác nhận.')
  }
  if (error || !data?.user) {
    throw new AppError('Username hoặc mật khẩu không chính xác!')
  }

  return { session: data.session, profile: toPublicProfile(profile) }
}

function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@')
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`
}

/**
 * Quên mật khẩu: tìm email theo username/email rồi nhờ Supabase gửi
 * "Reset Password" email (chứa {{ .ConfirmationURL }}).
 * User bấm link -> về FRONTEND_ORIGIN -> Supabase phát PASSWORD_RECOVERY ->
 * frontend hiện form đặt mật khẩu mới và gọi supabase.auth.updateUser().
 * Backend không còn nhận/kiểm tra mã hay mật khẩu mới.
 */
export async function forgotPassword({ username }) {
  const cleanUsername = (username || '').trim()
  if (!cleanUsername) throw new AppError('Vui lòng nhập username!')
  if (isPendingUsername(cleanUsername)) {
    throw new AppError('Không tìm thấy tài khoản!')
  }

  const byEmail = cleanUsername.includes('@')
  const profile = byEmail
    ? await findProfileByEmail(cleanUsername.toLowerCase())
    : await findProfileByUsername(cleanUsername)

  if (!profile?.email || isPendingUsername(profile.username)) {
    throw new AppError('Không tìm thấy tài khoản!')
  }
  if (isGhostEmail(profile.email)) {
    throw new AppError('Tài khoản ma không dùng được quên mật khẩu. Hãy nhờ admin hỗ trợ.')
  }

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(profile.email, {
    redirectTo: env.FRONTEND_ORIGIN,
  })

  if (error) {
    if (isEmailRateLimit(error)) {
      throw new AppError('Bạn vừa yêu cầu gửi email. Vui lòng đợi khoảng 1 phút rồi thử lại.', 429)
    }
    throw new AppError('Không thể gửi email đặt lại mật khẩu: ' + error.message, 500)
  }

  // Chỉ trả email đã che để tránh lộ email đầy đủ của tài khoản qua username.
  return { email: maskEmail(profile.email) }
}

export async function setDisplayName(userId, rawName, { countAsChange = false, skipLimit = false } = {}) {
  const cleanUsername = normalizeDisplayName(rawName)
  const existing = await findProfileByUsername(cleanUsername)
  if (existing && existing.id !== userId) {
    throw new AppError('Tên hiển thị này đã được sử dụng!')
  }

  const current = await findProfileById(userId)
  if (!current) throw new AppError('Không tìm thấy hồ sơ.', 404)

  const wasPending = isPendingUsername(current.username)
  // Đổi tên sau lần đặt tên đầu: giới hạn 2 lần / 7 ngày
  // skipLimit = true khi admin đổi tên hộ → không check / không ghi hạn mức
  if (!skipLimit && (countAsChange || !wasPending)) {
    if (!wasPending) {
      const status = await getUsernameChangeStatus(userId)
      if (status.remaining <= 0) {
        throw new AppError('Bạn chỉ được đổi tên tối đa 2 lần trong 1 tuần.')
      }
    }
  }

  const recordChange = !skipLimit && !wasPending
  const { data, error } = await supabaseAdmin.rpc('change_display_name', {
    p_user_id: userId,
    p_username: cleanUsername,
    p_record_change: recordChange,
  })

  if (error) {
    const message = String(error.message || '')
    if (message.includes('USERNAME_WEEKLY_LIMIT')) {
      throw new AppError('Bạn chỉ được đổi tên tối đa 2 lần trong 1 tuần.')
    }
    if (error.code === '23505' || /duplicate key|unique constraint/i.test(message)) {
      throw new AppError('Tên hiển thị này đã được sử dụng!')
    }
    if (error.code === 'P0002') throw new AppError('Không tìm thấy hồ sơ.', 404)
    console.error('[auth] display name update failed', { code: error.code })
    throw new AppError('Không thể lưu tên hiển thị.', 503)
  }
  const updated = Array.isArray(data) ? data[0] : data
  if (!updated) throw new AppError('Không tìm thấy hồ sơ.', 404)
  return toPublicProfile(updated)
}

async function ensureProfile(user) {
  const email = user.email || ''
  const placeholder = pendingUsernameFor(user.id)

  const { data: created, error } = await supabaseAdmin
    .from('profiles')
    .insert([
      {
        id: user.id,
        username: placeholder,
        email,
        is_member: false,
      },
    ])
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) {
    const existing = await findProfileById(user.id)
    if (existing) return existing
    throw new AppError('Không thể khởi tạo hồ sơ người dùng: ' + error.message, 500)
  }

  return created
}

/**
 * Google OAuth đôi khi ghi sẵn full_name / email làm username qua trigger.
 * Chỉ ép về pending:… **một lần** ngay sau khi hồ sơ mới tạo.
 *
 * Guard cứng (tránh hiện form tên lại sau khi user/admin đã đặt tên):
 * 1. Hồ sơ đã tồn tại > 30 giây → không bao giờ reset.
 * 2. updated_at lệch created_at > 1s → coi như đã qua bước đặt/đổi tên.
 * 3. Chỉ reset khi username vẫn "trông như" tên auto từ Google metadata.
 *
 * setDisplayName luôn ghi updated_at tường minh để guard (2) hoạt động.
 */
async function forcePendingIfAutoNamed(user, profile) {
  if (!profile || isPendingUsername(profile.username)) return profile

  const isGoogle = (user.identities || []).some((i) => i.provider === 'google')
  if (!isGoogle) return profile

  const createdMs = Date.parse(profile.created_at || '')
  const updatedMs = Date.parse(profile.updated_at || profile.created_at || '')
  const now = Date.now()

  // Hồ sơ đã cũ (>30s) → chắc chắn đã qua bước đặt tên / admin rename
  if (Number.isFinite(createdMs) && now - createdMs > 30 * 1000) {
    return profile
  }

  // Hồ sơ đã được cập nhật sau lúc tạo (>1s) → đã đặt/đổi tên (user hoặc admin)
  if (
    Number.isFinite(createdMs) &&
    Number.isFinite(updatedMs) &&
    updatedMs - createdMs > 1000
  ) {
    return profile
  }

  const metaName = String(
    user.user_metadata?.full_name || user.user_metadata?.name || ''
  ).trim()
  const emailLocal = String(user.email || '').split('@')[0]
  const uname = String(profile.username || '').trim()

  const looksAuto =
    (metaName && uname === metaName) ||
    (emailLocal && uname === emailLocal) ||
    (user.email && uname === user.email)

  if (!looksAuto) return profile

  const placeholder = pendingUsernameFor(user.id)
  const { data: updated, error } = await supabaseAdmin
    .from('profiles')
    .update({
      username: placeholder,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error || !updated) return profile
  return updated
}

const AUTH_USER_CACHE_TTL_MS = 60 * 1000
const AUTH_USER_CACHE_MAX = 400
const authUserCache = new Map()
const authUserInflight = new Map()

function getCachedAuthUser(token) {
  const hit = authUserCache.get(token)
  if (!hit) return null
  if (hit.exp <= Date.now()) {
    authUserCache.delete(token)
    return null
  }
  return hit.user
}

function setCachedAuthUser(token, user) {
  authUserCache.set(token, { user, exp: Date.now() + AUTH_USER_CACHE_TTL_MS })
  if (authUserCache.size <= AUTH_USER_CACHE_MAX) return
  const now = Date.now()
  for (const [key, val] of authUserCache) {
    if (val.exp <= now) authUserCache.delete(key)
  }
  while (authUserCache.size > AUTH_USER_CACHE_MAX) {
    const oldest = authUserCache.keys().next().value
    if (oldest === undefined) break
    authUserCache.delete(oldest)
  }
}

async function getAuthUserByAccessToken(accessToken) {
  const cached = getCachedAuthUser(accessToken)
  if (cached) return cached

  const pending = authUserInflight.get(accessToken)
  if (pending) return pending

  const task = (async () => {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
    if (error || !data?.user) return null
    setCachedAuthUser(accessToken, data.user)
    return data.user
  })()

  authUserInflight.set(accessToken, task)
  try {
    return await task
  } finally {
    authUserInflight.delete(accessToken)
  }
}

async function getProfileForUser(user) {
  const existing = profileInflight.get(user.id)
  if (existing) return existing

  const task = (async () => {
    let profile = await findProfileById(user.id)
    if (!profile) profile = await ensureProfile(user)
    else profile = await forcePendingIfAutoNamed(user, profile)
    return profile
  })()
  profileInflight.set(user.id, task)
  try {
    return await task
  } finally {
    profileInflight.delete(user.id)
  }
}

export async function getUserFromAccessToken(accessToken) {
  const user = await getAuthUserByAccessToken(accessToken)
  if (!user) return null

  const profile = await getProfileForUser(user)
  return { user, profile }
}


const PASSWORD_RULE_RE = /^(?=.*[A-Z])(?=.*\d).{8,}$/

/** Đổi mật khẩu khi đã đăng nhập: kiểm tra mật khẩu hiện tại rồi mới đặt mật khẩu mới. */
export async function changePassword(profile, { currentPassword, newPassword }) {
  if (!currentPassword) throw new AppError('Vui lòng nhập mật khẩu hiện tại.')
  if (!PASSWORD_RULE_RE.test(String(newPassword || ''))) {
    throw new AppError('Mật khẩu mới cần có ít nhất 1 chữ hoa, 1 số, độ dài tối thiểu 8 ký tự.')
  }
  if (newPassword === currentPassword) throw new AppError('Mật khẩu mới phải khác mật khẩu hiện tại.')
  if (!profile?.email) throw new AppError('Tài khoản không có email để xác thực.', 400)

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email: profile.email, password: currentPassword })
  if (error || !data?.user || data.user.id !== profile.id) {
    throw new AppError('Mật khẩu hiện tại không đúng.', 400)
  }
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password: newPassword })
  if (updateError) {
    console.error('[auth] change password failed', updateError.message)
    throw new AppError('Không thể đổi mật khẩu. Thử lại sau.', 503)
  }
}
