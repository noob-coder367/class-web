import { apiClient, saveAccessToken } from './apiClient.js'
import { supabase } from '../lib/supabaseClient.js'

/**
 * Mọi hàm ở đây gọi sang backend (KHÔNG còn kiểm tra SECRET_CODE,
 * KHÔNG còn gọi supabase.auth.signUp/signInWithPassword/verifyOtp
 * trực tiếp từ frontend nữa).
 */

export async function register({ username, email, password, isMember, secretCode }) {
  return apiClient.post('/auth/register', {
    username,
    email,
    password,
    isMember,
    secretCode,
  })
}

export async function verifyOtp({ email, otp, purpose }) {
  const data = await apiClient.post('/auth/verify-otp', { email, otp, purpose })

  if (data.session) {
    await applySession(data.session)
  }

  return data
}

export async function resendOtp({ email }) {
  return apiClient.post('/auth/resend-otp', { email })
}

export async function login({ username, password }) {
  const data = await apiClient.post('/auth/login', { username, password })

  if (data.session) {
    await applySession(data.session)
  }

  return data
}

export async function forgotPassword({ username }) {
  return apiClient.post('/auth/forgot-password', { username })
}

export async function resetPassword({ email, otp, newPassword }) {
  return apiClient.post('/auth/reset-password', { email, otp, newPassword })
}

export async function fetchMe() {
  return apiClient.get('/auth/me', { auth: true })
}

export async function logout() {
  saveAccessToken(null)
  await supabase.auth.signOut()
}

/**
 * Sau khi backend xác thực thành công, nó trả về session thật của
 * Supabase (access_token/refresh_token). Ta nạp session này vào
 * client Supabase (anon key) của frontend để các truy vấn public
 * (announcements, events, realtime) tiếp tục hoạt động đúng theo
 * RLS của người dùng đang đăng nhập.
 */
async function applySession(session) {
  saveAccessToken(session.access_token)

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
}
