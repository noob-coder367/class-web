import { Link2, PartyPopper, Trophy, Wrench } from 'lucide-react'
import { ROUTES } from './routes.js'

/**
 * Registry cho các game dạng PHÒNG (host tạo phòng + passcode). Backend và trang
 * Tạo phòng dùng danh sách này, nên KHÔNG thêm game chơi trực tiếp vào đây.
 */
export const GAME_MODES = Object.freeze([
  Object.freeze({
    id: 'treasure-race',
    apiMode: 'treasure_race',
    title: 'Đua tới kho báu',
    description: 'Chia đội, trả lời câu hỏi và đua tới kho báu. Đội trả lời tốt sẽ tiến về phía trước nhanh hơn.',
    status: 'Sẵn sàng',
    icon: Trophy,
    previewLabel: 'START',
    createPath: ROUTES.createRoom,
    roomPath: ROUTES.room,
    defaultRoomTitle: 'Phòng đua kho báu',
    supportsBoardLength: true,
    supportsTimer: true,
    joinAction: 'passcode',
    joinLabel: 'Vào phòng bằng passcode',
    joinDescription: 'Nhập mã phòng 6 ký tự do host chia sẻ để tham gia Đua tới kho báu.',
  }),
  Object.freeze({
    id: 'quiz-party',
    apiMode: 'quiz_party',
    title: 'Quiz Party — Đại chiến mini-game',
    description: 'Trả lời quiz qua các thử thách ngắn được hệ thống chọn ngẫu nhiên: đập đáp án, đảo an toàn, đấu trùm và nhiều hơn nữa.',
    status: 'Mới',
    icon: PartyPopper,
    previewLabel: 'PARTY!',
    createPath: ROUTES.createRoom,
    roomPath: ROUTES.quizParty,
    defaultRoomTitle: 'Quiz Party',
    supportsBoardLength: false,
    supportsTimer: false,
    createLabel: 'Tạo phòng Quiz Party',
    joinAction: 'passcode',
    joinLabel: 'Vào phòng bằng passcode',
    joinDescription: 'Nhập mã phòng 6 ký tự để tham gia Quiz Party.',
  }),
])

export function gameModeById(id) {
  return GAME_MODES.find((mode) => mode.id === id) || null
}

export function gameModeByApiMode(apiMode) {
  return GAME_MODES.find((mode) => mode.apiMode === apiMode) || null
}

export function roomPathForApiMode(apiMode) {
  return gameModeByApiMode(apiMode)?.roomPath || ROUTES.room
}

function roomGame(id, extra) {
  const mode = gameModeById(id)
  return Object.freeze({ ...mode, kind: 'room', kindLabel: 'Phòng online', ...extra, facts: Object.freeze(extra.facts) })
}

/**
 * NGUỒN DUY NHẤT cho danh sách game hiển thị: trang chọn game, trang chi tiết và
 * Admin → "Quản lý các trò chơi" đều đọc từ đây. Thêm game mới = thêm 1 mục ở đây
 * (id chính là game_key trong bảng game_mode_images).
 */
export const GAME_CATALOG = Object.freeze([
  roomGame('treasure-race', {
    teamsLabel: '2–8 đội',
    facts: [
      ['Hình thức', 'Phòng theo đội · vào bằng passcode 6 ký tự'],
      ['Số đội', '2–8 đội'],
      ['Bàn cờ', '10–50 ô'],
      ['Bộ câu hỏi', 'Dùng quiz do host chọn'],
    ],
  }),
  roomGame('quiz-party', {
    teamsLabel: '2–8 đội',
    facts: [
      ['Hình thức', 'Phòng theo đội · vào bằng passcode 6 ký tự'],
      ['Số đội', '2–8 đội'],
      ['Thử thách', 'Mini-game được hệ thống chọn ngẫu nhiên'],
      ['Bộ câu hỏi', 'Dùng quiz do host chọn'],
    ],
  }),
  Object.freeze({
    id: 'bolt-sort',
    title: 'Đại chiến Bu Lông',
    description: 'Giải đố sắp xếp bu lông nhiều màu, trả lời câu hỏi và thi đấu song song trên một màn hình.',
    status: 'Mới',
    icon: Wrench,
    kind: 'solo',
    kindLabel: 'Chơi ngay',
    teamsLabel: '2 đội',
    joinPath: ROUTES.boltSort,
    joinLabel: 'Chơi ngay',
    facts: Object.freeze([
      ['Hình thức', 'Chơi ngay · toàn màn hình'],
      ['Số đội', '2 đội'],
      ['Cấp độ', '4 cấp độ'],
      ['Cách chơi', 'Sắp xếp bu lông, trả lời câu hỏi, thi đấu song song'],
    ]),
  }),
  Object.freeze({
    id: 'word-chain',
    title: 'Nối Từ',
    description: 'Nối cụm từ theo từ cuối, chơi một máy hoặc tạo phòng đấu cùng bạn bè.',
    status: 'Mới',
    icon: Link2,
    kind: 'solo',
    kindLabel: 'Một máy / phòng online',
    teamsLabel: '2–8 đội',
    joinPath: ROUTES.wordChain,
    joinLabel: 'Thiết lập & chơi',
    facts: Object.freeze([
      ['Hình thức', 'Một máy hoặc phòng online'],
      ['Số đội', '2–8 đội'],
      ['Thiết lập', 'Theo chủ đề hoặc văn bản'],
      ['Cách chơi', 'Nối cụm từ theo từ cuối'],
    ]),
  }),
])

export function gameCatalogById(id) {
  return GAME_CATALOG.find((game) => game.id === id) || null
}

export function gameDetailPath(id) {
  return `${ROUTES.gameDetail}/${id}`
}

/** Link tạo phòng đã chọn sẵn game (CreateRoomPage đọc ?mode=). */
export function gameCreateLink(game) {
  if (!game?.createPath) return null
  return `${game.createPath}?mode=${encodeURIComponent(game.id)}`
}
