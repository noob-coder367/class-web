import { supabase } from '../lib/supabaseClient.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

const ACCESS_TOKEN_KEY = 'class-web:access_token'

export function saveAccessToken(token) {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/**
 * Supabase tự refresh access_token ngầm.
 * Trước mỗi request cần auth: lấy token mới nhất từ getSession().
 */
async function getFreshAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token || null
  saveAccessToken(token)
  return token
}

async function request(path, { method = 'GET', body, auth = false, _retried = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  if (auth) {
    const token = await getFreshAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // no JSON body
  }

  // 401 + auth → thử refresh 1 lần rồi gọi lại
  if (res.status === 401 && auth && !_retried) {
    try {
      const { data: refreshed, error } = await supabase.auth.refreshSession()
      if (!error && refreshed?.session?.access_token) {
        saveAccessToken(refreshed.session.access_token)
        return request(path, { method, body, auth, _retried: true })
      }
    } catch {
      /* fall through */
    }
  }

  if (!res.ok) {
    const message = data?.message || `Lỗi yêu cầu (${res.status})`
    const err = new Error(message)
    err.status = res.status
    throw err
  }

  return data
}

export const apiClient = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}
