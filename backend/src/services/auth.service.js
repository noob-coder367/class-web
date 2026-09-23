import { supabaseAdmin } from '../config/supabaseClient.js'
import { readJsonFile } from '../utils/classroomDataStore.js'
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
const DATA_BUCKET = 'classroom-data'
const USERNAME_CHANGES_PATH = 'username-changes.json'
const GHOST_STATE_PATH = 'ghost-accounts.json'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CHANGES_PER_WEEK = 2
const GHOST_EMAIL_PREFIX = 'taikhoanma-'
const GHOST_EMAIL_DOMAIN = 'ghost.com'
export const GHOST_DAILY_LIMIT = 2

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

async function readUsernameChanges() {
  await ensureDataBucket()
  const parsed = await readJsonFile({ bucket: DATA_BUCKET, path: USERNAME_CHANGES_PATH, empty: {}, label: 'lịch sử đổi tên' })
  return parsed && typeof parsed === 'object' ? parsed : {}
}

async function writeUsernameChanges(map) {
  const { data: bucket } = await supabaseAdmin.storage.getBucket(DATA_BUCKET)
  if (!bucket) {
    await supabaseAdmin.storage.createBucket(DATA_BUCKET, { public: false, fileSizeLimit: 2 * 1024 * 1024 })
  }
  const body = Buffer.from(JSON.stringify(map, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(DATA_BUCKET).upload(USERNAME_CHANGES_PATH, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw new AppError('Không lưu được lịch sử đổi tên: ' + error.message, 502)
}

async function ensureDataBucket() {
  const { data: bucket, error } =
    await supabaseAdmin.storage.getBucket(DATA_BUCKET)

  if (error || !bucket) {
    throw new AppError(
      `Kho dữ liệu "${DATA_BUCKET}" chưa được cấu hình trên Supabase.`,
      500
    )
  }
}

async function readGhostState() {
  await ensureDataBucket()
  const parsed = await readJsonFile({ bucket: DATA_BUCKET, path: GHOST_STATE_PATH, empty: { nextIndex: 1, created: [] }, label: 'bộ đếm tài khoản ma' })
  const nextIndex = Math.max(1, Number(parsed?.nextIndex) || 1)
  const created = Array.isArray(parsed?.created) ? parsed.created : []
  return { nextIndex, created }
}

async function writeGhostState(state) {
  await ensureDataBucket()
  const body = Buffer.from(JSON.stringify(state, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(DATA_BUCKET).upload(GHOST_STATE_PATH, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw new AppError('Không lưu được bộ đếm tài khoản ma: ' + error.message, 502)
}

function remainingGhostToday(created) {
  const today = vietnamDayKey()
  const used = (created || []).filter((item) => vietnamDayKey(Number(item?.at) || 0) === today).length
  return Math.max(0, GHOST_DAILY_LIMIT - used)
}

let ghostLock = Promise.resolve()
function withGhostLock(fn) {
  const run = ghostLock.then(fn, fn)
  ghostLock = run.then(() => undefined, () => undefined)
  return run
}

export async function previewGhostAccount() {
  const state = await readGhostState()
  const remainingToday = remainingGhostToday(state.created)
  return {
    email: remainingToday > 0 ? ghostEmailFor(state.nextIndex) : null,
    nextIndex: state.nextIndex,
    remainingToday,
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
  const map = await readUsernameChanges()
  const list = Array.isArray(map[userId]) ? map[userId] : []
  const weekAgo = Date.now() - WEEK_MS
  const recent = list.filter((t) => Number(t) > weekAgo)
  return {
    remaining: Math.max(0, MAX_CHANGES_PER_WEEK - recent.length),
    max: MAX_CHANGES_PER_WEEK,
    recentCount: recent.length,
  }
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
    throw new AppError('Tạo hồ sơ thất bại: ' + profileError.message, 500)
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

  return withGhostLock(async () => {
    const state = await readGhostState()
    const remainingToday = remainingGhostToday(state.created)
    if (remainingToday <= 0) {
      throw new AppError('Hôm nay đã hết lượt tài khoản ma (tối đa 2 tài khoản/ngày trên toàn hệ thống).')
    }

    const index = state.nextIndex
    const cleanEmail = ghostEmailFor(index)

    // Seed tăng ngay, kể cả khi tạo user thất bại / xóa / đăng xuất sau này.
    const nextState = {
      nextIndex: index + 1,
      created: state.created,
    }
    await writeGhostState(nextState)

    const user = await createAuthUser({
      email: cleanEmail,
      password,
      emailConfirm: true,
      reuseExisting: false,
    })

    const profile = await upsertProfile({
      userId: user.id,
      username: pendingUsernameFor(user.id),
      email: cleanEmail,
      isMember: true,
    })

    nextState.created = [
      ...state.created,
      { index, at: Date.now(), userId: user.id },
    ]
    await writeGhostState(nextState)

    const { data: signed, error: signError } = await supabaseAdmin.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })
    if (signError || !signed?.session) {
      throw new AppError('Tạo tài khoản ma thành công nhưng không đăng nhập được. Hãy thử đăng nhập lại.')
    }

    return {
      email: cleanEmail,
      ghost: true,
      session: signed.session,
      profile: toPublicProfile(profile),
    }
  })
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

  // Luôn ghi updated_at tường minh — tránh forcePendingIfAutoNamed
  // reset lại tên sau khi user/admin đã đặt (nếu DB không có trigger updated_at).
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      username: cleanUsername,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) {
    throw new AppError('Không thể lưu tên hiển thị: ' + error.message, 500)
  }
  if (!data) throw new AppError('Không tìm thấy hồ sơ.', 404)

  // Chỉ ghi lịch sử đổi tên khi user tự đổi (không phải admin) và không phải lần đặt tên đầu
  if (!skipLimit && !wasPending) {
    const map = await readUsernameChanges()
    const weekAgo = Date.now() - WEEK_MS
    const recent = (Array.isArray(map[userId]) ? map[userId] : []).filter((t) => Number(t) > weekAgo)
    map[userId] = [...recent, Date.now()]
    await writeUsernameChanges(map)
  }

  return toPublicProfile(data)
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

export async function getUserFromAccessToken(accessToken) {
  const user = await getAuthUserByAccessToken(accessToken)
  if (!user) return null

  let profile = await findProfileById(user.id)
  if (!profile) {
    profile = await ensureProfile(user)
  } else {
    profile = await forcePendingIfAutoNamed(user, profile)
  }
  return { user, profile }
}
