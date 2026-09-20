import { useCallback, useState } from 'react'
import './GlobalRefreshButton.css'

function IconRefresh({ spinning }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={spinning ? 'global-refresh-icon global-refresh-icon--spin' : 'global-refresh-icon'}
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

/**
 * Nút Refresh cố định góc trái dưới — luôn hiện trên mọi màn hình.
 * - Màn hình chính: tải lại dữ liệu trang chủ (announcements, ảnh, unread…)
 * - Trong lớp: phát event classweb-class-refresh để các tab/board tải lại
 *   nhưng vẫn giữ nguyên tab đang mở (vd. Thời khoá biểu).
 */
export default function GlobalRefreshButton() {
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = useCallback(() => {
    if (spinning) return
    setSpinning(true)

    // Phát event chung — ClassRoomView, boards, HomePage đều lắng nghe
    window.dispatchEvent(new CustomEvent('classweb-class-refresh'))
    window.dispatchEvent(new CustomEvent('classweb-unread-updated'))
    // Event riêng cho trang chủ (ảnh site, announcements public…)
    window.dispatchEvent(new CustomEvent('classweb-home-refresh'))

    // Animation ngắn rồi tắt spin
    window.setTimeout(() => setSpinning(false), 700)
  }, [spinning])

  return (
    <button
      type="button"
      className="global-refresh-btn"
      onClick={handleRefresh}
      disabled={spinning}
      title="Tải lại"
      aria-label="Tải lại trang"
    >
      <IconRefresh spinning={spinning} />
      <span className="global-refresh-label">Tải lại</span>
    </button>
  )
}
