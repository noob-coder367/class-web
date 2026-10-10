import { randomInt, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../config/supabaseClient.js'
import { HttpError } from '../../lib/httpError.js'
import { evaluateAnswer, nextTurnIndex, orderTeamsByDice, generateMaze, canMove, isExit, rankTeamsAtFinish, shortestPathDistance, GAME_PHASES, DIRECTIONS } from './treasureRace.engine.js'
import { createMinigameSchedule, rankQuizPartyTeams } from './quizParty.engine.js'

const ROOM_COLUMNS = 'id, code, host_id, quiz_id, game_mode, status, settings, created_at, updated_at'
const QUESTION_COLUMNS = 'id, order_index, type, content, options, correct_option, correct_boolean, explanation'
const PUBLIC_QUESTION_COLUMNS = 'id, order_index, type, content, options, explanation'
const GAME_COLUMNS = 'id, status, current_turn, question_index, total_questions, winner_team_id, phase, maze_seed, maze_layout, dice_result, remaining_moves, started_at, finished_at'
const TEAM_COLUMNS = 'id, name, token, position, maze_x, maze_y, turn_order, correct_count, wrong_count, total_movement, total_response_time'
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
const fail = (message, status = 400, code = 'validation_error') => { throw new HttpError(message, status, code) }
export function toPublicQuestion(question) {
  if (!question) return null
  const { id, order_index, type, content, options, explanation } = question
  return { id, order_index, type, content, options, explanation }
}

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

function parseRequestId(value) {
  const raw = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw) ? raw : null
}

export function normalizeResponseTime(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.min(120000, Math.max(0, Math.floor(numeric))) : 0
}

export async function createRoom(userId, body = {}, requestId = null) {
  const quiz = await getOwnedQuiz(userId, body.quiz_id)
  const teamCount = Math.min(8, Math.max(2, Number(body.team_count) || 2))
  const maxPlayers = Math.min(12, Math.max(1, Number(body.max_players_per_team) || 4))
  const boardLength = [10, 20, 30, 40, 50].includes(Number(body.board_length)) ? Number(body.board_length) : 20
  const questionLimit = Math.min(quiz.questions.length, Math.max(1, Number(body.question_limit) || quiz.questions.length))
  const requestedMode = String(body.game_mode || 'treasure-race')
  if (!['quiz_party', 'treasure-race', 'treasure_race'].includes(requestedMode)) fail('Game mode không hợp lệ.')
  const gameMode = requestedMode === 'quiz_party' ? 'quiz_party' : 'treasure_race'
  const settings = { title: String(body.title || (gameMode === 'quiz_party' ? 'Quiz Party' : 'Phòng đua kho báu')).trim().slice(0, 80), game_mode: gameMode, team_count: teamCount, max_players_per_team: maxPlayers, board_length: boardLength, question_limit: questionLimit, timer_enabled: body.timer_enabled !== false, single_device_mode: body.single_device_mode === true, question_time_seconds: 30 }
  const parsedRequestId = parseRequestId(requestId)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const roomId = randomUUID()
    const gameId = randomUUID()
    const { data: createdRoomId, error } = await supabaseAdmin.rpc('create_game_room_atomic_v2', {
      p_room_id: roomId,
      p_game_id: gameId,
      p_host_id: userId,
      p_quiz_id: quiz.id,
      p_code: makeCode(),
      p_settings: settings,
      p_team_count: teamCount,
      p_question_limit: questionLimit,
      p_game_mode: gameMode,
      p_request_id: parsedRequestId,
    })
    if (!error) return getRoomForUserById(createdRoomId || roomId, userId)
    if (error.code !== '23505') throw mapError(error)
  }
  fail('Không tạo được mã phòng, vui lòng thử lại.', 503, 'room_unavailable')
}

function publicMazeState(game) {
  return game?.maze_layout || null
}

async function getRoomForUserById(roomId, userId, feedback = null) {
  const room = await roomById(roomId)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  return getRoomForUser(room.code, userId, feedback)
}

async function getRoomForUser(code, userId, feedback = null, { allowPreview = true } = {}) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  const players = await db(supabaseAdmin.from('game_room_players').select('id, user_id, team_id, joined_at').eq('room_id', room.id).order('joined_at', { ascending: true }))
  const isMember = players.some((player) => player.user_id === userId)
  if (!isMember && (!allowPreview || room.status !== 'lobby')) fail('Bạn chưa tham gia phòng.', 403, 'not_in_room')
  const game = await db(supabaseAdmin.from('game_games').select(GAME_COLUMNS).eq('room_id', room.id).maybeSingle())
  const teams = game ? await db(supabaseAdmin.from('game_teams').select(TEAM_COLUMNS).eq('game_id', game.id).order('turn_order', { ascending: true, nullsFirst: false })) : []
  let question = null
  if (game?.status === 'playing' && teams.length && game.question_index < game.total_questions) {
    const questionIndex = Math.min(room.settings.question_limit - 1, game.question_index)
    const questions = await db(supabaseAdmin.from('questions').select(PUBLIC_QUESTION_COLUMNS).eq('quiz_id', room.quiz_id).order('order_index', { ascending: true }).range(questionIndex, questionIndex))
    question = toPublicQuestion(questions?.[0])
  }
  const ranked = game?.status !== 'finished' ? [] : room.game_mode === 'quiz_party'
    ? rankQuizPartyTeams(teams).map((team, index) => ({ team_id: team.id, rank: index + 1, score: team.correct_count || 0, correct_count: team.correct_count || 0, wrong_count: team.wrong_count || 0 }))
    : game.maze_layout
      ? rankTeamsAtFinish(teams, game.maze_layout).map((team) => ({ team_id: team.id, distance: shortestPathDistance(game.maze_layout, { x: team.maze_x, y: team.maze_y }) }))
      : []
  if (!isMember) return { ...room, players: players.map(({ id, team_id, joined_at }) => ({ id, team_id, joined_at })), teams: teams.map(({ id, name, token }) => ({ id, name, token })), game: null, question: null, is_host: false, current_user_team_id: null, movement_feedback: null }
  return { ...room, players: players.map(({ id, team_id, joined_at }) => ({ id, team_id, joined_at })), teams, game: game ? { ...game, maze: publicMazeState(game), ranking: ranked } : null, question, is_host: room.host_id === userId, current_user_team_id: players.find((p) => p.user_id === userId)?.team_id || null, movement_feedback: feedback }
}

export async function getRoomState(code, userId) { return getRoomForUser(code, userId) }

export async function joinRoom(code, userId, body = {}) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  const requestedTeamId = body.team_id ? parseRequestId(body.team_id) : null
  if (body.team_id && !requestedTeamId) fail('Đội được chọn không hợp lệ.', 400, 'invalid_team')
  const { data: joinedTeamId, error } = await supabaseAdmin.rpc('join_game_room_atomic', {
    p_room_id: room.id,
    p_user_id: userId,
    p_team_id: requestedTeamId,
  })
  if (error?.code === '40001') fail('Phòng đã bắt đầu, không thể tham gia.', 409, 'room_started')
  if (error?.code === '22023') fail('Đội được chọn không hợp lệ.', 400, 'invalid_team')
  if (error?.code === '42501') fail('Phòng một thiết bị chỉ dành cho người tạo phòng.', 403, 'single_device_only')
  if (error?.code === 'P0002') fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  if (error) throw mapError(error)
  if (!joinedTeamId) fail('Đội đã đủ người hoặc phòng đã đầy.', 409, 'team_full')
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
  const seed = randomInt(1, 0xFFFFFFFF)
  let teamLayout
  let gameLayout
  if (room.game_mode === 'quiz_party') {
    // Mini-game and turn order are selected by the server before the first question.
    // The schedule is stored in the existing JSON state column; no costume/name data is persisted.
    const roundCount = Number(room.settings.question_limit) || 1
    gameLayout = { mode: 'quiz_party', version: 1, minigame_schedule: createMinigameSchedule(roundCount, (size) => randomInt(size)) }
    teamLayout = ordered.map((item, index) => ({ team_id: item.teamId, turn_order: index, maze_x: 0, maze_y: 0 }))
  } else {
    const maze = generateMaze(seed, 9, 9, teams.length)
    gameLayout = maze
    teamLayout = ordered.map((item, index) => {
      const originalIndex = teams.findIndex((team) => team.id === item.teamId)
      const spawn = maze.spawns[originalIndex % maze.spawns.length] || maze.spawns[0]
      return { team_id: item.teamId, turn_order: index, maze_x: spawn[0], maze_y: spawn[1] }
    })
  }
  const { data: started, error } = await supabaseAdmin.rpc('start_game_atomic', {
    p_user_id: userId,
    p_room_id: room.id,
    p_game_id: game.id,
    p_team_layout: teamLayout,
    p_maze_seed: seed,
    p_maze_layout: gameLayout,
  })
  if (error) throw mapError(error)
  if (started !== true) return getRoomForUser(code, userId)
  return getRoomForUser(code, userId)
}

async function getActiveGame(code) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  const game = await db(supabaseAdmin.from('game_games').select(GAME_COLUMNS).eq('room_id', room.id).single())
  const teams = await db(supabaseAdmin.from('game_teams').select(TEAM_COLUMNS).eq('game_id', game.id).order('turn_order', { ascending: true }))
  return { room, game, teams }
}

export function assertUserTurn(room, game, teams, players, userId) {
  const player = players.find((item) => item.user_id === userId)
  if (!player) fail('Bạn chưa tham gia phòng.', 403, 'not_in_room')
  const currentTeam = teams[game.current_turn]
  const isSingleDeviceHost = room.settings.single_device_mode === true && room.host_id === userId
  if (!currentTeam || (!isSingleDeviceHost && player.team_id !== currentTeam.id)) fail('Chưa đến lượt đội của bạn.', 409, 'not_your_turn')
  return currentTeam
}

async function assertTurn(room, game, teams, userId) {
  const players = await db(supabaseAdmin.from('game_room_players').select('user_id, team_id').eq('room_id', room.id))
  return assertUserTurn(room, game, teams, players, userId)
}

async function hasPriorMovementAction(code, room, userId, requestId, action) {
  const player = await db(supabaseAdmin.from('game_room_players').select('user_id').eq('room_id', room.id).eq('user_id', userId).maybeSingle())
  if (!player) fail('Bạn chưa tham gia phòng.', 403, 'not_in_room')
  const parsedRequestId = parseRequestId(requestId)
  if (!parsedRequestId) return false
  const claim = await db(supabaseAdmin.from('game_action_claims').select('room_id, game_id')
    .eq('user_id', userId).eq('request_id', parsedRequestId).eq('action', action).maybeSingle())
  if (!claim) return false
  if (claim.room_id !== room.id) fail('Idempotency-Key đã được dùng cho thao tác khác.', 409, 'idempotency_key_reused')
  return true
}

export async function answerRoom(code, userId, body = {}, requestId = null) {
  // Bản nhanh: đọc song song, ghi song song, dựng phản hồi trong bộ nhớ (không đọc lại DB).
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  const [game, players] = await Promise.all([
    db(supabaseAdmin.from('game_games').select(GAME_COLUMNS).eq('room_id', room.id).single()),
    db(supabaseAdmin.from('game_room_players').select('id, user_id, team_id, joined_at').eq('room_id', room.id).order('joined_at', { ascending: true })),
  ])
  const player = players.find((item) => item.user_id === userId)
  if (!player) fail('Bạn chưa tham gia phòng.', 403, 'not_in_room')

  // A retry after a successful answer may arrive after the game has already advanced.
  // Return the current state for an already-committed key before validating the new phase.
  const parsedRequestId = parseRequestId(requestId)
  if (parsedRequestId) {
    const priorClaim = await db(supabaseAdmin.from('game_action_claims').select('id')
      .eq('user_id', userId).eq('request_id', parsedRequestId).eq('action', 'answer').maybeSingle())
    if (priorClaim) return getRoomForUser(code, userId)
  }
  if (game.status !== 'playing' || game.phase !== GAME_PHASES.QUESTION) fail('Game chưa ở trạng thái nhận câu trả lời.', 409, 'game_not_question')
  const [teams, questions] = await Promise.all([
    db(supabaseAdmin.from('game_teams').select(TEAM_COLUMNS).eq('game_id', game.id).order('turn_order', { ascending: true })),
    db(supabaseAdmin.from('questions').select(QUESTION_COLUMNS).eq('quiz_id', room.quiz_id).order('order_index', { ascending: true }).range(game.question_index, game.question_index)),
  ])
  const currentTeam = assertUserTurn(room, game, teams, players, userId)
  const question = questions?.[0]
  if (!question) fail('Không còn câu hỏi hợp lệ.', 409, 'no_question')
  const isCorrect = evaluateAnswer(question, body.answer)
  const responseTime = normalizeResponseTime(body.response_time_ms)
  const updatedTeam = { ...currentTeam, correct_count: currentTeam.correct_count + (isCorrect ? 1 : 0), wrong_count: currentTeam.wrong_count + (isCorrect ? 0 : 1), total_response_time: (currentTeam.total_response_time || 0) + responseTime }
  const nextTeams = teams.map((team) => (team.id === currentTeam.id ? updatedTeam : team))

  let gamePatch
  if (room.game_mode === 'quiz_party') {
    // Every submitted answer advances the party round. Correctness affects score,
    // while the random mini-game is already chosen in the server-side schedule.
    const nextQuestionIndex = game.question_index + 1
    const isFinished = nextQuestionIndex >= game.total_questions
    const winnerId = isFinished ? rankQuizPartyTeams(nextTeams)[0]?.id || null : null
    gamePatch = {
      current_turn: nextTurnIndex(game.current_turn, teams.length),
      question_index: nextQuestionIndex,
      phase: isFinished ? GAME_PHASES.FINISHED : GAME_PHASES.QUESTION,
      status: isFinished ? 'finished' : 'playing',
      winner_team_id: winnerId,
      remaining_moves: 0,
      dice_result: null,
      ...(isFinished ? { finished_at: new Date().toISOString() } : {}),
    }
  } else if (isCorrect) {
    const diceResult = randomInt(1, 7)
    gamePatch = { phase: GAME_PHASES.DICE_ROLL, dice_result: diceResult, remaining_moves: diceResult }
  } else {
    const nextQuestionIndex = game.question_index + 1
    const isFinished = nextQuestionIndex >= game.total_questions
    const winnerId = isFinished ? rankTeamsAtFinish(nextTeams, game.maze_layout)[0]?.id || null : null
    gamePatch = { current_turn: nextTurnIndex(game.current_turn, teams.length), question_index: nextQuestionIndex, phase: isFinished ? GAME_PHASES.FINISHED : GAME_PHASES.QUESTION, status: isFinished ? 'finished' : 'playing', winner_team_id: isFinished ? winnerId : null, remaining_moves: 0, dice_result: null, ...(isFinished ? { finished_at: new Date().toISOString() } : {}) }
  }
  const nextGame = { ...game, ...gamePatch }
  const needsQuestion = nextGame.status === 'playing' && nextGame.question_index < nextGame.total_questions
  const nextIndex = Math.min(room.settings.question_limit - 1, nextGame.question_index)
  const needsFetch = needsQuestion && nextIndex !== game.question_index
  const { data: committed, error: commitError } = await supabaseAdmin.rpc('submit_game_answer_atomic', {
    p_user_id: userId,
    p_request_id: parseRequestId(requestId),
    p_room_id: room.id,
    p_game_id: game.id,
    p_expected_question_index: game.question_index,
    p_team_id: currentTeam.id,
    p_question_id: question.id,
    p_answer: { submitted: body.answer },
    p_is_correct: isCorrect,
    p_response_time: responseTime,
    p_game_patch: gamePatch,
  })
  if (commitError) {
    if (commitError.code === '40001') fail('Trạng thái game vừa thay đổi. Hãy tải lại phòng.', 409, 'game_state_conflict')
    throw mapError(commitError)
  }
  if (committed !== true) return getRoomForUser(code, userId)
  const fetched = needsFetch ? await db(supabaseAdmin.from('questions').select(PUBLIC_QUESTION_COLUMNS).eq('quiz_id', room.quiz_id).order('order_index', { ascending: true }).range(nextIndex, nextIndex)) : null
  const nextQuestion = needsQuestion ? toPublicQuestion((needsFetch ? fetched?.[0] : question) || null) : null
  const finished = nextGame.status === 'finished'
  const ranking = !finished ? [] : room.game_mode === 'quiz_party'
    ? rankQuizPartyTeams(nextTeams).map((team, index) => ({ team_id: team.id, rank: index + 1, score: team.correct_count || 0, correct_count: team.correct_count || 0, wrong_count: team.wrong_count || 0 }))
    : nextGame.maze_layout
      ? rankTeamsAtFinish(nextTeams, nextGame.maze_layout).map((team) => ({ team_id: team.id, distance: shortestPathDistance(nextGame.maze_layout, { x: team.maze_x, y: team.maze_y }) }))
      : []
  return { ...room, status: finished ? 'finished' : room.status, players: players.map(({ id, team_id, joined_at }) => ({ id, team_id, joined_at })), teams: nextTeams, game: { ...nextGame, maze: publicMazeState(nextGame), ranking }, question: nextQuestion, answer_feedback: { is_correct: isCorrect }, is_host: room.host_id === userId, current_user_team_id: player.team_id || null, movement_feedback: null }
}

export async function moveRoom(code, userId, direction, requestId = null) {
  const { room, game, teams } = await getActiveGame(code)
  if (await hasPriorMovementAction(code, room, userId, requestId, 'move')) return getRoomForUser(code, userId)
  if (game.status !== 'playing' || game.phase !== GAME_PHASES.MOVEMENT) fail('Chưa đến phase di chuyển.', 409, 'game_not_movement')
  if (!DIRECTIONS[direction]) fail('Hướng di chuyển không hợp lệ.', 400, 'invalid_direction')
  const currentTeam = await assertTurn(room, game, teams, userId)
  if (!game.remaining_moves) fail('Đã hết lượt di chuyển.', 409, 'no_remaining_moves')
  const collision = canMove(game.maze_layout, { x: currentTeam.maze_x, y: currentTeam.maze_y }, direction)
  if (!collision.allowed) return getRoomForUser(code, userId, { collision: true, direction, remaining_moves: game.remaining_moves })

  const next = collision.position
  const nextMoves = game.remaining_moves - 1
  const reachedExit = isExit(next, game.maze_layout)
  const movedTeam = { ...currentTeam, maze_x: next.x, maze_y: next.y, position: currentTeam.position + 1, total_movement: (currentTeam.total_movement || 0) + 1 }
  const nextTeams = teams.map((team) => (team.id === currentTeam.id ? movedTeam : team))
  let gamePatch = { remaining_moves: nextMoves }

  if (reachedExit || nextMoves <= 0) {
    const nextQuestionIndex = game.question_index + 1
    const isFinished = reachedExit || nextQuestionIndex >= game.total_questions
    let winnerId = reachedExit ? currentTeam.id : null
    if (isFinished && !winnerId) winnerId = rankTeamsAtFinish(nextTeams, game.maze_layout)[0]?.id || null
    gamePatch = {
      current_turn: nextTurnIndex(game.current_turn, teams.length),
      question_index: nextQuestionIndex,
      phase: isFinished ? GAME_PHASES.FINISHED : GAME_PHASES.QUESTION,
      status: isFinished ? 'finished' : 'playing',
      winner_team_id: isFinished ? winnerId : null,
      remaining_moves: 0,
      dice_result: null,
      ...(isFinished ? { finished_at: new Date().toISOString() } : {}),
    }
  }

  const { data: moved, error } = await supabaseAdmin.rpc('apply_game_movement_atomic', {
    p_user_id: userId,
    p_room_id: room.id,
    p_game_id: game.id,
    p_team_id: currentTeam.id,
    p_expected_turn: game.current_turn,
    p_expected_x: currentTeam.maze_x,
    p_expected_y: currentTeam.maze_y,
    p_expected_remaining_moves: game.remaining_moves,
    p_new_x: next.x,
    p_new_y: next.y,
    p_steps: 1,
    p_remaining_moves: Number(gamePatch.remaining_moves ?? nextMoves),
    p_game_patch: gamePatch,
    p_request_id: parseRequestId(requestId),
    p_action: 'move',
  })
  if (error) {
    if (error.code === '40001') fail('Trạng thái di chuyển vừa thay đổi. Hãy tải lại phòng.', 409, 'game_state_conflict')
    throw mapError(error)
  }
  if (moved !== true) return getRoomForUser(code, userId)
  return getRoomForUser(code, userId, { collision: false, direction, remaining_moves: Number(gamePatch.remaining_moves ?? nextMoves), moved: true })
}

export async function moveRoomBatch(code, userId, directions = [], requestId = null) {
  // Bản nhanh: ít vòng truy vấn hơn (đọc song song, ghi song song, dựng phản hồi trong bộ nhớ).
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  if (await hasPriorMovementAction(code, room, userId, requestId, 'move_batch')) return getRoomForUser(code, userId)
  const [game, players] = await Promise.all([
    db(supabaseAdmin.from('game_games').select(GAME_COLUMNS).eq('room_id', room.id).single()),
    db(supabaseAdmin.from('game_room_players').select('id, user_id, team_id, joined_at').eq('room_id', room.id).order('joined_at', { ascending: true })),
  ])
  const teams = await db(supabaseAdmin.from('game_teams').select(TEAM_COLUMNS).eq('game_id', game.id).order('turn_order', { ascending: true }))
  if (game.status !== 'playing' || game.phase !== GAME_PHASES.MOVEMENT) fail('Chưa đến phase di chuyển.', 409, 'game_not_movement')
  if (!Array.isArray(directions) || !directions.length || directions.length > 50 || !directions.every((d) => DIRECTIONS[d])) fail('Hướng di chuyển không hợp lệ.', 400, 'invalid_direction')
  const currentTeam = assertUserTurn(room, game, teams, players, userId)
  if (!game.remaining_moves) fail('Đã hết lượt di chuyển.', 409, 'no_remaining_moves')

  let position = { x: currentTeam.maze_x, y: currentTeam.maze_y }
  let remaining = game.remaining_moves
  let steps = 0
  let reachedExit = false
  let collision = false
  for (const direction of directions) {
    if (remaining <= 0 || reachedExit) break
    const result = canMove(game.maze_layout, position, direction)
    if (!result.allowed) { collision = true; continue }
    position = result.position
    remaining -= 1
    steps += 1
    reachedExit = isExit(position, game.maze_layout)
  }
  const feedback = { collision: collision && steps === 0, moved: steps > 0, remaining_moves: Math.max(0, remaining) }
  if (steps === 0) return getRoomForUser(code, userId, feedback)

  const movedTeam = { ...currentTeam, maze_x: position.x, maze_y: position.y, position: currentTeam.position + steps, total_movement: (currentTeam.total_movement || 0) + steps }
  const nextTeams = teams.map((team) => (team.id === currentTeam.id ? movedTeam : team))
  let gamePatch
  if (reachedExit || remaining <= 0) {
    const nextQuestionIndex = game.question_index + 1
    const isFinished = reachedExit || nextQuestionIndex >= game.total_questions
    let winnerId = reachedExit ? currentTeam.id : null
    if (isFinished && !winnerId) winnerId = rankTeamsAtFinish(nextTeams, game.maze_layout)[0]?.id || null
    gamePatch = { current_turn: nextTurnIndex(game.current_turn, teams.length), question_index: nextQuestionIndex, phase: isFinished ? GAME_PHASES.FINISHED : GAME_PHASES.QUESTION, status: isFinished ? 'finished' : 'playing', winner_team_id: isFinished ? winnerId : null, remaining_moves: 0, dice_result: null, ...(isFinished ? { finished_at: new Date().toISOString() } : {}) }
  } else {
    gamePatch = { remaining_moves: remaining }
  }
  feedback.remaining_moves = Number(gamePatch.remaining_moves ?? remaining)
  const { data: moved, error } = await supabaseAdmin.rpc('apply_game_movement_atomic', {
    p_user_id: userId,
    p_room_id: room.id,
    p_game_id: game.id,
    p_team_id: currentTeam.id,
    p_expected_turn: game.current_turn,
    p_expected_x: currentTeam.maze_x,
    p_expected_y: currentTeam.maze_y,
    p_expected_remaining_moves: game.remaining_moves,
    p_new_x: position.x,
    p_new_y: position.y,
    p_steps: steps,
    p_remaining_moves: Number(gamePatch.remaining_moves ?? remaining),
    p_game_patch: gamePatch,
    p_request_id: parseRequestId(requestId),
    p_action: 'move_batch',
  })
  if (error) {
    if (error.code === '40001') fail('Trạng thái di chuyển vừa thay đổi. Hãy tải lại phòng.', 409, 'game_state_conflict')
    throw mapError(error)
  }
  if (moved !== true) return getRoomForUser(code, userId)
  return getRoomForUser(code, userId, feedback)
}

export async function completeDiceRoll(code, userId) {
  const { room, game, teams } = await getActiveGame(code)
  if (game.status !== 'playing' || game.phase !== GAME_PHASES.DICE_ROLL) fail('Không có lượt xúc xắc đang chờ.', 409, 'game_not_dice_roll')
  await assertTurn(room, game, teams, userId)
  const { data: advanced, error } = await supabaseAdmin.from('game_games')
    .update({ phase: GAME_PHASES.MOVEMENT })
    .eq('id', game.id)
    .eq('status', 'playing')
    .eq('phase', GAME_PHASES.DICE_ROLL)
    .eq('current_turn', game.current_turn)
    .select('id')
    .maybeSingle()
  if (error) throw mapError(error)
  if (!advanced) return getRoomForUser(code, userId)
  return getRoomForUser(code, userId)
}

export async function switchRoomTurn(code, userId, teamId) {
  const room = await findRoom(code)
  if (!room) fail('Mã phòng không tồn tại.', 404, 'room_not_found')
  if (room.settings.single_device_mode !== true) fail('Chức năng chuyển đội chỉ dùng cho chế độ một thiết bị.', 403, 'single_device_only')
  if (room.host_id !== userId) fail('Chỉ người tạo phòng mới có thể chuyển đội.', 403, 'host_required')
  const game = await db(supabaseAdmin.from('game_games').select('id, status, phase, current_turn').eq('room_id', room.id).single())
  if (game.status !== 'playing') fail('Game chưa bắt đầu.', 409, 'game_not_playing')
  const teams = await db(supabaseAdmin.from('game_teams').select('id, turn_order').eq('game_id', game.id).order('turn_order', { ascending: true }))
  const nextIndex = teams.findIndex((team) => team.id === teamId)
  if (nextIndex < 0) fail('Đội không hợp lệ.', 400, 'invalid_team')
  const { data: switched, error } = await supabaseAdmin.from('game_games')
    .update({ current_turn: nextIndex })
    .eq('id', game.id)
    .eq('status', 'playing')
    .eq('phase', game.phase)
    .eq('current_turn', game.current_turn)
    .select('id')
    .maybeSingle()
  if (error) throw mapError(error)
  if (!switched) return getRoomForUser(code, userId)
  return getRoomForUser(code, userId)
}

export { roomById }
