import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import * as adminService from '../services/adminService.js'
import SiteImagesPanel from './SiteImagesPanel.jsx'
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  ROLES,
  isAdminRole,
  normalizeRole,
  roleBadgeClass,
  roleLabel,
} from '../lib/roles.js'
import './AdminPanel.css'

export default function AdminPanel({ onClose }) {
  const { profile } = useAuth()
  const currentUserId = profile?.id

  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [roleBusyId, setRoleBusyId] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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
    if (deletingId) return
    try {
      await adminService.toggleMember(userId, currentStatus)
      fetchUsers()
    } catch (err) {
      alert('Cập nhật thất bại: ' + err.message)
    }
  }

  const handleRename = async (userId, currentName) => {
    if (deletingId) return
    const next = window.prompt(
      'Nhập tên hiển thị mới:',
      currentName || ''
    )
    if (next === null) return
    try {
      await adminService.updateUsername(userId, next)
      fetchUsers()
    } catch (err) {
      alert('Đổi tên thất bại: ' + (err.message || ''))
    }
  }

  const handleSetRole = async (userId, currentRole, nextRole, username) => {
    if (deletingId || roleBusyId) return
    const from = normalizeRole(currentRole)
    const to = normalizeRole(nextRole)
    if (from === to) return

    if (userId === currentUserId && isAdminRole(from) && to !== ROLES.ADMIN) {
      return alert('⚠️ Bạn không thể tự gỡ quyền Admin của chính mình!')
    }

    const name = username || 'tài khoản này'
    const confirmText =
      to === ROLES.ADMIN
        ? `Phong Admin cho "${name}"?\nHọ sẽ có toàn quyền (kể cả truyền chức). Bạn vẫn giữ quyền Admin của mình.`
        : to === ROLES.USER
          ? `Hạ "${name}" về Thành viên thường?`
          : `Bổ nhiệm "${name}" làm ${ROLE_LABELS[to]}?`

    if (!window.confirm(confirmText)) return

    setRoleBusyId(userId)
    try {
      await adminService.setRole(userId, to)
      await fetchUsers()
    } catch (err) {
      alert('Đổi quyền thất bại: ' + err.message)
    } finally {
      setRoleBusyId(null)
    }
  }

  const handleDeleteUser = async (userId, username) => {
    if (userId === currentUserId) {
      return alert('⛔ Bạn không thể tự xóa chính tài khoản của mình!')
    }
    if (deletingId) return

    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa tài khoản "${username || 'Chưa đặt tên'}"?`
    )
    if (!confirmDelete) return

    setDeletingId(userId)
    try {
      await adminService.deleteUser(userId)
      alert('Đã xóa tài khoản thành công!')
      await fetchUsers()
    } catch (err) {
      alert('Xóa tài khoản thất bại: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div
      className="admin-overlay fade-in"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="admin-modal slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="admin-header">
          <h2>Quản lý lớp 10A4</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="admin-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={tab === 'users' ? 'active' : ''}
            onClick={() => setTab('users')}
          >
            Tài khoản
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'images'}
            className={tab === 'images' ? 'active' : ''}
            onClick={() => setTab('images')}
          >
            Ảnh website
          </button>
        </div>

        <div className="admin-body">
          {tab === 'images' ? (
            <SiteImagesPanel />
          ) : loading ? (
            <p className="loading-text">Đang tải danh sách người dùng...</p>
          ) : users.length === 0 ? (
            <p className="empty-state">Chưa có người dùng nào trong hệ thống.</p>
          ) : (
            <>
              <p className="admin-role-hint">
                Chỉ Admin mới truyền được chức. Lớp phó học tập — Bài tập về nhà;
                Lớp phó kỷ luật — Nội quy lớp; Lớp phó sự kiện — Sự kiện & Thông báo chung.
              </p>
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
                      const isDeleting = deletingId === u.id
                      const role = normalizeRole(u.role)
                      const lockOwnAdmin = isMe && role === ROLES.ADMIN

                      return (
                        <tr key={u.id} className={isMe ? 'highlight-me' : ''}>
                          <td>
                            <strong className={u.needs_display_name ? 'username-pending' : ''}>
                              {u.username || 'Chưa đặt tên'}
                            </strong>
                            {isMe && <span className="tag-me"> (Bạn)</span>}
                          </td>

                          <td>
                            <span className={`badge ${roleBadgeClass(role)}`}>
                              {roleLabel(role)}
                            </span>
                          </td>

                          <td>
                            <span
                              className={
                                `badge ${
                                  u.is_member ? 'badge-success' : 'badge-muted'
                                }`
                              }
                            >
                              {u.is_member ? 'Đã xác minh' : 'Chưa xác minh'}
                            </span>
                          </td>

                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn-action btn-rename"
                                onClick={() => handleRename(u.id, u.username)}
                                title="Đổi tên hiển thị"
                                disabled={!!deletingId}
                              >
                                Đổi tên
                              </button>

                              <button
                                className="btn-action btn-member"
                                onClick={() => handleToggleMember(u.id, u.is_member)}
                                disabled={!!deletingId}
                              >
                                {u.is_member ? 'Hủy 10A4' : 'Duyệt 10A4'}
                              </button>

                              <label className="role-select-wrap">
                                <span className="sr-only">Truyền chức</span>
                                <select
                                  className="role-select"
                                  value={role}
                                  disabled={lockOwnAdmin || !!deletingId || roleBusyId === u.id}
                                  onChange={(e) =>
                                    handleSetRole(u.id, role, e.target.value, u.username)
                                  }
                                  title={
                                    lockOwnAdmin
                                      ? 'Bạn không thể tự gỡ quyền Admin của chính mình'
                                      : 'Chọn chức để truyền'
                                  }
                                >
                                  {ASSIGNABLE_ROLES.map((value) => (
                                    <option key={value} value={value}>
                                      {ROLE_LABELS[value]}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <button
                                className="btn-action btn-delete"
                                disabled={isMe || !!deletingId}
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                style={{
                                  opacity: isMe || isDeleting ? 0.4 : 1,
                                  cursor: isMe || isDeleting ? 'not-allowed' : 'pointer',
                                }}
                                title={
                                  isMe
                                    ? 'Bạn không thể tự xóa chính mình'
                                    : isDeleting
                                      ? 'Đang xóa...'
                                      : 'Xóa tài khoản này'
                                }
                              >
                                {isMe ? 'Chính bạn' : isDeleting ? 'Đang xóa...' : 'Xóa'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
