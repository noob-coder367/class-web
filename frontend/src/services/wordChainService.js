import { apiClient } from './apiClient.js'

// Ghi lại độ lệch giữa đồng hồ máy chủ và đồng hồ trình duyệt tại thời điểm nhận phản hồi,
// để đồng hồ 60 giây của mọi người chơi chạy khớp nhau dù máy lệch giờ.
function withClock(room) {
  if (!room || typeof room !== 'object') return room
  const serverTime = Date.parse(room.server_time || '')
  return { ...room, client_offset_ms: Number.isFinite(serverTime) ? serverTime - Date.now() : 0 }
}

export async function listOpenWordChainRooms() {
  const { rooms } = await apiClient.get('/word-chain/rooms/open')
  return rooms || []
}

export async function createWordChainRoom(payload, idempotencyKey = crypto.randomUUID()) {
  const { room } = await apiClient.post('/word-chain/rooms', payload, { retry: false, idempotencyKey })
  return withClock(room)
}
export async function getWordChainRoom(code) {
  let room
  try {
    ({ room } = await apiClient.get(`/word-chain/rooms/${encodeURIComponent(code)}`))
  } catch (error) {
    if (error?.code !== 'not_in_room') throw error
    ;({ room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/join`, {}, { retry: false }))
  }
  return withClock(room)
}
export async function closeWordChainRoom(code) {
  return apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/close`, {}, { retry: false })
}
export async function joinWordChainRoom(code) {
  const { room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/join`, {}, { retry: false })
  return withClock(room)
}
export async function startWordChainRoom(code) {
  const { room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/start`, {}, { retry: false })
  return withClock(room)
}
export async function submitWordChainAnswer(code, answer, idempotencyKey) {
  const { room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/answer`, { answer }, { retry: false, idempotencyKey })
  return withClock(room)
}
export async function skipWordChainTurn(code, idempotencyKey) {
  const { room } = await apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/skip`, {}, { retry: false, idempotencyKey })
  return withClock(room)
}
/** Hết 60 giây: xin đáp án gợi ý của hệ thống. Trả về { answer, turn_number } (answer = null nếu không còn cụm nào nối được). */
export async function revealWordChainAnswer(code) {
  return apiClient.post(`/word-chain/rooms/${encodeURIComponent(code)}/reveal`, {}, { retry: false })
}
export async function resolveWordChainSource(payload) {
  // Chế độ 1 máy không cần đăng nhập: endpoint này công khai (backend giới hạn theo IP).
  return apiClient.post('/word-chain/source', payload, { auth: false, retry: false })
}
