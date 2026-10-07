import { randomInt, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../config/supabaseClient.js'
import { HttpError } from '../../lib/httpError.js'
import { calculateMovement, evaluateAnswer, movePosition, hasWinner, nextTurnIndex, orderTeamsByDice } from './treasureRace.engine.js'

const ROOM_COLUMNS = 'id, code, host_id, quiz_id, game_mode, status, settings, created_at, updated_at'
const QUESTION_COLUMNS = 'id, order_index, type, content, options, correct_option, correct_boolean, explanation'
const TOKENS = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'red', 'gold']
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
const fail = (message, status = 400, code = 'validation_error') => { throw new HttpError(message, status, code) }

function mapError(error) {
  if (error?.code === '23505') return new HttpError('Mã phòng vừa bị trùng, vui lòng thử lại.', 409, 'room_conflict')
  console.error('[game-room] database error', error?.code || error?.message || error)
  return new HttpError('Không thể xử lý phòng chơi lúc này.', 503, 'db_unavailable')
}

async function db(promise) { const result = await promise; if (result.error) throw mapError(result.error); return result.data }
async function getOwnedQuiz(userId, quizId) {
  const quiz = await db(supabaseAdmin.from('quizzes').select('id, title, owner_id').eq('id', quizId).eq('owner_id', userId).maybeSingle())
  if (!quiz) fail('Bạn không có quyền sử dụng bộ quiz này.', 403, 'quiz_forbidden')
  const questions = await db(supabaseAdmin.from('questions').select(QUESTION_COLUMNS).eq('quiz_id', quizId).order('order_index', { ascending: true }))
  if (!questions?.length) fail('Quiz cần có ít nhất một câu hỏi để tạo phòng.')
  return { ...quiz, questions }
}

async function roomById(id) { return db(supabaseAdmin.from('game_rooms').select(ROOM_COLUMNS).eq('id', id).maybeSingle()) }
async function findRoom(code) { return db(supabaseAdmin.from('game_rooms').select(ROOM_COLUMNS).eq('code', String(code).toUpperCase()).maybeSingle()) }

export async function createRoom(userId, body = {}) {
  const quiz = await getOwnedQuiz(userId, body.quiz_id)
  const teamCount = Math.min(8, Math.max(2, Number(body.team_count) || 2))
  const maxPlayers = Math.min(12, Math.max(1, Number(body.max_players_per_team) || 4))
  const boardLength = [10, 20, 30, 40, 50].includes(Number(body.board_length)) ? Number(body.board_length) : 20
  const questionLimit = Math.min(quiz.questions.length, Math.max(1, Number(body.question_limit) || quiz.questions.length))
  const settings = { title: String(body.title || 'Phòng đua kho báu').trim().slice(0, 80), team_count: teamCount, max_players_per_team: maxPlayers, board_length: boardLength, question_limit: questionLimit, timer_enabled: body.timer_enabled !== false, question_time_seconds: 30 }
  let room
  for (let attempt = 0; attempt < 3; attempt += 1) {
    room = await db(supabaseAdmin.from('game_rooms').insert({ id: randomUUID(), code: makeCode(), host_id: userId, quiz_id: quiz.id, game_mode: 'treasure_race', status: 'lobby', settings }).select(ROOM_COLUMNS).single()).catch((error) => { if (error?.status === 503) throw error; return null })
    if (room) break
  }
  if (!room) fail('Không tạo được mã phòng, vui lòng thử lại.', 503, 'room_unavailable')
  const game = await db(supabaseAdmin.from('game_games').insert({ room_id: room.id, status: 'ordering', total_questions: questionLimit }).select('id').single())
  const teams = Array.from({ length: teamCount }, (_, index) => ({ game_id: game.id, name: `Đội ${index + 1}`, token: TOKENS[index], position: 0 }))
  const createdTeams = await db(supabaseAdmin.from('game_teams').insert(teams).select('id, name, token, position, turn_order'))
  const firstTeam = createdTeams[0]
  await db(supabaseAdmin.from('game_room_players').insert({ room_id: room.id, user_id: userId, team_id: firstTeam.id }))
  return getRoomForUser(room.code, userId)
}

async function getRoomForUser(code, userId) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  const players = await db(supabaseAdmin.from('game_room_players').select('id, user_id, team_id, joined_at').eq('room_id', room.id).order('joined_at', { ascending: true }))
  const game = await db(supabaseAdmin.from('game_games').select('id, status, current_turn, question_index, total_questions, winner_team_id').eq('room_id', room.id).maybeSingle())
  const teams = game ? await db(supabaseAdmin.from('game_teams').select('id, name, token, position, turn_order, correct_count, wrong_count, total_movement').eq('game_id', game.id).order('turn_order', { ascending: true, nullsFirst: false })) : []
  let question = null
  if (game?.status === 'playing' && teams.length) {
    const currentTeam = teams[game.current_turn % teams.length]
    const turns = await db(supabaseAdmin.from('game_turns').select('question_id').eq('game_id', game.id).order('turn_number', { ascending: false }).limit(1))
    const questionIndex = Math.min(room.settings.question_limit - 1, game.question_index)
    const questions = await db(supabaseAdmin.from('questions').select(QUESTION_COLUMNS).eq('quiz_id', room.quiz_id).order('order_index', { ascending: true }).limit(questionIndex + 1))
    question = questions?.[questionIndex] || null
    if (question) delete question.correct_option, delete question.correct_boolean
    void currentTeam
    void turns
  }
  return { ...room, players, teams, game, question, is_host: room.host_id === userId, current_user_team_id: players.find((p) => p.user_id === userId)?.team_id || null }
}

export async function getRoomState(code, userId) { return getRoomForUser(code, userId) }

export async function joinRoom(code, userId, body = {}) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  if (room.status !== 'lobby') fail('Phòng đã bắt đầu, không thể tham gia.', 409, 'room_started')
  const existing = await db(supabaseAdmin.from('game_room_players').select('id').eq('room_id', room.id).eq('user_id', userId).maybeSingle())
  if (existing) return getRoomForUser(room.code, userId)
  const teams = await db(supabaseAdmin.from('game_teams').select('id').eq('game_id', (await db(supabaseAdmin.from('game_games').select('id').eq('room_id', room.id).single())).id))
  const chosen = teams.find((team) => team.id === body.team_id)?.id || teams[0]?.id
  await db(supabaseAdmin.from('game_room_players').insert({ room_id: room.id, user_id: userId, team_id: chosen }))
  return getRoomForUser(room.code, userId)
}

export async function startRoom(code, userId) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  if (room.host_id !== userId) fail('Chỉ host mới có thể bắt đầu game.', 403, 'host_required')
  if (room.status !== 'lobby') return getRoomForUser(code, userId)
  const game = await db(supabaseAdmin.from('game_games').select('id').eq('room_id', room.id).single())
  const teams = await db(supabaseAdmin.from('game_teams').select('id').eq('game_id', game.id).order('created_at', { ascending: true }))
  const players = await db(supabaseAdmin.from('game_room_players').select('team_id').eq('room_id', room.id))
  const activeTeamIds = new Set(players.map((p) => p.team_id).filter(Boolean))
  if (activeTeamIds.size < 2) fail('Cần ít nhất 2 đội có người chơi để bắt đầu.')
  const ordered = orderTeamsByDice(teams.map((team) => ({ teamId: team.id, value: randomInt(1, 7) })))
  for (let index = 0; index < ordered.length; index += 1) await db(supabaseAdmin.from('game_teams').update({ turn_order: index }).eq('id', ordered[index].teamId))
  await db(supabaseAdmin.from('game_rooms').update({ status: 'playing' }).eq('id', room.id))
  await db(supabaseAdmin.from('game_games').update({ status: 'playing', current_turn: 0, question_index: 0, started_at: new Date().toISOString() }).eq('id', game.id))
  return getRoomForUser(code, userId)
}

export async function answerRoom(code, userId, body = {}) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  const game = await db(supabaseAdmin.from('game_games').select('id, status, current_turn, question_index, total_questions').eq('room_id', room.id).single())
  if (game.status !== 'playing') fail('Game chưa ở trạng thái nhận câu trả lời.', 409, 'game_not_playing')
  const players = await db(supabaseAdmin.from('game_room_players').select('user_id, team_id').eq('room_id', room.id))
  const player = players.find((item) => item.user_id === userId)
  if (!player) fail('Bạn chưa tham gia phòng.', 403, 'not_in_room')
  const teams = await db(supabaseAdmin.from('game_teams').select('id, position, turn_order, correct_count, wrong_count, total_movement').eq('game_id', game.id).order('turn_order', { ascending: true }))
  const currentTeam = teams[game.current_turn]
  if (!currentTeam || player.team_id !== currentTeam.id) fail('Chưa đến lượt đội của bạn.', 409, 'not_your_turn')
  const questions = await db(supabaseAdmin.from('questions').select(QUESTION_COLUMNS).eq('quiz_id', room.quiz_id).order('order_index', { ascending: true }).limit(game.question_index + 1))
  const question = questions?.[game.question_index]
  if (!question) fail('Không còn câu hỏi hợp lệ.', 409, 'no_question')
  const isCorrect = evaluateAnswer(question, body.answer)
  const movement = calculateMovement({ isCorrect, responseTimeMs: Number(body.response_time_ms) || 999999, timerEnabled: room.settings.timer_enabled })
  const position = movePosition(currentTeam.position, movement, room.settings.board_length)
  const turn = await db(supabaseAdmin.from('game_turns').insert({ game_id: game.id, team_id: currentTeam.id, question_id: question.id, turn_number: game.question_index, answer: { submitted: body.answer }, is_correct: isCorrect, movement, response_time: Number(body.response_time_ms) || null }).select('id').single())
  void turn
  await db(supabaseAdmin.from('game_teams').update({ position, correct_count: currentTeam.correct_count + (isCorrect ? 1 : 0), wrong_count: currentTeam.wrong_count + (isCorrect ? 0 : 1), total_movement: currentTeam.total_movement + movement }).eq('id', currentTeam.id))
  const winner = hasWinner(position, room.settings.board_length)
  const nextIndex = nextTurnIndex(game.current_turn, teams.length)
  await db(supabaseAdmin.from('game_games').update({ current_turn: nextIndex, question_index: game.question_index + 1, ...(winner ? { status: 'finished', winner_team_id: currentTeam.id, finished_at: new Date().toISOString() } : game.question_index + 1 >= game.total_questions ? { status: 'finished', winner_team_id: null, finished_at: new Date().toISOString() } : {}) }).eq('id', game.id))
  if (winner || game.question_index + 1 >= game.total_questions) await db(supabaseAdmin.from('game_rooms').update({ status: 'finished' }).eq('id', room.id))
  return getRoomForUser(code, userId)
}
