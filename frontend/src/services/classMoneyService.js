import { apiClient } from './apiClient.js'
import { supabase } from '../lib/supabaseClient.js'

const moneyCache = new Map()
const CACHE_TTL_MS = 5_000

function cachedGet(key, loader) {
  const hit = moneyCache.get(key)
  if (hit?.promise) return hit.promise
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value)
  const promise = loader().then((value) => {
    moneyCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    return value
  }).finally(() => {
    if (moneyCache.get(key)?.promise === promise) moneyCache.delete(key)
  })
  moneyCache.set(key, { promise })
  return promise
}

function qs(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  })
  const value = search.toString()
  return value ? `?${value}` : ''
}

export function invalidateMoneyCache(...keys) {
  if (!keys.length) moneyCache.clear()
  else keys.forEach((key) => moneyCache.delete(key))
}

export function getMoneyOverview(bookId) {
  const key = `money:overview:${bookId || 'default'}`
  return cachedGet(key, () => apiClient.get(`/classroom/money/overview${qs({ bookId })}`, { auth: true }))
}
export function getMoneyMembers() {
  // Backend đọc danh sách PDF đã parse của Tiện ích (GET /classroom/utility-roster),
  // không parse lại PDF và không lấy từ profiles/account.
  return cachedGet('money:members', () => apiClient.get('/classroom/money/members', { auth: true }))
}
export function getMoneyBooks() {
  return cachedGet('money:books', () => apiClient.get('/classroom/money/books', { auth: true }))
}
export async function createMoneyBook(payload) {
  const result = await apiClient.post('/classroom/money/books', payload, { auth: true })
  invalidateMoneyCache('money:books')
  return result
}
export function getMoneyCollections(bookId) {
  const key = `money:collections:${bookId || 'default'}`
  return cachedGet(key, () => apiClient.get(`/classroom/money/collections${qs({ bookId })}`, { auth: true }))
}
export async function createMoneyCollection(payload) {
  const result = await apiClient.post('/classroom/money/collections', payload, { auth: true })
  invalidateMoneyCache()
  return result
}
export function getMoneyCollection(id) {
  return apiClient.get(`/classroom/money/collections/${encodeURIComponent(id)}`, { auth: true })
}
export async function updateMoneyCollectionMember(id, payload) {
  const result = await apiClient.patch(`/classroom/money/collection-members/${encodeURIComponent(id)}`, payload, { auth: true, retry: false })
  invalidateMoneyCache()
  return result
}
export async function uploadMoneyCollectionMemberPhoto(id, payload) {
  const base = `/classroom/money/collection-members/${encodeURIComponent(id)}/photo`
  const intent = await apiClient.post(`${base}/upload-url`, { mimeType: payload.mimeType, sizeBytes: payload.blob.size }, { auth: true, retry: false })
  const { error } = await supabase.storage.from(intent.bucket).uploadToSignedUrl(intent.path, intent.token, payload.blob, { contentType: intent.mimeType, upsert: false })
  if (error) throw new Error(error.message || 'Không tải được ảnh lên Storage.')
  const result = await apiClient.post(base, { path: intent.path, mimeType: intent.mimeType, sizeBytes: intent.sizeBytes }, { auth: true, retry: false })
  invalidateMoneyCache()
  return result
}
export function getMoneyExpenses(bookId, page = 1) {
  const key = `money:expenses:${bookId || 'default'}:${page}`
  return cachedGet(key, () => apiClient.get(`/classroom/money/expenses${qs({ bookId, page, limit: 50 })}`, { auth: true }))
}
export async function createMoneyExpense(payload) {
  const result = await apiClient.post('/classroom/money/expenses', payload, { auth: true })
  invalidateMoneyCache()
  return result
}
export async function updateMoneyExpense(id, payload) {
  const result = await apiClient.patch(`/classroom/money/expenses/${encodeURIComponent(id)}`, payload, { auth: true })
  invalidateMoneyCache()
  return result
}
export async function deleteMoneyExpense(id) {
  const result = await apiClient.delete(`/classroom/money/expenses/${encodeURIComponent(id)}`, { auth: true })
  invalidateMoneyCache()
  return result
}
export function getMoneyTransactions(bookId, page = 1) {
  return apiClient.get(`/classroom/money/transactions${qs({ bookId, page, limit: 50 })}`, { auth: true })
}
export function getMoneyAuditLogs(bookId, page = 1) {
  return apiClient.get(`/classroom/money/audit-logs${qs({ bookId, page, limit: 50 })}`, { auth: true })
}
