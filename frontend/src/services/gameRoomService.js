import { apiClient } from './apiClient.js'

export const listRoomQuizzes = async () => {
  const { quizzes } = await apiClient.get('/quizzes/room-catalog', { auth: true })
  return quizzes || []
}
export const createRoom = async (payload, idempotencyKey = null) => {
  const { room } = await apiClient.post('/game-rooms', payload, { retry: false, idempotencyKey })
  return room
}
export const updateRoomVisibility = async (code, isPublic) => {
  const { room } = await apiClient.patch(`/game-rooms/${code}/visibility`, { is_public: isPublic }, { retry: false })
  return room
}
export const leaveRoom = async (code, close = false) => apiClient.post(`/game-rooms/${code}/leave`, { close }, { retry: false })
/** Phòng đang ở sảnh của một game (gameKey = id trong GAME_CATALOG, gồm cả 'word-chain'). */
export const listOpenRooms = async (gameKey) => {
  const { rooms } = await apiClient.get(`/game-rooms/open/${encodeURIComponent(gameKey)}`)
  return rooms || []
}
export const getRoom = async (code) => {
  const { room } = await apiClient.get(`/game-rooms/${code}`)
  return room
}
export const joinRoom = async (code, payload = {}) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/join`, payload, { retry: false })
  return room
}
export const startRoom = async (code, payload = {}) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/start`, payload, { retry: false })
  return room
}
export const submitAnswer = async (code, payload, idempotencyKey = null) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/answer`, payload, { retry: false, idempotencyKey })
  return room
}
export const completeDiceRoll = async (code) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/dice-complete`, {}, { retry: false })
  return room
}
export const moveRoom = async (code, direction, idempotencyKey = null) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/move`, { direction }, { retry: false, idempotencyKey })
  return room
}
export const moveRoomBatch = async (code, directions, idempotencyKey = null) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/move-batch`, { directions }, { retry: false, idempotencyKey })
  return room
}
export const switchRoomTurn = async (code, teamId) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/switch-turn`, { team_id: teamId }, { retry: false })
  return room
}
