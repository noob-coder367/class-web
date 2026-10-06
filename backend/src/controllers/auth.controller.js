import * as authService from '../services/auth.service.js'

export async function register(req, res, next) {
  try {
    const result = await authService.registerUser(req.body || {})
    res.status(201).json({
      message: `Tài khoản đã tạo. Hãy mở email ${result.email} để xác nhận đăng ký.`,
      email: result.email,
    })
  } catch (error) {
    next(error)
  }
}

export async function login(req, res, next) {
  try {
    const result = await authService.loginUser(req.body || {})
    res.json({
      message: 'Đăng nhập thành công.',
      session: result.session,
      profile: result.profile,
    })
  } catch (error) {
    next(error)
  }
}

export function me(req, res) {
  res.json({ profile: authService.toPublicProfile(req.profile, req.user) })
}
