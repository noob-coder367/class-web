import { apiClient } from './apiClient.js'

export const listRoomQuizzes = async () => {
  const { quizzes } = await apiClient.get('/quizzes', { auth: true })
  return quizzes || []
}
export const createRoom = async (payload) => {
  const { room } = await apiClient.post('/game-rooms', payload, { auth: true, retry: false })
  return room
}
export const getRoom = async (code) => {
  const { room } = await apiClient.get(`/game-rooms/${code}`, { auth: true })
  return room
}
export const joinRoom = async (code, payload = {}) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/join`, payload, { auth: true, retry: false })
  return room
}
export const startRoom = async (code) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/start`, {}, { auth: true, retry: false })
  return room
}
export const submitAnswer = async (code, payload) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/answer`, payload, { auth: true, retry: false })
  return room
}
export const completeDiceRoll = async (code) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/dice-complete`, {}, { auth: true, retry: false })
  return room
}
export const moveRoom = async (code, direction) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/move`, { direction }, { auth: true, retry: false })
  return room
}
export const switchRoomTurn = async (code, teamId) => {
  const { room } = await apiClient.post(`/game-rooms/${code}/switch-turn`, { team_id: teamId }, { auth: true, retry: false })
  return room
}
