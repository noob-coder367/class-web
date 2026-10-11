import { supabaseAdmin } from '../../config/supabaseClient.js'

// Phòng bị bỏ dở (đóng tab, mất mạng, host thoát) không bao giờ được chuyển sang "finished",
nên trang admin vẫn thấy "Đang chơi" còn trang game thì không liệt kê. Service này đóng các phòng đó
// (status -> 'cancelled') để cả hai nơi dùng chung một nguồn sự thật.

// Phòng ở sảnh quá lâu: khớp với OPEN_ROOM_WINDOW_MS ở openRooms.service.js.
export const LOBBY_TTL_MS = 6 * 60 * 60 * 1000
// Phòng đang chơi mà không có câu trả lời nào trong khoảng này được coi là bỏ dở.
export const ACTIVE_TTL_MS = 3 * 60 * 60 * 1000
// Tránh quét DB trên mỗi request.
const MIN_INTERVAL_MS = 60 * 1000
const BATCH_LIMIT = 200
const CHUNK = 100
const CLOSABLE = ['lobby', 'ordering', 'playing']

let lastRunAt = 0
let inflight = null

const isoAgo = (ms) => new Date(Date.now() - ms).toISOString()
const chunks = (items, size = CHUNK) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

async function rows(query, label) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.code || error.message}`)
  return data || []
}

async function cancelRooms(ids) {
  let closed = 0
  for (const part of chunks(ids)) {
    // Điều kiện status giúp không đè lên phòng vừa kết thúc bình thường trong lúc quét.
    const updated = await rows(
      supabaseAdmin.from('game_rooms').update({ status: 'cancelled' }).in('id', part).in('status', CLOSABLE).select('id'),
      'cancel-rooms',
    )
    closed += updated.length
  }
  return closed
}

async function staleWaitingRoomIds() {
  const waiting = await rows(
    supabaseAdmin.from('game_rooms').select('id').in('status', ['lobby', 'ordering']).lt('created_at', isoAgo(LOBBY_TTL_MS)).limit(BATCH_LIMIT),
    'stale-waiting',
  )
  return waiting.map((room) => room.id)
}

async function stalePlayingRoomIds() {
  const activeCutoff = isoAgo(ACTIVE_TTL_MS)
  // game_rooms.updated_at chỉ đổi khi bắt đầu/kết thúc, nên lọc thô bằng nó rồi kiểm tra hoạt động thật qua game_turns.
  const candidates = await rows(
    supabaseAdmin.from('game_rooms').select('id').eq('status', 'playing').lt('updated_at', activeCutoff).limit(BATCH_LIMIT),
    'stale-playing',
  )
  if (!candidates.length) return []
  const roomIds = candidates.map((room) => room.id)

  const games = []
  for (const part of chunks(roomIds)) games.push(...await rows(supabaseAdmin.from('game_games').select('id, room_id').in('room_id', part), 'stale-games'))
  const gameByRoom = new Map(games.map((game) => [game.room_id, game.id]))

  const aliveGames = new Set()
  const gameIds = games.map((game) => game.id)
  for (const part of chunks(gameIds)) {
    const turns = await rows(supabaseAdmin.from('game_turns').select('game_id').in('game_id', part).gte('created_at', activeCutoff), 'recent-turns')
    for (const turn of turns) aliveGames.add(turn.game_id)
  }
  return roomIds.filter((roomId) => !aliveGames.has(gameByRoom.get(roomId)))
}

async function sweep() {
  const [waiting, playing] = await Promise.all([staleWaitingRoomIds(), stalePlayingRoomIds()])
  const closed = await cancelRooms([...new Set([...waiting, ...playing])])
  if (closed) console.info(`[room-lifecycle] closed ${closed} stale room(s)`)
  return closed
}

// Gọi trước khi liệt kê phòng (admin + trang game). Không bao giờ ném lỗi để không làm hỏng danh sách.
export function expireStaleRooms({ force = false } = {}) {
  if (inflight) return inflight
  if (!force && Date.now() - lastRunAt < MIN_INTERVAL_MS) return Promise.resolve(0)
  lastRunAt = Date.now()
  inflight = sweep()
    .catch((error) => { console.error('[room-lifecycle] sweep failed', error?.message || error); return 0 })
    .finally(() => { inflight = null })
  return inflight
}
