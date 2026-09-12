import { apiClient, saveAccessToken } from './apiClient.js'
import { supabase } from '../lib/supabaseClient.js'

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
  await supabase.auth.signOut()
}

async function applySession(session) {
  saveAccessToken(session.access_token)

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
}
