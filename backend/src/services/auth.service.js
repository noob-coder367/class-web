import { supabaseAdmin } from '../config/supabaseClient.js'
import { env } from '../config/env.js'

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const PENDING_USERNAME_PREFIX = 'pending:'
const PROFILE_COLUMNS = 'id, username, email, is_member, role, created_at'
const DATA_BUCKET = 'classroom-data'
const USERNAME_CHANGES_PATH = 'username-changes.json'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CHANGES_PER_WEEK = 2

export function isPendingUsername(username) {
  return !username || String(username).startsWith(PENDING_USERNAME_PREFIX)
}

export function pendingUsernameFor(userId) {
  return `${PENDING_USERNAME_PREFIX}${userId}`
}

export function toPublicProfile(profile) {
  if (!profile) return null
  const pending = isPendingUsername(profile.username)
  return {
    id: profile.id,
    username: pending ? '' : profile.username,
    email: profile.email,
    is_member: profile.is_member,
    role: profile.role,
    created_at: profile.created_at,
    needs_display_name: pending,
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
  const { data, error } = await supabaseAdmin.storage.from(DATA_BUCKET).download(USERNAME_CHANGES_PATH)
  if (error || !data) return {}
  try {
    const text = await data.text()
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
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

export async function registerUser({
  username,
  email,
  password,
  isMember,
  secretCode,
}) {
  const cleanUsername = normalizeDisplayName(username)
  const cleanEmail = (email || '').trim().toLowerCase()

  if (!cleanEmail) throw new AppError('Vui lòng nhập email!')
  if (!password || password.length < 8) {
    throw new AppError('Mật khẩu phải có ít nhất 8 ký tự!')
  }
  if (isMember === true && secretCode !== env.SECRET_CODE) {
    throw new AppError('Mã thành viên không chính xác!')
  }

  const existing = await findProfileByUsername(cleanUsername)
  if (existing) throw new AppError('Username này đã được sử dụng!')

  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: false,
    })

  if (createError) {
    throw new AppError(createError.message || 'Không thể tạo tài khoản!', 400)
  }

  const user = created?.user
  if (!user) throw new AppError('Không thể tạo tài khoản!')

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert([
      {
        id: user.id,
        username: cleanUsername,
        email: cleanEmail,
        is_member: isMember === true,
      },
    ])

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(user.id)
    throw new AppError(
      'Tạo hồ sơ thất bại: ' + profileError.message,
      500
    )
  }

  const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: false },
  })

  if (otpError) {
    throw new AppError(
      'Không thể gửi mã xác nhận: ' + otpError.message,
      500
    )
  }

  return { email: cleanEmail }
}

export async function verifyOtp({ email, otp, purpose }) {
  if (!email) throw new AppError('Thiếu email.')
  if (!otp || otp.length !== 6) throw new AppError('Vui lòng nhập đủ 6 số!')

  const { data, error } = await supabaseAdmin.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  })

  if (error || !data?.user) {
    throw new AppError('Mã xác nhận không đúng hoặc đã hết hạn!')
  }

  if (purpose === 'register') {
    const profile = await findProfileById(data.user.id)
    return { profile: toPublicProfile(profile), session: data.session }
  }

  return { profile: null, session: data.session }
}

export async function resendOtp({ email }) {
  if (!email) throw new AppError('Thiếu email.')

  const { error } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })

  if (error) {
    throw new AppError('Không thể gửi lại mã: ' + error.message, 500)
  }
}

export async function loginUser({ username, password }) {
  const cleanUsername = (username || '').trim()
  if (!cleanUsername) throw new AppError('Vui lòng nhập username!')
  if (!password) throw new AppError('Vui lòng nhập mật khẩu!')
  if (isPendingUsername(cleanUsername)) {
    throw new AppError('Username hoặc mật khẩu không chính xác!')
  }

  const profile = await findProfileByUsername(cleanUsername)
  if (!profile?.email || isPendingUsername(profile.username)) {
    throw new AppError('Username hoặc mật khẩu không chính xác!')
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (error || !data?.user) {
    throw new AppError('Username hoặc mật khẩu không chính xác!')
  }

  return { session: data.session, profile: toPublicProfile(profile) }
}

export async function forgotPassword({ username }) {
  const cleanUsername = (username || '').trim()
  if (!cleanUsername) throw new AppError('Vui lòng nhập username!')
  if (isPendingUsername(cleanUsername)) {
    throw new AppError('Không tìm thấy tài khoản!')
  }

  const profile = await findProfileByUsername(cleanUsername)
  if (!profile?.email || isPendingUsername(profile.username)) {
    throw new AppError('Không tìm thấy tài khoản!')
  }

  const { error } = await supabaseAdmin.auth.signInWithOtp({
    email: profile.email,
    options: { shouldCreateUser: false },
  })

  if (error) {
    throw new AppError('Không thể gửi mã: ' + error.message, 500)
  }

  return { email: profile.email }
}

export async function resetPassword({ email, otp, newPassword }) {
  if (!newPassword || newPassword.length < 8) {
    throw new AppError('Mật khẩu mới phải có ít nhất 8 ký tự!')
  }

  const { data: verifyData, error: verifyError } =
    await supabaseAdmin.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

  if (verifyError || !verifyData?.user) {
    throw new AppError('Mã xác nhận không đúng hoặc đã hết hạn!')
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    verifyData.user.id,
    { password: newPassword }
  )

  if (updateError) {
    throw new AppError(
      'Không thể đổi mật khẩu: ' + updateError.message,
      500
    )
  }
}

export async function setDisplayName(userId, rawName, { countAsChange = false } = {}) {
  const cleanUsername = normalizeDisplayName(rawName)
  const existing = await findProfileByUsername(cleanUsername)
  if (existing && existing.id !== userId) {
    throw new AppError('Tên hiển thị này đã được sử dụng!')
  }

  const current = await findProfileById(userId)
  if (!current) throw new AppError('Không tìm thấy hồ sơ.', 404)

  const wasPending = isPendingUsername(current.username)
  // Đổi tên sau lần đặt tên đầu: giới hạn 2 lần / 7 ngày
  if (countAsChange || !wasPending) {
    if (!wasPending) {
      const status = await getUsernameChangeStatus(userId)
      if (status.remaining <= 0) {
        throw new AppError('Bạn chỉ được đổi tên tối đa 2 lần trong 1 tuần.')
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ username: cleanUsername })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) {
    throw new AppError('Không thể lưu tên hiển thị: ' + error.message, 500)
  }
  if (!data) throw new AppError('Không tìm thấy hồ sơ.', 404)

  if (!wasPending) {
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

async function forcePendingIfAutoNamed(user, profile) {
  if (!profile || isPendingUsername(profile.username)) return profile

  const isGoogle = (user.identities || []).some((i) => i.provider === 'google')
  if (!isGoogle) return profile

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
    .update({ username: placeholder })
    .eq('id', user.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error || !updated) return profile
  return updated
}

export async function getUserFromAccessToken(accessToken) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data?.user) return null

  let profile = await findProfileById(data.user.id)
  if (!profile) {
    profile = await ensureProfile(data.user)
  } else {
    profile = await forcePendingIfAutoNamed(data.user, profile)
  }
  return { user: data.user, profile }
}
