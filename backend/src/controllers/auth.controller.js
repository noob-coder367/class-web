import * as authService from '../services/auth.service.js'

export async function register(req, res, next) {
  try {
    const { username, email, password, isMember, secretCode } = req.body
    const result = await authService.registerUser({
      username,
      email,
      password,
      isMember,
      secretCode,
    })
    res.status(201).json({
      message: 'Đăng ký thành công, vui lòng kiểm tra email để lấy mã OTP.',
      email: result.email,
    })
  } catch (err) {
    next(err)
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { email, otp, purpose } = req.body
    const result = await authService.verifyOtp({ email, otp, purpose })
    res.json({
      message: 'Xác nhận thành công.',
      profile: result.profile,
      session: result.session,
    })
  } catch (err) {
    next(err)
  }
}

export async function resendOtp(req, res, next) {
  try {
    const { email } = req.body
    await authService.resendOtp({ email })
    res.json({ message: 'Mã mới đã được gửi.' })
  } catch (err) {
    next(err)
  }
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body
    const result = await authService.loginUser({ username, password })
    res.json({
      message: 'Đăng nhập thành công.',
      session: result.session,
      profile: result.profile,
    })
  } catch (err) {
    next(err)
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { username } = req.body
    const result = await authService.forgotPassword({ username })
    res.json({ message: 'Đã gửi mã xác nhận.', email: result.email })
  } catch (err) {
    next(err)
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body
    await authService.resetPassword({ email, otp, newPassword })
    res.json({ message: 'Đổi mật khẩu thành công.' })
  } catch (err) {
    next(err)
  }
}

export async function me(req, res) {
  // req.profile được gắn sẵn bởi middleware requireAuth
  res.json({ profile: req.profile })
}
