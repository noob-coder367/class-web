import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
const ROOM_COLUMNS = 'id, code, host_id, quiz_id, game_mode, status, settings, created_at, updated_at'
const QUIZ_COLUMNS = 'id, title, description, owner_id, status, created_at, updated_at'
const QUESTION_COLUMNS = 'id, quiz_id, order_index, type, content, options, correct_option, correct_boolean, reference_answer, explanation, created_at, updated_at'
const MODES = new Set(['treasure_race'])
const STATUSES = new Set(['lobby', 'ordering', 'playing', 'finished', 'cancelled'])
const fail = (message, status = 400) => { throw new AppError(message, status) }
function db(result, message = 'Không thể tải dữ liệu quản trị.') { return result.then(({ data, error }) => { if (error) { console.error('[admin-content] database error', error.code || error.message); throw new AppError(message, 503) } return data }) }
async function profilesByIds(ids) {
  if (!ids.length) return new Map()
  const rows = await db(supabaseAdmin.from('profiles').select('id, email, full_name').in('id', ids), 'Không thể tải người dùng liên quan.')
  return new Map((rows || []).map((row) => [row.id, row]))
}
export async function listRooms() {
  const rooms = await db(supabaseAdmin.from('game_rooms').select(ROOM_COLUMNS).order('created_at', { ascending: false }).limit(1000))
  const roomRows = rooms || []
  const quizIds = [...new Set(roomRows.map((r) => r.quiz_id).filter(Boolean))]
  const hostIds = [...new Set(roomRows.map((r) => r.host_id).filter(Boolean))]
  const [quizzes, profiles, players] = await Promise.all([
    quizIds.length ? db(supabaseAdmin.from('quizzes').select('id, title').in('id', quizIds), 'Không thể tải quiz của phòng.') : [],
    profilesByIds(hostIds),
    roomRows.length ? db(supabaseAdmin.from('game_room_players').select('room_id').in('room_id', roomRows.map((r) => r.id)).limit(10000), 'Không thể tải số người chơi.') : [],
  ])
  const quizMap = new Map((quizzes || []).map((q) => [q.id, q]))
  const playerCounts = (players || []).reduce((map, p) => map.set(p.room_id, (map.get(p.room_id) || 0) + 1), new Map())
  return roomRows.map((room) => ({ ...room, quiz: quizMap.get(room.quiz_id) || null, host: profiles.get(room.host_id) || { id: room.host_id }, player_count: playerCounts.get(room.id) || 0 }))
}
export async function updateRoom(id, input = {}) {
  const patch = {}
  if (input.code !== undefined) { const code = String(input.code).trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(code)) fail('Passcode phải gồm đúng 6 ký tự chữ/số.'); patch.code = code }
  if (input.game_mode !== undefined) { if (!MODES.has(input.game_mode)) fail('Game mode không hợp lệ.'); patch.game_mode = input.game_mode }
  if (input.status !== undefined) { if (!STATUSES.has(input.status)) fail('Trạng thái phòng không hợp lệ.'); patch.status = input.status }
  if (input.quiz_id !== undefined) { if (!input.quiz_id) fail('Quiz liên kết không hợp lệ.'); patch.quiz_id = input.quiz_id }
  if (input.settings !== undefined) { if (!input.settings || typeof input.settings !== 'object' || Array.isArray(input.settings)) fail('Settings không hợp lệ.'); patch.settings = input.settings }
  if (!Object.keys(patch).length) fail('Không có thông tin cần cập nhật.')
  const { data, error } = await supabaseAdmin.from('game_rooms').update(patch).eq('id', id).select(ROOM_COLUMNS).single()
  if (error) { if (error.code === '23505') fail('Passcode đã tồn tại.', 409); if (error.code === '23503') fail('Quiz liên kết không tồn tại.', 400); throw new AppError('Không thể cập nhật phòng.', 503) }
  return data
}
export async function deleteRoom(id) {
  const { data: room, error: findError } = await supabaseAdmin.from('game_rooms').select('id, code').eq('id', id).maybeSingle()
  if (findError) throw new AppError('Không thể đọc phòng.', 503)
  if (!room) fail('Không tìm thấy phòng.', 404)
  const { error } = await supabaseAdmin.from('game_rooms').delete().eq('id', id)
  if (error) { if (error.code === '23503') fail('Không thể xóa phòng vì dữ liệu gameplay chưa cho phép cascade.', 409); throw new AppError('Không thể xóa phòng.', 503) }
  return room
}
export async function listQuizzes() {
  const quizzes = await db(supabaseAdmin.from('quizzes').select(QUIZ_COLUMNS).order('created_at', { ascending: false }).limit(1000))
  const rows = quizzes || []
  const ids = rows.map((q) => q.id)
  const questions = ids.length ? await db(supabaseAdmin.from('questions').select('quiz_id').in('quiz_id', ids).limit(10000), 'Không thể đếm câu hỏi.') : []
  const owners = await profilesByIds([...new Set(rows.map((q) => q.owner_id).filter(Boolean))])
  const counts = (questions || []).reduce((map, q) => map.set(q.quiz_id, (map.get(q.quiz_id) || 0) + 1), new Map())
  return rows.map((quiz) => ({ ...quiz, owner: owners.get(quiz.owner_id) || { id: quiz.owner_id }, question_count: counts.get(quiz.id) || 0 }))
}
export async function listQuestions(quizId) { return db(supabaseAdmin.from('questions').select(QUESTION_COLUMNS).eq('quiz_id', quizId).order('order_index', { ascending: true }).limit(100), 'Không thể tải câu hỏi.') }
function validateQuestion(input = {}) {
  const type = String(input.type || '')
  if (!['multiple_choice', 'true_false', 'essay'].includes(type)) fail('Loại câu hỏi không hợp lệ.')
  const content = String(input.content || '').trim(); if (!content || content.length > 1000) fail('Nội dung câu hỏi không hợp lệ.')
  const patch = { type, content, explanation: input.explanation ? String(input.explanation).trim() : null }
  if (type === 'multiple_choice') { const options = Array.isArray(input.options) ? input.options.map((v) => String(v).trim()) : []; const correct = Number(input.correct_option); if (options.length < 2 || options.length > 8 || options.some((v) => !v) || !Number.isInteger(correct) || correct < 0 || correct >= options.length) fail('Đáp án trắc nghiệm không hợp lệ.'); patch.options = options; patch.correct_option = correct; patch.correct_boolean = null; patch.reference_answer = null }
  else if (type === 'true_false') { if (typeof input.correct_boolean !== 'boolean') fail('Đáp án Đúng/Sai không hợp lệ.'); patch.options = null; patch.correct_option = null; patch.correct_boolean = input.correct_boolean; patch.reference_answer = null }
  else { patch.options = null; patch.correct_option = null; patch.correct_boolean = null; patch.reference_answer = input.reference_answer ? String(input.reference_answer).trim() : null }
  return patch
}
export async function updateQuestion(id, input = {}) {
  const patch = validateQuestion(input)
  if (input.order_index !== undefined) { const index = Number(input.order_index); if (!Number.isInteger(index) || index < 0 || index >= 100) fail('Thứ tự câu hỏi không hợp lệ.'); patch.order_index = index }
  const { data, error } = await supabaseAdmin.from('questions').update(patch).eq('id', id).select(QUESTION_COLUMNS).single()
  if (error) { if (error.code === '23505') fail('Thứ tự câu hỏi bị trùng.', 409); throw new AppError('Không thể cập nhật câu hỏi.', 503) }
  return data
}
export async function deleteQuestion(id) { const { error } = await supabaseAdmin.from('questions').delete().eq('id', id); if (error) throw new AppError('Không thể xóa câu hỏi.', 503); return { id } }
