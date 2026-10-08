import { Trophy } from 'lucide-react'
import { ROUTES } from './routes.js'

/**
 * Single registry for implemented game modes. Coming-soon concepts are intentionally
 * not listed here, so they do not get Admin image slots until they are real modes.
 */
export const GAME_MODES = Object.freeze([
  Object.freeze({
    id: 'treasure-race',
    title: 'Đua tới kho báu',
    description: 'Chia đội, trả lời câu hỏi và đua tới kho báu. Đội trả lời tốt sẽ tiến về phía trước nhanh hơn.',
    status: 'Sẵn sàng',
    icon: Trophy,
    previewLabel: 'START',
    createPath: ROUTES.createRoom,
    joinAction: 'passcode',
    joinLabel: 'Vào phòng bằng passcode',
    joinDescription: 'Nhập mã phòng 6 ký tự do host chia sẻ để tham gia Đua tới kho báu.',
  }),
])

export function gameModeById(id) {
  return GAME_MODES.find((mode) => mode.id === id) || null
}
