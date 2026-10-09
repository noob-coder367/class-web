import { supabase } from '../lib/supabaseClient.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

const ACCESS_TOKEN_KEY = 'quizly:access_token'
const FETCH_TIMEOUT_MS = 20_000
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
let sessionSnapshot = null
let sessionLookupPromise = null

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

export function setSessionSnapshot(session) {
  sessionSnapshot = session || null
  saveAccessToken(session?.access_token || null)
}

/**
 * Supabase tự refresh access_token ngầm.
 * Trước mỗi request cần auth: lấy token mới nhất từ getSession().
 */
async function getFreshAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (sessionSnapshot?.access_token && (!sessionSnapshot.expires_at || sessionSnapshot.expires_at > now + 30)) {
    return sessionSnapshot.access_token
  }

  if (sessionLookupPromise) return sessionLookupPromise

  sessionLookupPromise = (async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
    setSessionSnapshot(session)
    return session?.access_token || null
  })()

  try {
    return await sessionLookupPromise
  } finally {
    sessionLookupPromise = null
  }
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
  if (status && RETRYABLE_STATUS.has(status) && (method === 'GET' || method === 'HEAD')) return true
  if (networkError && method === 'GET') return true
  return false
}

/**
 * Options:
 *  - rawBody: gửi `body` nguyên bản (File/Blob/ArrayBuffer) thay vì JSON.stringify, dùng cùng `contentType`.
 *  - headers: header bổ sung (ví dụ X-File-Name khi upload).
 */
async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = false,
    retry = true,
    timeoutMs = FETCH_TIMEOUT_MS,
    rawBody = false,
    contentType = 'application/json',
    headers: extraHeaders = {},
    idempotencyKey = null,
    _retried = false,
    _attempt = 0,
  } = options
  const again = (patch) => request(path, { ...options, ...patch })
  const headers = { 'Content-Type': contentType, ...extraHeaders }
  if (idempotencyKey && method !== 'GET' && method !== 'HEAD') headers['Idempotency-Key'] = idempotencyKey

  if (auth) {
    const token = await getFreshAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let payload
  if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
    payload = rawBody ? body : JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(payload !== undefined ? { body: payload } : {}),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (retry && shouldRetry(method, 0, true, _attempt)) {
      await wait(retryDelayMs(_attempt))
      return again({ _attempt: _attempt + 1 })
    }
    const failed = new Error(
      err?.name === 'AbortError'
        ? 'Máy chủ phản hồi chậm, thử lại sau.'
        : 'Không kết nối được máy chủ. Thử lại sau vài giây.'
    )
    failed.status = err?.name === 'AbortError' ? 408 : 0
    failed.code = err?.name === 'AbortError' ? 'timeout' : 'network'
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
        setSessionSnapshot(refreshed.session)
        return again({ _retried: true })
      }
    } catch {
      /* fall through */
    }
  }

  if (!res.ok) {
    if (retry && shouldRetry(method, res.status, false, _attempt)) {
      await wait(retryDelayMs(_attempt, res.headers.get('Retry-After')))
      return again({ _attempt: _attempt + 1 })
    }
    const message = data?.message || `Lỗi yêu cầu (${res.status})`
    const err = new Error(message)
    err.status = res.status
    if (data?.code) err.code = data.code
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
