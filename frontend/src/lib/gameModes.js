import { PartyPopper, Trophy } from 'lucide-react'
import { ROUTES } from './routes.js'

/**
 * Single registry for implemented game modes. Coming-soon concepts are intentionally
 * not listed here, so they do not get Admin image slots until they are real modes.
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
