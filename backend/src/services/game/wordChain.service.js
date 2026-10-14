import { createHash, randomInt, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../config/supabaseClient.js'
import { HttpError } from '../../lib/httpError.js'
import { allocateTurns, chooseStartingPhrase, findAnswer, makePhraseSet, TURN_TIME_LIMIT_SECONDS, validateAnswer, WordChainRuleError } from './wordChain.engine.js'
import { isDictionaryPhrase, normalizePhrase } from './wordChainDictionary.js'
import { analyzeTopicWithAI } from './wordChainTopicAI.js'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
const fail = (message, status = 400, code = 'validation_error') => { throw new HttpError(message, status, code) }
const payloadHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
// turns_used + updated_at: DB cập nhật updated_at mỗi khi bắt đầu trận / kết thúc một lượt => dùng làm mốc bắt đầu của lượt hiện tại (đồng hồ 60 giây).
const ROOM_COLUMNS = 'id, code, host_id, title, status, source_mode, topic, validation_mode, total_turns, turns_used, current_team_id, starting_phrase, allowed_phrases, created_at, updated_at'
// Cho phép lệch đồng hồ giữa máy chủ ứng dụng và DB một chút khi kiểm tra "đã hết giờ".
const REVEAL_CLOCK_TOLERANCE_MS = 5_000

function mapDbError(error) {
  if (error?.code === '22023' && error?.message?.toLowerCase().includes('idempotency key payload changed')) {
    return new HttpError('Khóa yêu cầu đã được dùng với nội dung khác.', 409, 'idempotency_conflict')
  }
  const status = error?.code === 'P0002' ? 404 : error?.code === '42501' ? 403 : error?.code === '40001' ? 409 : 503
  const messages = {
    'P0002': ['Không tìm thấy phòng Nối Từ.', 'room_not_found'],
    '42501': ['Bạn không có quyền thực hiện thao tác này.', 'forbidden'],
    '40001': ['Trạng thái trận vừa thay đổi. Hãy đồng bộ lại phòng.', 'game_state_conflict'],
    '22023': [error?.message?.includes('answer') ? 'Đáp án không hợp lệ.' : 'Dữ liệu trận không hợp lệ.', 'invalid_request'],
  }
  const [message, code] = messages[error?.code] || ['Máy chủ chưa thể xử lý phòng Nối Từ.', 'db_unavailable']
  if (error?.code !== 'P0002' && error?.code !== '42501' && error?.code !== '40001' && error?.code !== '22023') console.error('[word-chain] database error', error?.code || error?.message)
  return new HttpError(message, status, code)
}
async function db(query) { const result = await query; if (result.error) throw mapDbError(result.error); return result.data }
function requestId(value) { const id = String(value || ''); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null }
async function validateCreate(body = {}, deps = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {}
  const sourceMode = body.source_mode
  const validationMode = body.validation_mode || 'strict'
  const count = Number(body.team_count)
  const total = Number(body.total_turns)
  let source
  let quotas
  try {
    source = await resolveSource({ sourceMode, topic: body.topic || '', text: body.text || '', validationMode }, deps)
    quotas = allocateTurns(count, total)
  } catch (error) {
    if (error instanceof RangeError) fail(error.message, 400, 'invalid_word_chain_setup')
    throw error
  }
  const teamNames = Array.isArray(body.teams) ? body.teams.slice(0, count).map((name) => String(name).trim().slice(0, 32)) : []
  while (teamNames.length < count) teamNames.push(`Đội ${teamNames.length + 1}`)
  if (teamNames.some((name) => !name)) fail('Tên đội không được để trống.')
  if (new Set(teamNames.map(normalizePhrase)).size !== teamNames.length) fail('Tên các đội cần khác nhau.')
  const title = String(body.title || 'Trận Nối Từ').trim()
  if (!title || title.length > 80) fail('Tên trận phải có từ 1 đến 80 ký tự.')
  if (sourceMode !== 'topic' && source.extractedCount < 2) fail('Văn bản quá ngắn, chưa trích xuất được đủ cụm từ.')
  return { sourceMode, validationMode, source, quotas, teamNames, title, topic: String(body.topic || '').trim().slice(0, 80), total }
}

/** Phân tích nguồn: AI hiểu chủ đề (nếu dùng chủ đề), sau đó chỉ giữ cụm từ có nghĩa trong từ điển. */
export async function resolveSource({ sourceMode, topic = '', text = '', validationMode = 'strict' }, deps = {}) {
  const usesTopic = (sourceMode === 'topic' || sourceMode === 'combined') && normalizePhrase(topic)
  const aiTopic = usesTopic ? await (deps.analyzeTopic || analyzeTopicWithAI)(topic) : null
  const source = makePhraseSet({ sourceMode, topic, text, validationMode, aiTopic })
  return { ...source, aiUsed: Boolean(aiTopic) }
}

/** Dùng cho chế độ 1 máy: trả kho cụm từ và từ khởi đầu có nghĩa (luôn còn ít nhất một đáp án để nối). */
export async function previewSource(body = {}, deps = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {}
  const validationMode = body.validation_mode || 'strict'
  try {
    const source = await resolveSource({ sourceMode: body.source_mode, topic: body.topic || '', text: body.text || '', validationMode }, deps)
    const startingPhrase = chooseStartingPhrase(source.phrases)
    return { phrases: source.phrases, count: source.phrases.length, starting_phrase: startingPhrase, dictionary_version: source.version, ai_used: source.aiUsed, from_dictionary: source.fromDictionary, extracted_count: source.extractedCount, turn_time_limit: TURN_TIME_LIMIT_SECONDS }
  } catch (error) {
    if (error instanceof RangeError) fail(error.message, 400, 'invalid_word_chain_setup')
    throw error
  }
}

export async function createRoom(userId, body = {}, idempotency = null, deps = {}) {
  const input = await validateCreate(body, deps)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = makeCode()
    const { data, error } = await supabaseAdmin.rpc('create_word_chain_room_atomic', {
      p_room_id: randomUUID(), p_host_id: userId, p_code: code, p_title: input.title,
      p_source_mode: input.sourceMode, p_topic: input.topic || null, p_validation_mode: input.validationMode,
      p_total_turns: input.total, p_team_names: input.teamNames, p_turn_quotas: input.quotas,
      p_allowed_phrases: input.source.phrases, p_dictionary_version: input.source.version,
      p_payload_hash: payloadHash({ title: input.title, sourceMode: input.sourceMode, topic: input.topic, validationMode: input.validationMode, total: input.total, teamNames: input.teamNames, quotas: input.quotas, phrases: input.source.phrases, version: input.source.version }),
      p_request_id: requestId(idempotency),
    })
    if (!error) return getRoomState(data || code, userId)
    if (error.code === '23505') continue
    throw mapDbError(error)
  }
  fail('Không tạo được mã phòng. Hãy thử lại.', 503, 'room_unavailable')
}

async function findRoom(codeOrId) {
  const value = String(codeOrId || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(value) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail('Không tìm thấy phòng Nối Từ.', 404, 'room_not_found')
  const query = /^[A-Z0-9]{6}$/.test(value)
    ? supabaseAdmin.from('word_chain_rooms').select(ROOM_COLUMNS).eq('code', value).maybeSingle()
    : supabaseAdmin.from('word_chain_rooms').select(ROOM_COLUMNS).eq('id', value).maybeSingle()
  const room = await db(query)
  if (!room) fail('Không tìm thấy phòng Nối Từ.', 404, 'room_not_found')
  return room
}

export async function listOpenRooms() {
  const rooms = await db(supabaseAdmin.from('word_chain_rooms')
    .select('id, code, title, total_turns, created_at')
    .eq('status', 'lobby')
    .order('created_at', { ascending: false })
    .limit(50))
  if (!rooms?.length) return []
  const players = await db(supabaseAdmin.from('word_chain_players').select('room_id').in('room_id', rooms.map((room) => room.id)))
  const playerCounts = new Map()
  for (const player of players || []) playerCounts.set(player.room_id, (playerCounts.get(player.room_id) || 0) + 1)
  return rooms.map((room) => ({
    code: room.code,
    title: room.title,
    total_turns: room.total_turns,
    player_count: playerCounts.get(room.id) || 0,
    created_at: room.created_at,
  }))
}

export async function getRoomState(codeOrId, userId) {
  const room = await findRoom(codeOrId)
  const { host_id: _hostId, ...publicRoom } = room
  const [players, teams, turns] = await Promise.all([
    db(supabaseAdmin.from('word_chain_players').select('user_id, team_id, joined_at').eq('room_id', room.id).order('joined_at')),
    db(supabaseAdmin.from('word_chain_teams').select('id, name, turn_order, turn_quota, turns_used').eq('room_id', room.id).order('turn_order')),
    db(supabaseAdmin.from('word_chain_turns').select('id, turn_number, team_id, action, phrase, created_at').eq('room_id', room.id).order('turn_number')),
  ])
  const member = players.find((player) => player.user_id === userId)
  if (!member) fail('Bạn chưa tham gia phòng này.', 403, 'not_in_room')
  const { allowed_phrases: _privateSource, ...safeRoom } = publicRoom
  return {
    ...safeRoom,
    teams: teams.map((team) => ({ ...team, is_current: team.id === room.current_team_id, players: players.filter((p) => p.team_id === team.id).length })),
    players: players.map(({ team_id, joined_at }) => ({ team_id, joined_at })),
    history: turns,
    is_host: room.host_id === userId,
    current_user_team_id: member.team_id,
    // Đồng hồ lượt: mốc bắt đầu theo giờ máy chủ + giờ máy chủ hiện tại để client tự bù lệch đồng hồ.
    turn_time_limit: TURN_TIME_LIMIT_SECONDS,
    turn_started_at: room.status === 'playing' ? room.updated_at : null,
    server_time: new Date().toISOString(),
  }
}

export async function closeRoom(code, userId) {
  const room = await findRoom(code)
  if (room.host_id !== userId) fail('Chỉ chủ phòng mới có thể đóng phòng.', 403, 'host_required')
  if (room.status === 'cancelled') return { closed: true }
  if (room.status === 'finished') return { closed: false, finished: true }
  const updated = await db(supabaseAdmin.from('word_chain_rooms')
    .update({ status: 'cancelled' })
    .eq('id', room.id)
    .eq('host_id', userId)
    .in('status', ['lobby', 'playing'])
    .select('id')
    .maybeSingle())
  if (updated) return { closed: true }
  const latest = await findRoom(room.id)
  if (latest.status === 'cancelled') return { closed: true }
  if (latest.status === 'finished') return { closed: false, finished: true }
  fail('Trạng thái phòng vừa thay đổi. Hãy đồng bộ lại phòng.', 409, 'game_state_conflict')
}

export async function joinRoom(code, userId) {
  const room = await findRoom(code)
  const { error } = await supabaseAdmin.rpc('join_word_chain_room_atomic', { p_room_id: room.id, p_user_id: userId })
  if (error) throw mapDbError(error)
  return getRoomState(room.id, userId)
}

export async function startRoom(code, userId) {
  const room = await findRoom(code)
  const { error } = await supabaseAdmin.rpc('start_word_chain_room_atomic', { p_room_id: room.id, p_user_id: userId })
  if (error) throw mapDbError(error)
  return getRoomState(room.id, userId)
}

export async function submitAnswer(code, userId, body = {}, idempotency = null) {
  const room = await findRoom(code)
  const phrase = normalizePhrase(body.answer)
  if (!phrase) fail('Nhập một từ hoặc cụm từ có chữ cái.', 400, 'empty_answer')
  if (phrase.length > 80) fail('Đáp án không được dài quá 80 ký tự.', 400, 'answer_too_long')
  // Backend là cổng kiểm tra từ có nghĩa (kể cả luật Tự do): từ vô nghĩa không bao giờ chạm tới DB.
  if (phrase.split(' ').length < 2 || !isDictionaryPhrase(phrase)) fail(`“${phrase}” không phải từ có nghĩa trong từ điển tiếng Việt (cần từ 2–4 tiếng).`, 400, 'not_in_dictionary')
  const { error } = await supabaseAdmin.rpc('apply_word_chain_turn_atomic', {
    p_room_id: room.id, p_user_id: userId, p_action: 'answer', p_phrase: phrase,
    p_payload_hash: payloadHash({ action: 'answer', phrase }),
    p_request_id: requestId(idempotency) || randomUUID(),
  })
  if (error) {
    if (['22023', '23505'].includes(error.code)) {
      if (error.message?.toLowerCase().includes('idempotency key payload changed')) throw mapDbError(error)
      // Return useful rule messages only after a server-side state read; SQL remains the final validator.
      const state = await getRoomState(room.id, userId)
      const current = state.teams.find((team) => team.is_current)
      const last = state.history.filter((turn) => turn.action === 'answer').at(-1)?.phrase || room.starting_phrase || ''
      try {
        validateAnswer({ answer: phrase, lastPhrase: last, allowedPhrases: new Set(room.allowed_phrases), validationMode: room.validation_mode, usedPhrases: [room.starting_phrase, ...state.history.filter((turn) => turn.action === 'answer').map((turn) => turn.phrase)].filter(Boolean) })
      } catch (ruleError) {
        if (ruleError instanceof WordChainRuleError) fail(ruleError.message, 400, ruleError.code)
      }
      if (error.code === '23505') fail('Yêu cầu này đã được xử lý.', 409, 'duplicate_request')
      fail(current ? 'Đáp án không hợp lệ hoặc trận đã đổi lượt.' : 'Trận đã kết thúc.', 409, 'invalid_turn')
    }
    throw mapDbError(error)
  }
  return getRoomState(room.id, userId)
}

export async function skipTurn(code, userId, idempotency = null) {
  const room = await findRoom(code)
  const { error } = await supabaseAdmin.rpc('apply_word_chain_turn_atomic', {
    p_room_id: room.id, p_user_id: userId, p_action: 'skip', p_phrase: null,
    p_payload_hash: payloadHash({ action: 'skip' }),
    p_request_id: requestId(idempotency) || randomUUID(),
  })
  if (error) throw mapDbError(error)
  return getRoomState(room.id, userId)
}

/**
 * Hết 60 giây của lượt hiện tại: trả một đáp án hợp lệ cho mọi người chơi trong phòng.
 * Máy chủ tự kiểm tra đã đủ thời gian (dựa trên updated_at của phòng) để không ai xem đáp án sớm.
 * Không ghi gì vào DB: đáp án chỉ để hiển thị, đội vẫn bấm "Bỏ lượt" để sang lượt kế tiếp.
 */
export async function revealAnswer(code, userId) {
  const room = await findRoom(code)
  const state = await getRoomState(room.id, userId) // kiểm tra người gọi có trong phòng
  if (room.status !== 'playing') fail('Trận chưa bắt đầu hoặc đã kết thúc.', 409, 'room_not_playing')
  const elapsedMs = Date.now() - Date.parse(room.updated_at)
  if (!Number.isFinite(elapsedMs) || elapsedMs < TURN_TIME_LIMIT_SECONDS * 1000 - REVEAL_CLOCK_TOLERANCE_MS) {
    fail(`Chưa hết ${TURN_TIME_LIMIT_SECONDS} giây của lượt này.`, 409, 'turn_not_expired')
  }
  const answers = state.history.filter((turn) => turn.action === 'answer').map((turn) => turn.phrase)
  const answer = findAnswer({
    lastPhrase: answers.at(-1) || room.starting_phrase || '',
    usedPhrases: [room.starting_phrase, ...answers].filter(Boolean),
    allowedPhrases: room.allowed_phrases,
    validationMode: room.validation_mode,
  })
  return { answer, turn_number: (room.turns_used || 0) + 1 }
}

export async function joinByCode(code, userId) { return joinRoom(code, userId) }
