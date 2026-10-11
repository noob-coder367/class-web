import { apiClient } from './apiClient.js'

export async function createWordChainRoom(payload, idempotencyKey = crypto.randomUUID()) {
  const { room } = await apiClient.post('/word-chain/rooms', payload, { auth: true, retry: false, idempotencyKey })
  return room
}
export async function getWordChainRoom(code) {
  const { room } = await apiClient.get(`/word-chain/rooms/${encodeURIComponent(code)}`, { auth: true })
  return room
}
export async function joinWordChainRoom(code) {
  const { room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/join`, {}, { auth: true, retry: false })
  return room
}
export async function startWordChainRoom(code) {
  const { room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/start`, {}, { auth: true, retry: false })
  return room
}
export async function submitWordChainAnswer(code, answer, idempotencyKey) {
  const { room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/answer`, { answer }, { auth: true, retry: false, idempotencyKey })
  return room
}
export async function skipWordChainTurn(code, idempotencyKey) {
  const { room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/skip`, {}, { auth: true, retry: false, idempotencyKey })
  return room
}
export async function resolveWordChainSource(payload) {
  // Chế độ 1 máy không cần đăng nhập: endpoint này công khai (backend giới hạn theo IP).
  return apiClient.post('/word-chain/source', payload, { auth: false, retry: false })
}
