import { useEffect } from 'react'
import './ClassRoomView.css'

/**
 * Khu vực nội bộ lớp 10A4 (chỉ member).
 * Hiện tại placeholder — sẽ bổ sung nội dung sau.
 */
export default function ClassRoomView({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="classroom-view" role="dialog" aria-modal="true" aria-label="Khu vực lớp 10A4">
      <button
        type="button"
        className="classroom-back"
        onClick={onClose}
        aria-label="Quay về trang chính"
        title="Quay về"
      >
        &lt;
      </button>

      <div className="classroom-body">
        <p className="classroom-empty">Chưa có nội dung</p>
      </div>
    </div>
  )
}
