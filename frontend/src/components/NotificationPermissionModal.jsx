import './NotificationPermissionModal.css'

export default function NotificationPermissionModal({ onAllow, onDeny }) {
  return (
    <div className="np-overlay" role="dialog" aria-modal="true">
      <div className="np-card">
        <h2>Bật thông báo đẩy?</h2>
        <p>
          Nhận thông báo khi có tin mới trong lớp (thông báo chung, cảnh báo học
          tập…). Bạn có thể tắt bất cứ lúc nào trong Cài đặt → Quyền riêng tư.
        </p>
        <div className="np-actions">
          <button type="button" className="np-btn np-btn--ghost" onClick={onDeny}>
            Không phải bây giờ
          </button>
          <button type="button" className="np-btn np-btn--primary" onClick={onAllow}>
            Cho phép
          </button>
        </div>
      </div>
    </div>
  )
}
