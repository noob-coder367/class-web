import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './AdminPanel.css' // Tạo file CSS riêng hoặc gộp vào App.css

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    fetchCurrentAdmin()
    fetchUsers()
  }, [])

  // Lấy ID của Admin đang đăng nhập
  const fetchCurrentAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)
  }

  // Lấy danh sách toàn bộ tài khoản từ bảng profiles
  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Lỗi lấy danh sách user:', error)
      alert('Không thể tải danh sách tài khoản!')
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  // Bật/Tắt trạng thái Thành viên 10A4
  const handleToggleMember = async (userId, currentStatus) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_member: !currentStatus })
      .eq('id', userId)

    if (error) {
      alert('Cập nhật thất bại: ' + error.message)
    } else {
      fetchUsers()
    }
  }

  // Bật/Tắt quyền Admin (Có chặn tự hạ quyền chính mình)
  const handleToggleRole = async (userId, currentRole) => {
    if (userId === currentUserId && currentRole === 'admin') {
      return alert('⚠️ Bạn không thể tự gỡ quyền Admin của chính mình!')
    }

    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      alert('Đổi quyền thất bại: ' + error.message)
    } else {
      fetchUsers()
    }
  }

  // Xóa tài khoản (Có chặn tự xóa chính mình)
  const handleDeleteUser = async (userId, username) => {
    // 🛡️ CHẶN TỰ XÓA BẢN THÂN
    if (userId === currentUserId) {
      return alert('⛔ Bạn không thể tự xóa chính tài khoản của mình!')
    }

    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}"?`)
    if (!confirmDelete) return

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (error) {
      alert('Xóa tài khoản thất bại: ' + error.message)
    } else {
      alert('Đã xóa tài khoản thành công!')
      fetchUsers()
    }
  }

  return (
    <div className="admin-overlay fade-in">
      <div className="admin-modal slide-up">
        <div className="admin-header">
          <h2>Quản Lý Tài Khoản Lớp 10A4 🤓</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="admin-body">
          {loading ? (
            <p className="loading-text">Đang tải danh sách người dùng...</p>
          ) : users.length === 0 ? (
            <p className="empty-state">Chưa có người dùng nào trong hệ thống.</p>
          ) : (
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tên hiển thị</th>
                    <th>Vai trò</th>
                    <th>Thành viên 10A4</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isMe = u.id === currentUserId

                    return (
                      <tr key={u.id} className={isMe ? 'highlight-me' : ''}>
                        <td>
                          <strong>{u.username || 'Chưa đặt tên'}</strong>
                          {isMe && <span className="tag-me"> (Bạn)</span>}
                        </td>

                        <td>
                          <span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                            {u.role === 'admin' ? '👑 Admin' : 'Thành viên'}
                          </span>
                        </td>

                        <td>
                          <span className={`badge ${u.is_member ? 'badge-success' : 'badge-muted'}`}>
                            {u.is_member ? 'Đã xác minh' : 'Chưa xác minh'}
                          </span>
                        </td>

                        <td>
                          <div className="action-buttons">
                            {/* Nút Toggle Thành Viên */}
                            <button
                              className="btn-action btn-member"
                              onClick={() => handleToggleMember(u.id, u.is_member)}
                            >
                              {u.is_member ? 'Hủy 10A4' : 'Duyệt 10A4'}
                            </button>

                            {/* Nút Toggle Admin */}
                            <button
                              className="btn-action btn-role"
                              disabled={isMe && u.role === 'admin'}
                              onClick={() => handleToggleRole(u.id, u.role)}
                              title={isMe ? 'Bạn không thể tự gỡ quyền Admin của chính mình' : ''}
                            >
                              {u.role === 'admin' ? 'Hạ User' : 'Lên Admin'}
                            </button>

                            {/* Nút Xóa Tài Khoản */}
                            <button
                              className="btn-action btn-delete"
                              disabled={isMe}
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              style={{
                                opacity: isMe ? 0.4 : 1,
                                cursor: isMe ? 'not-allowed' : 'pointer'
                              }}
                              title={isMe ? 'Bạn không thể tự xóa chính mình' : 'Xóa tài khoản này'}
                            >
                              {isMe ? 'Chính bạn' : 'Xóa'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
