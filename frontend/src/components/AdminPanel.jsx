import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import * as adminService from '../services/adminService.js'
import './AdminPanel.css'

/**
 * Trước đây component này gọi thẳng `supabase.from('profiles')...`
 * bằng anon key, chỉ được bảo vệ bởi RLS (nếu có). Nay mọi thao tác
 * đi qua backend (adminService -> /api/admin/*), được canh gác bởi
 * middleware requireAuth + requireAdmin ở server.
 */
export default function AdminPanel({ onClose }) {
  const { profile } = useAuth()
  const currentUserId = profile?.id

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await adminService.getUsers()
      setUsers(data)
    } catch (err) {
      console.error('Lỗi lấy danh sách user:', err)
      alert(err.message || 'Không thể tải danh sách tài khoản!')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleMember = async (userId, currentStatus) => {
    try {
      await adminService.toggleMember(userId, currentStatus)
      fetchUsers()
    } catch (err) {
      alert('Cập nhật thất bại: ' + err.message)
    }
  }

  const handleToggleRole = async (userId, currentRole) => {
    if (userId === currentUserId && currentRole === 'admin') {
      return alert('⚠️ Bạn không thể tự gỡ quyền Admin của chính mình!')
    }
    try {
      await adminService.toggleRole(userId, currentRole)
      fetchUsers()
    } catch (err) {
      alert('Đổi quyền thất bại: ' + err.message)
    }
  }

  const handleDeleteUser = async (userId, username) => {
    if (userId === currentUserId) {
      return alert('⛔ Bạn không thể tự xóa chính tài khoản của mình!')
    }

    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa tài khoản "${username}"?`
    )
    if (!confirmDelete) return

    try {
      await adminService.deleteUser(userId)
      alert('Đã xóa tài khoản thành công!')
      fetchUsers()
    } catch (err) {
      alert('Xóa tài khoản thất bại: ' + err.message)
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
                            <button
                              className="btn-action btn-member"
                              onClick={() => handleToggleMember(u.id, u.is_member)}
                            >
                              {u.is_member ? 'Hủy 10A4' : 'Duyệt 10A4'}
                            </button>

                            <button
                              className="btn-action btn-role"
                              disabled={isMe && u.role === 'admin'}
                              onClick={() => handleToggleRole(u.id, u.role)}
                              title={isMe ? 'Bạn không thể tự gỡ quyền Admin của chính mình' : ''}
                            >
                              {u.role === 'admin' ? 'Hạ User' : 'Lên Admin'}
                            </button>

                            <button
                              className="btn-action btn-delete"
                              disabled={isMe}
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              style={{
                                opacity: isMe ? 0.4 : 1,
                                cursor: isMe ? 'not-allowed' : 'pointer',
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
