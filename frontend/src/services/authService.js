import { apiClient, saveAccessToken, setSessionSnapshot } from './apiClient.js'
import { supabase } from '../lib/supabaseClient.js'

const OAUTH_PENDING_KEY = 'quizly:oauth_pending'
const OAUTH_PENDING_TTL_MS = 10 * 60 * 1000

export async function register({ displayName, email, password, ghost = false, secretCode = '' }) {
  const result = await apiClient.post('/auth/register', { displayName, email, password, ghost, secretCode })
  if (result.session) await applySession(result.session)
  return result
}

export async function previewGhostAccount() {
  return apiClient.get('/auth/ghost-preview')
}

export async function login({ displayName, password }) {
  clearOAuthPending()
  const result = await apiClient.post('/auth/login', { displayName, password })
  if (result.session) await applySession(result.session)
  return result
}

/** Đăng nhập Google qua Supabase OAuth. Trình duyệt sẽ chuyển sang Google rồi quay về trang chủ. */
export async function signInWithGoogle() {
  try {
    sessionStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()))
  } catch {
    /* sessionStorage không khả dụng: chỉ mất toast thành công */
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'select_account' } },
  })
  if (error) {
    clearOAuthPending()
    throw error
  }
}

/** true nếu vừa quay về từ luồng Google (dùng 1 lần, hết hạn sau 10 phút). */
export function consumeOAuthPending() {
  try {
    const startedAt = Number(sessionStorage.getItem(OAUTH_PENDING_KEY))
    sessionStorage.removeItem(OAUTH_PENDING_KEY)
    return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < OAUTH_PENDING_TTL_MS
  } catch {
    return false
  }
}

function clearOAuthPending() {
  try {
    sessionStorage.removeItem(OAUTH_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export async function fetchMe() {
  return apiClient.get('/auth/me', { auth: true })
}

export async function logout() {
  saveAccessToken(null)
  setSessionSnapshot(null)
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

async function applySession(session) {
  setSessionSnapshot(session)
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) throw error
}
