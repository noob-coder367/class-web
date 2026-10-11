import { apiClient } from './apiClient.js'

export const listRoomQuizzes = async () => {
  const { quizzes } = await apiClient.get('/quizzes', { auth: true })
  return quizzes || []
}
export const createRoom = async (payload, idempotencyKey = null) => {
  const { room } = await apiClient.post('/game-rooms', payload, { auth: true, retry: false, idempotencyKey })
  return room
}
/** Phòng đang ở sảnh của một game (gameKey = id trong GAME_CATALOG, gồm cả 'word-chain'). */
export const listOpenRooms = async (gameKey) => {
  const { rooms } = await apiClient.get(`/game-rooms/open/${encodeURIComponent(gameKey)}`, { auth: true })
  return rooms || []
}
export const getRoom = async (code) => {
  const { room } = await apiClient.get(`/game-rooms/${code}`, { auth: true })
  return room
}
export const joinRoom = async (code, payload = {}) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/join`, payload, { auth: true, retry: false })
  return room
}
export const startRoom = async (code, payload = {}) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/start`, payload, { auth: true, retry: false })
  return room
}
export const submitAnswer = async (code, payload, idempotencyKey = null) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/answer`, payload, { auth: true, retry: false, idempotencyKey })
  return room
}
export const completeDiceRoll = async (code) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/dice-complete`, {}, { auth: true, retry: false })
  return room
}
export const moveRoom = async (code, direction, idempotencyKey = null) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/move`, { direction }, { auth: true, retry: false, idempotencyKey })
  return room
}
export const moveRoomBatch = async (code, directions, idempotencyKey = null) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/move-batch`, { directions }, { auth: true, retry: false, idempotencyKey })
  return room
}
export const switchRoomTurn = async (code, teamId) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/switch-turn`, { team_id: teamId }, { auth: true, retry: false })
  return room
}
