import { supabase } from '../lib/supabaseClient.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

const ACCESS_TOKEN_KEY = 'class-web:access_token'
const FETCH_TIMEOUT_MS = 20_000
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(attempt, retryAfterHeader) {
  const retryAfter = Number(retryAfterHeader)
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(8000, retryAfter * 1000)
  }
  return Math.min(4000, 400 * 2 ** attempt)
}

function shouldRetry(method, status, networkError, attempt) {
  if (attempt >= 3) return false
  if (status && RETRYABLE_STATUS.has(status)) return true
  if (networkError && method === 'GET') return true
  return false
}

async function request(path, { method = 'GET', body, auth = false, _retried = false, _attempt = 0 } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  if (auth) {
    const token = await getFreshAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (shouldRetry(method, 0, true, _attempt)) {
      await wait(retryDelayMs(_attempt))
      return request(path, { method, body, auth, _retried, _attempt: _attempt + 1 })
    }
    const failed = new Error(
      err?.name === 'AbortError'
        ? 'Máy chủ phản hồi chậm, thử lại sau.'
        : 'Không kết nối được máy chủ. Thử lại sau vài giây.'
    )
    failed.status = 0
    throw failed
  }
  clearTimeout(timer)

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
        return request(path, { method, body, auth, _retried: true, _attempt })
      }
    } catch {
      /* fall through */
    }
  }

  if (!res.ok) {
    if (shouldRetry(method, res.status, false, _attempt)) {
      await wait(retryDelayMs(_attempt, res.headers.get('Retry-After')))
      return request(path, { method, body, auth, _retried, _attempt: _attempt + 1 })
    }
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
