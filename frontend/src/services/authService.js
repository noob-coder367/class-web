import { apiClient, saveAccessToken, setSessionSnapshot } from './apiClient.js'
import { supabase } from '../lib/supabaseClient.js'

export async function register({ displayName, email, password }) {
  return apiClient.post('/auth/register', { displayName, email, password })
}

export async function login({ email, password }) {
  const result = await apiClient.post('/auth/login', { email, password })
  if (result.session) await applySession(result.session)
  return result
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
