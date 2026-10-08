import { apiClient } from './apiClient.js'
export async function listRooms() { const data = await apiClient.get('/admin/game-rooms', { auth: true }); return data.rooms || [] }
export async function updateRoom(id, patch) { const data = await apiClient.patch(`/admin/game-rooms/${encodeURIComponent(id)}`, patch, { auth: true, retry: false }); return data.room }
export async function deleteRoom(id) { return apiClient.delete(`/admin/game-rooms/${encodeURIComponent(id)}`, { auth: true, retry: false }) }
export async function listQuizzes() { const data = await apiClient.get('/admin/quizzes', { auth: true }); return data.quizzes || [] }
export async function listQuestions(quizId) { const data = await apiClient.get(`/admin/quizzes/${encodeURIComponent(quizId)}/questions`, { auth: true }); return data.questions || [] }
export async function updateQuestion(id, patch) { const data = await apiClient.patch(`/admin/questions/${encodeURIComponent(id)}`, patch, { auth: true, retry: false }); return data.question }
export async function deleteQuestion(id) { return apiClient.delete(`/admin/questions/${encodeURIComponent(id)}`, { auth: true, retry: false }) }
