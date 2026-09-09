import { supabaseAdmin } from '../config/supabaseClient.js'
import { env } from '../config/env.js'

/**
 * Toàn bộ logic "nhạy cảm" của luồng Auth trước đây nằm ở frontend
 * (App.jsx) được chuyển vào đây:
 *  - Kiểm tra SECRET_CODE để duyệt "Thành viên 10A4"
 *  - Tạo user Supabase Auth bằng quyền admin
 *  - Gửi / xác thực OTP
 *  - Đăng nhập bằng username (tra email) + mật khẩu
 *  - Đổi mật khẩu
 *  - Đặt tên hiển thị cho user Google lần đầu
 */

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const PENDING_USERNAME_PREFIX = 'pending:'
const PROFILE_COLUMNS = 'id, username, email, is_member, role, created_at'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

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
    // Kiểm tra mã thành viên CHỈ diễn ra ở server.
    throw new AppError('Mã thành viên không chính xác!')
  }

  const existing = await findProfileByUsername(cleanUsername)
  if (existing) throw new AppError('Username này đã được sử dụng!')

  // Tạo user bằng quyền admin, chưa xác nhận email (sẽ xác nhận bằng OTP).
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
        is_member: isMember === true, // chỉ true nếu secretCode hợp lệ (đã kiểm tra ở trên)
      },
    ])

  if (profileError) {
    // Dọn lại user Auth vừa tạo để tránh rác tài khoản không có hồ sơ.
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

// ---------------------------------------------------------------------------
// OTP: verify / resend
// ---------------------------------------------------------------------------

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

  // purpose === 'reset' -> chỉ cần xác nhận OTP hợp lệ, trả về session tạm
  // để bước đổi mật khẩu kế tiếp có quyền cập nhật đúng user.
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

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Forgot / Reset password
// ---------------------------------------------------------------------------

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

  // Xác thực lại OTP ngay trước khi đổi mật khẩu để chắc chắn
  // request này thực sự thuộc về chủ tài khoản.
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

// ---------------------------------------------------------------------------
// Display name (Google lần đầu + Admin đổi tên)
// ---------------------------------------------------------------------------

export async function setDisplayName(userId, rawName) {
  const cleanUsername = normalizeDisplayName(rawName)
  const existing = await findProfileByUsername(cleanUsername)
  if (existing && existing.id !== userId) {
    throw new AppError('Tên hiển thị này đã được sử dụng!')
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
  return toPublicProfile(data)
}

// ---------------------------------------------------------------------------
// Current user (dùng bởi middleware auth)
// ---------------------------------------------------------------------------

/**
 * Đăng ký bằng username/password (registerUser) là nơi DUY NHẤT từng
 * tạo profile có tên hiển thị thật. Đăng nhập Google (OAuth) chỉ tạo
 * user bên auth.users — nếu chưa có profile, tạo 1 hồ sơ tạm
 * (username = pending:<id>) để:
 *  - user xuất hiện ngay trong Quản lý Admin ("Chưa đặt tên")
 *  - frontend bắt buộc hiện bảng nhập TÊN HIỂN THỊ trước khi dùng tiếp
 */
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
    // Có thể do đụng username trùng, hoặc race condition (2 request cùng
    // lúc cùng tạo). Thử đọc lại profile trước khi báo lỗi hẳn.
    const existing = await findProfileById(user.id)
    if (existing) return existing
    throw new AppError('Không thể khởi tạo hồ sơ người dùng: ' + error.message, 500)
  }

  return created
}

/**
 * Nếu profile đã tồn tại nhưng username bị trigger DB / Google metadata
 * tự gán (full_name, email local-part...), ta ép về pending để frontend
 * vẫn hiện bảng nhập Tên hiển thị (đặc biệt sau khi admin xóa rồi login lại).
 */
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
