import { randomInt, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../config/supabaseClient.js'
import { HttpError } from '../../lib/httpError.js'
import { evaluateAnswer, nextTurnIndex, orderTeamsByDice, generateMaze, canMove, isExit, rankTeamsAtFinish, shortestPathDistance, GAME_PHASES, DIRECTIONS } from './treasureRace.engine.js'

const ROOM_COLUMNS = 'id, code, host_id, quiz_id, game_mode, status, settings, created_at, updated_at'
const QUESTION_COLUMNS = 'id, order_index, type, content, options, correct_option, correct_boolean, explanation'
const GAME_COLUMNS = 'id, status, current_turn, question_index, total_questions, winner_team_id, phase, maze_seed, maze_layout, dice_result, remaining_moves, started_at, finished_at'
const TEAM_COLUMNS = 'id, name, token, position, maze_x, maze_y, turn_order, correct_count, wrong_count, total_movement, total_response_time'
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
  const settings = { title: String(body.title || 'Phòng đua kho báu').trim().slice(0, 80), team_count: teamCount, max_players_per_team: maxPlayers, board_length: boardLength, question_limit: questionLimit, timer_enabled: body.timer_enabled !== false, single_device_mode: body.single_device_mode === true, question_time_seconds: 30 }
  let room
  for (let attempt = 0; attempt < 3; attempt += 1) {
    room = await db(supabaseAdmin.from('game_rooms').insert({ id: randomUUID(), code: makeCode(), host_id: userId, quiz_id: quiz.id, game_mode: 'treasure_race', status: 'lobby', settings }).select(ROOM_COLUMNS).single()).catch((error) => { if (error?.status === 503) throw error; return null })
    if (room) break
  }
  if (!room) fail('Không tạo được mã phòng, vui lòng thử lại.', 503, 'room_unavailable')
  const game = await db(supabaseAdmin.from('game_games').insert({ room_id: room.id, status: 'ordering', phase: GAME_PHASES.QUESTION, total_questions: questionLimit }).select('id').single())
  const teams = Array.from({ length: teamCount }, (_, index) => ({ game_id: game.id, name: `Đội ${index + 1}`, token: TOKENS[index], position: 0, maze_x: 0, maze_y: 0 }))
  const createdTeams = await db(supabaseAdmin.from('game_teams').insert(teams).select('id, name, token, position, maze_x, maze_y, turn_order'))
  await db(supabaseAdmin.from('game_room_players').insert({ room_id: room.id, user_id: userId, team_id: createdTeams[0].id }))
  return getRoomForUser(room.code, userId)
}

function publicMazeState(game) {
  return game?.maze_layout || null
}

async function getRoomForUser(code, userId, feedback = null) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  const players = await db(supabaseAdmin.from('game_room_players').select('id, user_id, team_id, joined_at').eq('room_id', room.id).order('joined_at', { ascending: true }))
  const game = await db(supabaseAdmin.from('game_games').select(GAME_COLUMNS).eq('room_id', room.id).maybeSingle())
  const teams = game ? await db(supabaseAdmin.from('game_teams').select(TEAM_COLUMNS).eq('game_id', game.id).order('turn_order', { ascending: true, nullsFirst: false })) : []
  let question = null
  if (game?.status === 'playing' && teams.length && game.question_index < game.total_questions) {
    const questionIndex = Math.min(room.settings.question_limit - 1, game.question_index)
    const questions = await db(supabaseAdmin.from('questions').select(QUESTION_COLUMNS).eq('quiz_id', room.quiz_id).order('order_index', { ascending: true }).limit(questionIndex + 1))
    question = questions?.[questionIndex] || null
    if (question) { delete question.correct_option; delete question.correct_boolean }
  }
  const ranked = game?.status === 'finished' && game.maze_layout ? rankTeamsAtFinish(teams, game.maze_layout).map((team) => ({ team_id: team.id, distance: shortestPathDistance(game.maze_layout, { x: team.maze_x, y: team.maze_y }) })) : []
  return { ...room, players, teams, game: game ? { ...game, maze: publicMazeState(game), ranking: ranked } : null, question, is_host: room.host_id === userId, current_user_team_id: players.find((p) => p.user_id === userId)?.team_id || null, movement_feedback: feedback }
}

export async function getRoomState(code, userId) { return getRoomForUser(code, userId) }

export async function joinRoom(code, userId, body = {}) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  if (room.status !== 'lobby') fail('Phòng đã bắt đầu, không thể tham gia.', 409, 'room_started')
  const existing = await db(supabaseAdmin.from('game_room_players').select('id').eq('room_id', room.id).eq('user_id', userId).maybeSingle())
  if (existing) return getRoomForUser(room.code, userId)
  const game = await db(supabaseAdmin.from('game_games').select('id').eq('room_id', room.id).single())
  const teams = await db(supabaseAdmin.from('game_teams').select('id').eq('game_id', game.id))
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
  const teams = await db(supabaseAdmin.from('game_teams').select('id, created_at').eq('game_id', game.id).order('created_at', { ascending: true }))
  const players = await db(supabaseAdmin.from('game_room_players').select('team_id').eq('room_id', room.id))
  const activeTeamIds = new Set(players.map((p) => p.team_id).filter(Boolean))
  if (!room.settings.single_device_mode && activeTeamIds.size < 2) fail('Cần ít nhất 2 đội có người chơi để bắt đầu.')
  const ordered = orderTeamsByDice(teams.map((team) => ({ teamId: team.id, value: randomInt(1, 7) })))
  const maze = generateMaze(randomInt(1, 0xFFFFFFFF), 9, 9)
  for (let index = 0; index < ordered.length; index += 1) {
    const originalIndex = teams.findIndex((team) => team.id === ordered[index].teamId)
    const spawn = maze.spawns[originalIndex % maze.spawns.length] || maze.spawns[0]
    await db(supabaseAdmin.from('game_teams').update({ turn_order: index, maze_x: spawn[0], maze_y: spawn[1], position: 0 }).eq('id', ordered[index].teamId))
  }
  await db(supabaseAdmin.from('game_rooms').update({ status: 'playing' }).eq('id', room.id))
  await db(supabaseAdmin.from('game_games').update({ status: 'playing', phase: GAME_PHASES.QUESTION, current_turn: 0, question_index: 0, maze_seed: maze.seed, maze_layout: maze, dice_result: null, remaining_moves: 0, started_at: new Date().toISOString() }).eq('id', game.id))
  return getRoomForUser(code, userId)
}

async function getActiveGame(code) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  const game = await db(supabaseAdmin.from('game_games').select(GAME_COLUMNS).eq('room_id', room.id).single())
  const teams = await db(supabaseAdmin.from('game_teams').select(TEAM_COLUMNS).eq('game_id', game.id).order('turn_order', { ascending: true }))
  return { room, game, teams }
}

async function assertTurn(room, game, teams, userId) {
  const players = await db(supabaseAdmin.from('game_room_players').select('user_id, team_id').eq('room_id', room.id))
  const player = players.find((item) => item.user_id === userId)
  if (!player) fail('Bạn chưa tham gia phòng.', 403, 'not_in_room')
  const currentTeam = teams[game.current_turn]
  const isSingleDeviceHost = room.settings.single_device_mode === true && room.host_id === userId
  if (!currentTeam || (!isSingleDeviceHost && player.team_id !== currentTeam.id)) fail('Chưa đến lượt đội của bạn.', 409, 'not_your_turn')
  return currentTeam
}

async function finishOrAdvance(room, game, teams, currentTeam, winnerTeamId = null) {
  const nextQuestionIndex = game.question_index + 1
  const isFinished = Boolean(winnerTeamId) || nextQuestionIndex >= game.total_questions
  let resolvedWinner = winnerTeamId
  if (isFinished && !resolvedWinner) resolvedWinner = rankTeamsAtFinish(teams, game.maze_layout)[0]?.id || null
  const nextIndex = nextTurnIndex(game.current_turn, teams.length)
  await db(supabaseAdmin.from('game_games').update({ current_turn: nextIndex, question_index: nextQuestionIndex, phase: isFinished ? GAME_PHASES.FINISHED : GAME_PHASES.QUESTION, status: isFinished ? 'finished' : 'playing', winner_team_id: isFinished ? resolvedWinner : null, remaining_moves: 0, dice_result: null, ...(isFinished ? { finished_at: new Date().toISOString() } : {}) }).eq('id', game.id))
  if (isFinished) await db(supabaseAdmin.from('game_rooms').update({ status: 'finished' }).eq('id', room.id))
}

export async function answerRoom(code, userId, body = {}) {
  const { room, game, teams } = await getActiveGame(code)
  if (game.status !== 'playing' || game.phase !== GAME_PHASES.QUESTION) fail('Game chưa ở trạng thái nhận câu trả lời.', 409, 'game_not_question')
  const currentTeam = await assertTurn(room, game, teams, userId)
  const questions = await db(supabaseAdmin.from('questions').select(QUESTION_COLUMNS).eq('quiz_id', room.quiz_id).order('order_index', { ascending: true }).limit(game.question_index + 1))
  const question = questions?.[game.question_index]
  if (!question) fail('Không còn câu hỏi hợp lệ.', 409, 'no_question')
  const isCorrect = evaluateAnswer(question, body.answer)
  const responseTime = Math.max(0, Number(body.response_time_ms) || 0)
  await db(supabaseAdmin.from('game_turns').insert({ game_id: game.id, team_id: currentTeam.id, question_id: question.id, turn_number: game.question_index, answer: { submitted: body.answer }, is_correct: isCorrect, movement: isCorrect ? null : 0, response_time: responseTime || null }))
  const updatedTeam = { ...currentTeam, correct_count: currentTeam.correct_count + (isCorrect ? 1 : 0), wrong_count: currentTeam.wrong_count + (isCorrect ? 0 : 1), total_response_time: (currentTeam.total_response_time || 0) + responseTime }
  await db(supabaseAdmin.from('game_teams').update({ correct_count: updatedTeam.correct_count, wrong_count: updatedTeam.wrong_count, total_response_time: updatedTeam.total_response_time }).eq('id', currentTeam.id))
  if (!isCorrect) await finishOrAdvance(room, game, teams.map((team) => team.id === currentTeam.id ? updatedTeam : team), updatedTeam)
  else {
    const diceResult = randomInt(1, 7)
    await db(supabaseAdmin.from('game_games').update({ phase: GAME_PHASES.DICE_ROLL, dice_result: diceResult, remaining_moves: diceResult }).eq('id', game.id))
  }
  return getRoomForUser(code, userId)
}

export async function moveRoom(code, userId, direction) {
  const { room, game, teams } = await getActiveGame(code)
  if (game.status !== 'playing' || game.phase !== GAME_PHASES.MOVEMENT) fail('Chưa đến phase di chuyển.', 409, 'game_not_movement')
  if (!DIRECTIONS[direction]) fail('Hướng di chuyển không hợp lệ.', 400, 'invalid_direction')
  const currentTeam = await assertTurn(room, game, teams, userId)
  if (!game.remaining_moves) fail('Đã hết lượt di chuyển.', 409, 'no_remaining_moves')
  const collision = canMove(game.maze_layout, { x: currentTeam.maze_x, y: currentTeam.maze_y }, direction)
  if (!collision.allowed) return getRoomForUser(code, userId, { collision: true, direction, remaining_moves: game.remaining_moves })
  const next = collision.position
  const nextMoves = game.remaining_moves - 1
  await db(supabaseAdmin.from('game_teams').update({ maze_x: next.x, maze_y: next.y, position: currentTeam.position + 1, total_movement: (currentTeam.total_movement || 0) + 1 }).eq('id', currentTeam.id))
  const reachedExit = isExit(next, game.maze_layout)
  const movedTeam = { ...currentTeam, maze_x: next.x, maze_y: next.y, correct_count: currentTeam.correct_count, total_response_time: currentTeam.total_response_time }
  if (reachedExit) {
    await finishOrAdvance(room, game, teams, currentTeam, currentTeam.id)
  } else if (nextMoves <= 0) {
    await finishOrAdvance(room, game, teams.map((team) => team.id === currentTeam.id ? movedTeam : team), movedTeam)
  } else {
    await db(supabaseAdmin.from('game_games').update({ remaining_moves: nextMoves }).eq('id', game.id))
  }
  return getRoomForUser(code, userId, { collision: false, direction, remaining_moves: Math.max(0, nextMoves), moved: true })
}

export async function completeDiceRoll(code, userId) {
  const { room, game, teams } = await getActiveGame(code)
  if (game.status !== 'playing' || game.phase !== GAME_PHASES.DICE_ROLL) fail('Không có lượt xúc xắc đang chờ.', 409, 'game_not_dice_roll')
  await assertTurn(room, game, teams, userId)
  await db(supabaseAdmin.from('game_games').update({ phase: GAME_PHASES.MOVEMENT }).eq('id', game.id))
  return getRoomForUser(code, userId)
}

export async function switchRoomTurn(code, userId, teamId) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  if (room.settings.single_device_mode !== true) fail('Chức năng chuyển đội chỉ dùng cho chế độ một thiết bị.', 403, 'single_device_only')
  if (room.host_id !== userId) fail('Chỉ người tạo phòng mới có thể chuyển đội.', 403, 'host_required')
  const game = await db(supabaseAdmin.from('game_games').select('id, status, phase').eq('room_id', room.id).single())
  if (game.status !== 'playing') fail('Game chưa bắt đầu.', 409, 'game_not_playing')
  const teams = await db(supabaseAdmin.from('game_teams').select('id, turn_order').eq('game_id', game.id).order('turn_order', { ascending: true }))
  const nextIndex = teams.findIndex((team) => team.id === teamId)
  if (nextIndex < 0) fail('Đội không hợp lệ.', 400, 'invalid_team')
  await db(supabaseAdmin.from('game_games').update({ current_turn: nextIndex }).eq('id', game.id))
  return getRoomForUser(code, userId)
}

export { roomById }
