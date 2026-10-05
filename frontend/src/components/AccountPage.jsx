import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import * as classroomService from '../services/classroomService.js'
import * as authService from '../services/authService.js'
import { roleLabel } from '../lib/roles.js'
import { classTabPath, accountEditPath } from '../lib/routes.js'
import './AccountPage.css'

const EMPTY = { fullName: '', gender: '', province: '', school: '', parentPhone: '', facebookUrl: '' }
const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d).{8,}$/

function Icon({ children }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

function PasswordField({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <label className="acc-field">
      <span className="acc-label-normal">{label}</span>
      <span className="acc-input-wrap">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
        <button type="button" className="acc-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
          <Icon>{show ? <><path d="M17.9 17.9A10.6 10.6 0 0 1 12 19.5C6.5 19.5 2.5 12 2.5 12a19 19 0 0 1 4.2-5.3" /><path d="M9.9 4.6A9.7 9.7 0 0 1 12 4.5c5.5 0 9.5 7.5 9.5 7.5a19 19 0 0 1-2.2 3.1" /><path d="M3 3l18 18" /></> : <><path d="M2.5 12S6.5 5 12 5s9.5 7 9.5 7-4 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></>}</Icon>
        </button>
      </span>
    </label>
  )
}

export default function AccountPage({ editing }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(EMPTY)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await classroomService.getMemberProfile()
        if (cancelled) return
        setData({ ...EMPTY, ...(res?.memberProfile || {}) })
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Không tải được thông tin cá nhân.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Vào trang chỉnh sửa thì đổ dữ liệu hiện tại vào form.
  useEffect(() => {
    if (editing) { setForm({ ...EMPTY, ...data }); setSaveError('') }
  }, [editing, data])

  const roleText = !profile?.role || profile.role === 'user' ? 'Học sinh' : roleLabel(profile.role)
  const displayName = data.fullName || profile?.username || 'Thành viên'
  const show = (value) => (value ? value : '-')

  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await classroomService.saveMemberProfile(form)
      setData({ ...EMPTY, ...(res?.memberProfile || form) })
      setNotice('Đã lưu thông tin cá nhân.')
      navigate(classTabPath('account'))
    } catch (err) {
      setSaveError(err.message || 'Không lưu được. Thử lại nhé.')
    } finally { setSaving(false) }
  }

  const changePassword = async () => {
    setPwMsg({ type: '', text: '' })
    if (!currentPw) return setPwMsg({ type: 'err', text: 'Vui lòng nhập mật khẩu hiện tại.' })
    if (!PASSWORD_RULE.test(newPw)) return setPwMsg({ type: 'err', text: 'Mật khẩu mới cần có ít nhất 1 chữ hoa, 1 số, độ dài tối thiểu 8 ký tự.' })
    if (newPw !== confirmPw) return setPwMsg({ type: 'err', text: 'Xác nhận mật khẩu mới không khớp.' })
    setPwBusy(true)
    try {
      await authService.changePassword({ currentPassword: currentPw, newPassword: newPw })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwMsg({ type: 'ok', text: 'Đã đổi mật khẩu.' })
    } catch (err) {
      setPwMsg({ type: 'err', text: err.message || 'Không đổi được mật khẩu.' })
    } finally { setPwBusy(false) }
  }

  const rows = [
    ['Họ và tên', data.fullName],
    ['Giới tính', data.gender],
    ['Tỉnh', data.province],
    ['Trường', data.school],
    ['Số điện thoại phụ huynh', data.parentPhone],
  ]

  return (
    <div className="acc-page">
      <h2 className="acc-title">Thông tin cá nhân</h2>
      <p className="acc-sub">Quản lý thông tin tài khoản và bảo mật của bạn.</p>

      <section className="acc-card">
        <span className="acc-avatar" aria-hidden="true">{displayName.trim().charAt(0).toUpperCase()}</span>
        <div className="acc-namerow">
          <h3>{displayName}</h3>
          <span className="acc-role"><Icon><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></Icon>{roleText}</span>
        </div>
        <p className="acc-email"><Icon><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></Icon>{profile?.email || '-'}</p>
      </section>

      <section className="acc-card">
        <h3 className="acc-card-title">Thông tin chi tiết</h3>
        <p className="acc-card-sub">Thông tin liên hệ và hồ sơ học sinh.</p>

        {loading ? <p className="acc-muted">Đang tải...</p> : loadError ? <p className="acc-error">{loadError}</p> : editing ? (
          <div className="acc-form">
            <label className="acc-field"><span className="acc-label">Họ và tên</span>
              <input type="text" maxLength={80} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label className="acc-field"><span className="acc-label">Giới tính</span>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">-</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option>
              </select></label>
            <label className="acc-field"><span className="acc-label">Tỉnh</span>
              <input type="text" maxLength={80} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></label>
            <label className="acc-field"><span className="acc-label">Trường</span>
              <input type="text" maxLength={120} value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} /></label>
            <label className="acc-field"><span className="acc-label">Số điện thoại phụ huynh</span>
              <input type="tel" inputMode="tel" maxLength={20} value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} /></label>
            <label className="acc-field"><span className="acc-label">Link Facebook</span>
              <input type="url" inputMode="url" maxLength={300} placeholder="https://www.facebook.com/..." value={form.facebookUrl} onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })} /></label>
            {saveError ? <p className="acc-error">{saveError}</p> : null}
            <div className="acc-actions">
              <button type="button" className="acc-btn" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
              <button type="button" className="acc-btn acc-btn--ghost" onClick={() => navigate(classTabPath('account'))} disabled={saving}>Hủy</button>
            </div>
          </div>
        ) : (
          <>
            <dl className="acc-list">
              {rows.map(([label, value]) => (
                <div key={label} className="acc-item"><dt>{label}</dt><dd>{show(value)}</dd></div>
              ))}
              <div className="acc-item"><dt>Link Facebook</dt>
                <dd>{data.facebookUrl ? <a href={data.facebookUrl} target="_blank" rel="noopener noreferrer">{data.facebookUrl}</a> : '-'}</dd></div>
              <div className="acc-item"><dt>Vai trò</dt><dd>{roleText}</dd></div>
            </dl>
            {notice ? <p className="acc-ok">{notice}</p> : null}
            <button type="button" className="acc-btn" onClick={() => navigate(accountEditPath())}>
              <Icon><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z" /></Icon>Chỉnh sửa
            </button>
          </>
        )}
      </section>

      <section className="acc-card">
        <h3 className="acc-card-title">Đổi mật khẩu</h3>
        <p className="acc-card-sub">Mật khẩu cần có ít nhất 1 chữ hoa, 1 số, độ dài tối thiểu 8 ký tự.</p>
        <div className="acc-form">
          <PasswordField label="Mật khẩu hiện tại" value={currentPw} onChange={setCurrentPw} autoComplete="current-password" />
          <PasswordField label="Mật khẩu" value={newPw} onChange={setNewPw} autoComplete="new-password" />
          <PasswordField label="Xác nhận mật khẩu mới" value={confirmPw} onChange={setConfirmPw} autoComplete="new-password" />
          {pwMsg.text ? <p className={pwMsg.type === 'ok' ? 'acc-ok' : 'acc-error'}>{pwMsg.text}</p> : null}
          <div className="acc-actions">
            <button type="button" className="acc-btn" onClick={changePassword} disabled={pwBusy}>
              <Icon><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M16 7l3 3" /></Icon>{pwBusy ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
