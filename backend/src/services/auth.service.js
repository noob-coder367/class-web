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
 */

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findProfileByUsername(username) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, email, is_member, role')
    .eq('username', username.trim())
    .maybeSingle()

  if (error) throw new AppError('Lỗi truy vấn tài khoản.', 500)
  return data
}

async function findProfileById(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, email, is_member, role')
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
  const cleanUsername = (username || '').trim()
  const cleanEmail = (email || '').trim().toLowerCase()

  if (!cleanUsername) throw new AppError('Vui lòng nhập username!')
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
    return { profile, session: data.session }
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

  const profile = await findProfileByUsername(cleanUsername)
  if (!profile?.email) {
    throw new AppError('Username hoặc mật khẩu không chính xác!')
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (error || !data?.user) {
    throw new AppError('Username hoặc mật khẩu không chính xác!')
  }

  return { session: data.session, profile }
}

// ---------------------------------------------------------------------------
// Forgot / Reset password
// ---------------------------------------------------------------------------

export async function forgotPassword({ username }) {
  const cleanUsername = (username || '').trim()
  if (!cleanUsername) throw new AppError('Vui lòng nhập username!')

  const profile = await findProfileByUsername(cleanUsername)
  if (!profile?.email) throw new AppError('Không tìm thấy tài khoản!')

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
// Current user (dùng bởi middleware auth)
// ---------------------------------------------------------------------------

/**
 * Đăng ký bằng username/password (registerUser) là nơi DUY NHẤT từng tạo
 * dòng trong bảng `profiles`. Đăng nhập Google (OAuth) chỉ tạo user bên
 * auth.users, KHÔNG tạo profile tương ứng -> mọi user Google lần đầu sẽ
 * không có profile -> bị coi là "Phiên đăng nhập không hợp lệ" ở mọi API
 * cần đăng nhập (không riêng admin).
 *
 * Sửa: nếu access_token hợp lệ (user có thật trong auth.users) nhưng
 * chưa có profile, tự tạo 1 profile mặc định (role thường, chưa là
 * thành viên 10A4) thay vì từ chối thẳng.
 */
async function ensureProfile(user) {
  const email = user.email || ''
  const fallbackUsername =
    (email.split('@')[0] || `user_${user.id.slice(0, 8)}`).trim() ||
    `user_${user.id.slice(0, 8)}`

  const { data: created, error } = await supabaseAdmin
    .from('profiles')
    .insert([
      {
        id: user.id,
        username: fallbackUsername,
        email,
        is_member: false,
      },
    ])
    .select('id, username, email, is_member, role')
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

export async function getUserFromAccessToken(accessToken) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data?.user) return null

  let profile = await findProfileById(data.user.id)
  if (!profile) {
    profile = await ensureProfile(data.user)
  }
  return { user: data.user, profile }
}
