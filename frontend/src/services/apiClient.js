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
 * Supabase tự refresh access_token ngầm (mặc định access_token sống
 * ~1 tiếng). localStorage['class-web:access_token'] chỉ được ghi 1 lần
 * lúc login/loadProfile nên sẽ hết hạn theo thời gian, gây lỗi
 * "Phiên đăng nhập không hợp lệ" dù giao diện vẫn hiện đã đăng nhập.
 *
 * Sửa: trước mỗi request cần auth, luôn hỏi thẳng
 * supabase.auth.getSession() để lấy access_token MỚI NHẤT (đã được
 * supabase-js tự refresh nếu cần), đồng bộ lại localStorage, rồi mới
 * dùng token đó gọi backend.
 */
async function getFreshAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token || null
  saveAccessToken(token)
  return token
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
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
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}
