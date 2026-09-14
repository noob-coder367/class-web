import './NotificationPermissionModal.css'

export default function NotificationPermissionModal({ onAllow, onDeny, blocked = false }) {
  return (
    <div className="np-overlay" role="dialog" aria-modal="true">
      <div className="np-card">
        <h2>Bật thông báo đẩy</h2>
        {blocked ? (
          <p>
            Trình duyệt đang chặn thông báo của trang này. Mở cài đặt trang web →
            Thông báo → <strong>Cho phép</strong>, rồi nhấn lại nút bên dưới.
            Thành viên 10A4 cần bật để nhận tin kiểm tra, báo bài và thông báo lớp.
          </p>
        ) : (
          <p>
            Thành viên 10A4 cần bật thông báo đẩy để nhận tin kiểm tra, báo bài và
            thông báo lớp. Bạn có thể tắt sau trong Cài đặt → Quyền riêng tư.
          </p>
        )}
        <div className="np-actions">
          <button type="button" className="np-btn np-btn--ghost" onClick={onDeny}>
            Để sau
          </button>
          <button type="button" className="np-btn np-btn--primary" onClick={onAllow}>
            Bật thông báo
          </button>
        </div>
      </div>
    </div>
  )
}