import { useEffect, useMemo, useState } from 'react'
import * as adminService from '../services/adminService.js'
import { ROLES, roleLabel } from '../lib/roles.js'

/** Lấy phần tên (chữ cuối) để sắp xếp A-Z kiểu Việt: Phạm Thanh Tùng → Tùng */
function nameSortKey(displayName) {
  const parts = String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return ''
  return parts[parts.length - 1].toLocaleLowerCase('vi')
}

function compareByGivenName(a, b) {
  const ka = nameSortKey(a)
  const kb = nameSortKey(b)
  const byGiven = ka.localeCompare(kb, 'vi', { sensitivity: 'base' })
  if (byGiven !== 0) return byGiven
  return String(a || '').localeCompare(String(b || ''), 'vi', { sensitivity: 'base' })
}

function GoogleMark() {
  return (
    <svg
      className="google-account-icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function ClassListPanel({ users = [] }) {
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState(users)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [connectTarget, setConnectTarget] = useState(null)
  const [connectQuery, setConnectQuery] = useState('')
  const [connectUserId, setConnectUserId] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [data, userData] = await Promise.all([
        adminService.getClassList(),
        users.length ? Promise.resolve(null) : adminService.getUsers().catch(() => []),
      ])
      setItems(Array.isArray(data?.items) ? data.items : [])
      if (Array.isArray(userData) && userData.length) setAccounts(userData)
    } catch (err) {
      setError(err.message || 'Không tải được danh sách lớp.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (users.length) setAccounts(users)
  }, [users])

  const realAccounts = useMemo(
    () => (accounts || []).filter((u) => u?.id && !u.needs_display_name),
    [accounts]
  )

  const sortedItems = useMemo(() => {
    return [...(items || [])].sort((a, b) =>
      compareByGivenName(a?.username, b?.username)
    )
  }, [items])

  const connectChoices = useMemo(() => {
    const q = connectQuery.trim().toLowerCase()
    const list = realAccounts.filter((u) => {
      if (!q) return true
      const name = String(u.username || '').toLowerCase()
      const email = String(u.google_email || u.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    if (!connectTarget) return list
    const preferred = new Set(connectTarget.match_user_ids || [])
    return [...list].sort((a, b) => {
      const ap = preferred.has(a.id) ? 0 : 1
      const bp = preferred.has(b.id) ? 0 : 1
      if (ap !== bp) return ap - bp
      return compareByGivenName(a.username, b.username)
    })
  }, [realAccounts, connectQuery, connectTarget])

  const handleAdd = async (e) => {
    e?.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError('')
    try {
      const data = await adminService.addClassListName(name)
      setItems(Array.isArray(data?.items) ? data.items : [])
      setNewName('')
      setAdding(false)
    } catch (err) {
      setError(err.message || 'Không thêm được tên.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!row?.roster_id) return
    if (!window.confirm(`Xóa tên "${row.username}" khỏi danh sách lớp?`)) return
    setBusyId(row.roster_id)
    setError('')
    try {
      const data = await adminService.deleteClassListName(row.roster_id)
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (err) {
      setError(err.message || 'Không xóa được tên.')
    } finally {
      setBusyId(null)
    }
  }

  const openConnect = (row) => {
    setConnectTarget(row)
    setConnectQuery('')
    const preferred = row.match_user_ids?.[0] || ''
    setConnectUserId(preferred)
  }

  const handleConnect = async () => {
    if (!connectTarget?.roster_id || !connectUserId) return
    const real = realAccounts.find((u) => u.id === connectUserId)
    const confirmText =
      `Kết nối "${connectTarget.username}" với tài khoản "${real?.username || 'đã chọn'}"?\n\n`
      + `Nội quy (BXH, danh sách vi phạm) và vệ sinh gắn tên cũ sẽ chuyển sang tài khoản thật. Tên chờ kết nối sẽ bị xóa.`
    if (!window.confirm(confirmText)) return

    setBusyId(connectTarget.roster_id)
    setError('')
    try {
      const data = await adminService.connectClassListName(connectTarget.roster_id, connectUserId)
      setItems(Array.isArray(data?.items) ? data.items : [])
      setConnectTarget(null)
      setConnectUserId('')
      if (data?.message) {
        window.alert(data.message)
      }
    } catch (err) {
      setError(err.message || 'Kết nối thất bại.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <p className="loading-text">Đang tải danh sách lớp...</p>
  }

  return (
    <div className="class-list-panel">
      <p className="admin-role-hint">
        Danh sách lớp gồm tên hiển thị của mọi tài khoản đã đăng ký (kể cả Admin)
        và các tên bạn thêm trước. Tên thêm trước dùng được ngay ở nội quy lớp và vệ sinh.
        Khi bạn đó đã có tài khoản thật, bấm <strong>Kết nối</strong> để đồng bộ BXH / vi phạm / lịch trực,
        rồi xóa tên giả khỏi danh sách.
      </p>

      {error ? <p className="class-list-error">{error}</p> : null}

      <div className="table-wrapper">
        <table className="admin-table class-list-table">
          <thead>
            <tr>
              <th className="col-stt">STT</th>
              <th>Tên hiển thị</th>
              <th>Trạng thái</th>
              <th>Vai trò</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  Chưa có tên nào. Bấm Thêm để nhập học sinh chưa đăng ký.
                </td>
              </tr>
            ) : (
              sortedItems.map((row, index) => {
                const isFake = row.is_placeholder === true
                const hasMatch = isFake && (row.match_user_ids || []).length > 0
                return (
                  <tr key={row.id} className={isFake ? 'class-list-row-fake' : ''}>
                    <td className="col-stt">{index + 1}</td>
                    <td>
                      <strong>{row.username || 'Chưa đặt tên'}</strong>
                      {hasMatch ? (
                        <span className="class-list-match">
                          {' '}
                          · trùng {row.match_names?.join(', ')}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {isFake ? (
                        <span className="badge badge-pending-link">Chờ kết nối</span>
                      ) : (
                        <span className="badge badge-success">Đã đăng ký</span>
                      )}
                    </td>
                    <td>
                      {isFake ? (
                        <span className="google-account-empty">—</span>
                      ) : (
                        <span className={`badge ${row.role === ROLES.ADMIN ? 'badge-admin' : 'badge-user'}`}>
                          {roleLabel(row.role)}
                        </span>
                      )}
                    </td>
                    <td>
                      {isFake ? (
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn-action btn-connect"
                            disabled={!!busyId}
                            onClick={() => openConnect(row)}
                          >
                            Kết nối
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-delete"
                            disabled={!!busyId}
                            onClick={() => handleDelete(row)}
                          >
                            {busyId === row.roster_id ? 'Đang xóa...' : 'Xóa'}
                          </button>
                        </div>
                      ) : (
                        <span className="google-account-empty">Tài khoản thật</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {adding ? (
        <form className="class-list-add" onSubmit={handleAdd}>
          <input
            autoFocus
            className="class-list-add-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nhập họ và tên"
            maxLength={40}
            disabled={saving}
          />
          <button type="submit" className="btn-action btn-member" disabled={saving || !newName.trim()}>
            {saving ? 'Đang thêm...' : 'Lưu tên'}
          </button>
          <button
            type="button"
            className="btn-action btn-rename"
            disabled={saving}
            onClick={() => {
              setAdding(false)
              setNewName('')
            }}
          >
            Hủy
          </button>
        </form>
      ) : (
        <div className="class-list-add-row">
          <button type="button" className="btn-action btn-add-class" onClick={() => setAdding(true)}>
            + Thêm
          </button>
        </div>
      )}

      {connectTarget ? (
        <div
          className="class-list-connect-overlay"
          role="presentation"
          onClick={() => !busyId && setConnectTarget(null)}
        >
          <div
            className="class-list-connect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-list-connect-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="class-list-connect-head">
              <div>
                <p>Kết nối tài khoản thật</p>
                <h3 id="class-list-connect-title">{connectTarget.username}</h3>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setConnectTarget(null)}
                disabled={!!busyId}
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>
            <p className="class-list-connect-hint">
              Tìm và chọn tài khoản đã đăng nhập. Nội dung nội quy lớp và vệ sinh của tên này
              sẽ chuyển sang tài khoản đó, rồi tên giả bị xóa khỏi danh sách.
            </p>
            <input
              className="class-list-add-input"
              value={connectQuery}
              onChange={(e) => setConnectQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc email Google"
              disabled={!!busyId}
            />
            <div className="class-list-connect-list" role="listbox" aria-label="Tài khoản thật">
              {connectChoices.length === 0 ? (
                <p className="empty-state">Không tìm thấy tài khoản phù hợp.</p>
              ) : (
                connectChoices.map((u) => {
                  const selected = connectUserId === u.id
                  const suggested = (connectTarget.match_user_ids || []).includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`class-list-connect-item${selected ? ' is-selected' : ''}`}
                      onClick={() => setConnectUserId(u.id)}
                      disabled={!!busyId}
                    >
                      <span className="class-list-connect-name">
                        <strong>{u.username || 'Chưa đặt tên'}</strong>
                        {suggested ? <span className="class-list-match"> trùng tên</span> : null}
                      </span>
                      {u.google_email ? (
                        <span className="google-account">
                          <GoogleMark />
                          {u.google_email}
                        </span>
                      ) : (
                        <span className="google-account-empty">Không có Google</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
            <div className="class-list-connect-actions">
              <button
                type="button"
                className="btn-action btn-rename"
                disabled={!!busyId}
                onClick={() => setConnectTarget(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-action btn-connect"
                disabled={!connectUserId || !!busyId}
                onClick={handleConnect}
              >
                {busyId ? 'Đang đồng bộ...' : 'Kết nối'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
