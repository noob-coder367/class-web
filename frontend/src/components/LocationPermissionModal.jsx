import { useWeather } from '../context/WeatherContext.jsx'
import './LocationPermissionModal.css'

export default function LocationPermissionModal() {
  const { showPrompt, loading, handleAllow, handleDeny } = useWeather()

  if (!showPrompt) return null

  return (
    <div className="loc-perm-overlay" role="dialog" aria-modal="true">
      <div className="loc-perm-card">
        <div className="loc-perm-icon">📍</div>
        <h3>Chia sẻ vị trí?</h3>
        <p>
          Cho phép truy cập vị trí để nền đại dương phản ánh thời tiết thực tế
          nơi bạn đang ở (nắng, mây, mưa…).
        </p>
        <p className="loc-perm-note">
          Chỉ hỏi một lần. Bạn có thể từ chối — nền sẽ giữ chế độ ngày–đêm bình
          thường.
        </p>
        <div className="loc-perm-actions">
          <button
            type="button"
            className="loc-perm-btn loc-perm-btn--deny"
            onClick={handleDeny}
            disabled={loading}
          >
            Không
          </button>
          <button
            type="button"
            className="loc-perm-btn loc-perm-btn--allow"
            onClick={handleAllow}
            disabled={loading}
          >
            {loading ? 'Đang lấy vị trí…' : 'Cho phép'}
          </button>
        </div>
      </div>
    </div>
  )
}
