import { apiClient, saveAccessToken, setSessionSnapshot } from './apiClient.js'
import { clearClassroomCache } from './classroomService.js'
import { supabase } from '../lib/supabaseClient.js'

export async function register({ username, email, password, isMember, secretCode }) {
  const data = await apiClient.post('/auth/register', {
    username,
    email,
    password,
    isMember,
    secretCode,
  })

  if (data.session) {
    await applySession(data.session)
  }

  return data
}

export async function previewGhostAccount() {
  return apiClient.get('/auth/ghost-preview')
}

export async function resendConfirmation({ email }) {
  return apiClient.post('/auth/resend-confirmation', { email })
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

/**
 * Đặt mật khẩu mới sau khi user bấm link trong email đặt lại mật khẩu.
 * Lúc này Supabase đã tạo session khôi phục (sự kiện PASSWORD_RECOVERY)
 * nên updateUser() chỉ đổi được mật khẩu của chính user đó.
 */
export async function updatePassword({ newPassword }) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function fetchMe() {
  return apiClient.get('/auth/me', { auth: true })
}

export async function setDisplayName({ username }) {
  return apiClient.post('/auth/display-name', { username }, { auth: true })
}

export async function changeUsername({ username }) {
  return apiClient.post('/auth/change-username', { username }, { auth: true })
}

export async function getUsernameChangeStatus() {
  return apiClient.get('/auth/username-change-status', { auth: true })
}

export async function logout() {
  saveAccessToken(null)
  setSessionSnapshot(null)
  clearClassroomCache()
  await supabase.auth.signOut()
}

async function applySession(session) {
  setSessionSnapshot(session)

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
}
