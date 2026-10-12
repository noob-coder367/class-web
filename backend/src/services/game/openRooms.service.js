import { supabaseAdmin } from '../../config/supabaseClient.js'
import { HttpError } from '../../lib/httpError.js'
import { expireStaleRooms } from './roomLifecycle.service.js'

// Phòng ở sảnh (lobby) quá lâu thường là phòng bỏ quên, nên chỉ liệt kê phòng tạo trong khoảng này.
export const OPEN_ROOM_WINDOW_MS = 6 * 60 * 60 * 1000
export const OPEN_ROOM_LIMIT = 20

// game_key (khớp GAME_CATALOG ở frontend) -> giá trị game_rooms.game_mode
const GAME_ROOM_MODES = Object.freeze({
  'treasure-race': 'treasure_race',
  'quiz-party': 'quiz_party',
})
const WORD_CHAIN_KEY = 'word-chain'

async function db(query) {
  const { data, error } = await query
  if (error) {
    console.error('[open-rooms] database error', error.code || error.message || error)
    throw new HttpError('Không thể tải danh sách phòng đang mở.', 503, 'open_rooms_unavailable')
  }
  return data || []
}

function countBy(rows, key) {
  const counts = new Map()
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) || 0) + 1)
  return counts
}

// Hợp nhất hai truy vấn (sảnh công khai và phòng của host), giữ thứ tự ưu tiên nguồn đầu.
export function mergeRoomCandidates(...sources) {
  const byId = new Map()
  for (const room of sources.flat()) if (room?.id) byId.set(room.id, room)
  return [...byId.values()]
}

export function filterOpenRoomCandidates(rooms, userId, hostPresentIds = new Set()) {
  return rooms.filter((room) => {
    if (room.settings?.single_device_mode === true) return false
    if (userId && room.host_id === userId) return true
    if (room.settings?.is_public === false) return false
    return room.status === 'lobby' || !hostPresentIds.has(room.id)
  })
}

export function prioritizeOwnerRooms(rooms, userId, limit = OPEN_ROOM_LIMIT) {
  const isOwner = (room) => Boolean(userId && room.host_id === userId)
  return [...rooms.filter(isOwner), ...rooms.filter((room) => !isOwner(room))].slice(0, limit)
}

// Tên host chỉ để hiển thị; nếu không đọc được thì bỏ qua chứ không làm hỏng cả danh sách.
async function hostNames(hostIds) {
  const ids = [...new Set(hostIds.filter(Boolean))]
  if (!ids.length) return new Map()
  const { data, error } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', ids)
  if (error) return new Map()
  return new Map((data || []).map((profile) => [profile.id, profile.full_name || null]))
}

function sinceIso() {
  return new Date(Date.now() - OPEN_ROOM_WINDOW_MS).toISOString()
}

async function listGameRooms(gameKey, userId) {
  const roomQuery = () => supabaseAdmin.from('game_rooms')
    .select('id, code, host_id, settings, status, created_at')
    .in('status', ['lobby', 'playing'])
    .eq('game_mode', GAME_ROOM_MODES[gameKey])
    .order('created_at', { ascending: false })
    .limit(50)
  const [publicRooms, ownerRooms] = await Promise.all([
    // Lọc ở DB trước LIMIT: phòng riêng/1 máy không được chiếm chỗ của phòng công khai.
    // JSONB containment chỉ loại boolean false/true chính xác; bản ghi cũ thiếu key vẫn công khai.
    db(roomQuery().not('settings', 'cs', '{"is_public":false}').not('settings', 'cs', '{"single_device_mode":true}').gte('created_at', sinceIso())),
    // Truy vấn riêng phòng của host, không giới hạn bởi cửa sổ 6 giờ hay LIMIT của sảnh công khai.
    userId
      ? db(roomQuery().eq('host_id', userId).not('settings', 'cs', '{"single_device_mode":true}'))
      : Promise.resolve([]),
  ])
  const rooms = mergeRoomCandidates(ownerRooms, publicRooms)
  if (!rooms.length) return []
  const [players, names] = await Promise.all([
    db(supabaseAdmin.from('game_room_players').select('room_id, user_id').in('room_id', rooms.map((room) => room.id))),
    hostNames(rooms.map((room) => room.host_id)),
  ])
  const counts = countBy(players, 'room_id')
  const hostPresent = new Set(players.filter((player) => rooms.some((room) => room.id === player.room_id && room.host_id === player.user_id)).map((player) => player.room_id))
  const visible = filterOpenRoomCandidates(rooms, userId, hostPresent)
  // Pin phòng thuộc host lên đầu để không bị 20 phòng công khai của người khác che mất.
  const open = prioritizeOwnerRooms(visible, userId)
  return open.map((room) => {
    const teamCount = Number(room.settings?.team_count) || 2
    const perTeam = Number(room.settings?.max_players_per_team) || 4
    const playerCount = counts.get(room.id) || 0
    const maxPlayers = teamCount * perTeam
    return {
      game_key: gameKey,
      code: room.code,
      status: room.status,
      is_public: room.settings?.is_public !== false,
      is_owner: room.host_id === userId,
      is_member: players.some((player) => player.room_id === room.id && player.user_id === userId),
      host_present: hostPresent.has(room.id),
      title: room.settings?.title || 'Phòng chơi',
      host_name: names.get(room.host_id) || null,
      is_host: room.host_id === userId && players.some((player) => player.room_id === room.id && player.user_id === userId),
      team_count: teamCount,
      player_count: playerCount,
      max_players: maxPlayers,
      full: playerCount >= maxPlayers,
      created_at: room.created_at,
    }
  })
}

async function listWordChainRooms(userId) {
  const rooms = await db(supabaseAdmin.from('word_chain_rooms')
    .select('id, code, host_id, title, created_at')
    .eq('status', 'lobby')
    .gte('created_at', sinceIso())
    .order('created_at', { ascending: false })
    .limit(OPEN_ROOM_LIMIT))
  if (!rooms.length) return []
  const ids = rooms.map((room) => room.id)
  const [players, teams, names] = await Promise.all([
    db(supabaseAdmin.from('word_chain_players').select('room_id').in('room_id', ids)),
    db(supabaseAdmin.from('word_chain_teams').select('room_id').in('room_id', ids)),
    hostNames(rooms.map((room) => room.host_id)),
  ])
  const playerCounts = countBy(players, 'room_id')
  const teamCounts = countBy(teams, 'room_id')
  return rooms.map((room) => ({
    game_key: WORD_CHAIN_KEY,
    code: room.code,
    title: room.title || 'Trận Nối Từ',
    host_name: names.get(room.host_id) || null,
    is_host: room.host_id === userId,
    team_count: teamCounts.get(room.id) || 0,
    player_count: playerCounts.get(room.id) || 0,
    max_players: null,
    full: false,
    created_at: room.created_at,
  }))
}

export async function listOpenRooms(gameKey, userId) {
  if (gameKey === WORD_CHAIN_KEY) return listWordChainRooms(userId)
  if (GAME_ROOM_MODES[gameKey]) {
    // Đóng phòng bỏ dở trước khi liệt kê để admin và trang game luôn khớp trạng thái.
    await expireStaleRooms()
    return listGameRooms(gameKey, userId)
  }
  // Game chơi trực tiếp (vd. bolt-sort) không có phòng.
  if (gameKey === 'bolt-sort') return []
  throw new HttpError('Mã trò chơi không hợp lệ.', 400, 'invalid_game_key')
}
