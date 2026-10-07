import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import PasswordField from '../components/PasswordField.jsx'
import SiteHeader, { getRoleLabel } from '../components/SiteHeader.jsx'
import { GENDER_OPTIONS, validateNewPassword, validateProfile } from '../lib/validation.js'
import { changePassword, fetchAuthIdentity, fetchOwnProfile, updateOwnProfile } from '../services/profileService.js'

const FIELDS = [
  { key: 'full_name', label: 'Họ và tên', autoComplete: 'name', maxLength: 60 },
  { key: 'gender', label: 'Giới tính', type: 'select' },
  { key: 'province', label: 'Tỉnh / Thành phố', maxLength: 80 },
  { key: 'school', label: 'Trường', maxLength: 120 },
  { key: 'phone', label: 'Số điện thoại', type: 'tel', autoComplete: 'tel', maxLength: 15, placeholder: '0912345678' },
  { key: 'facebook_url', label: 'Link Facebook', type: 'url', maxLength: 300, placeholder: 'https://facebook.com/...' },
]

const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' }
const PROVIDER_LABELS = { google: 'Google', email: 'Email và mật khẩu' }

function toForm(profile) {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, profile?.[key] || '']))
}

function displayValue(profile, key) {
  const value = profile?.[key]
  if (!value) return <span className="profile-empty">Chưa cập nhật</span>
  if (key === 'gender') return GENDER_OPTIONS.find((option) => option.value === value)?.label || value
  if (key === 'facebook_url') return <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
  return value
}

export default function ProfilePage() {
  const { session, profile: authProfile, reloadProfile } = useAuth()
  const toast = useToast()
  const user = session?.user
  const [state, setState] = useState({ status: 'loading', profile: null, identity: null })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(toForm(null))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS)
  const [passwordErrors, setPasswordErrors] = useState({})
  const [changing, setChanging] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (authProfile?.needs_display_name && state.status === 'ready') {
      setEditing(true)
    }
  }, [authProfile?.needs_display_name, state.status])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    Promise.all([fetchOwnProfile(user.id), fetchAuthIdentity()])
      .then(([profile, identity]) => active && setState({ status: 'ready', profile, identity }))
      .catch(() => active && setState({ status: 'error', profile: null, identity: null }))
    return () => { active = false }
  }, [user?.id, reloadKey])

  const retry = () => {
    setState({ status: 'loading', profile: null, identity: null })
    setReloadKey((current) => current + 1)
  }

  if (state.status !== 'ready') {
    return (
      <div className="site-shell profile-shell">
        <SiteHeader />
        <main className="container profile-main">
          {state.status === 'loading'
            ? <div className="route-loading" aria-label="Đang tải hồ sơ"><span /></div>
            : (
              <div className="profile-card" role="alert">
                <p>Không thể tải hồ sơ. Vui lòng thử lại.</p>
                <button className="button button-primary" type="button" onClick={retry}>Thử lại</button>
              </div>
            )}
        </main>
      </div>
    )
  }

  const { profile, identity } = state
  const email = profile.email || user?.email || ''
  const shownName = profile.full_name || authProfile?.display_name || email.split('@')[0]
  const roleLabel = getRoleLabel(profile.role)
  const providerText = identity.providers.map((provider) => PROVIDER_LABELS[provider] || provider).join(', ') || 'Không xác định'

  const startEditing = () => {
    setForm(toForm(profile))
    setErrors({})
    setEditing(true)
  }

  const onField = (key) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => (current[key] ? { ...current, [key]: '' } : current))
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    if (saving) return
    const found = validateProfile(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      const updated = await updateOwnProfile(user.id, form)
      setState((current) => ({ ...current, profile: updated }))
      setEditing(false)
      toast.success('Cập nhật hồ sơ thành công')
      void reloadProfile()
    } catch (cause) {
      toast.error(cause?.message || 'Không thể lưu hồ sơ.')
    } finally {
      setSaving(false)
    }
  }

  const onPassword = (key) => (event) => {
    const { value } = event.target
    setPasswords((current) => ({ ...current, [key]: value }))
    setPasswordErrors((current) => (current[key] ? { ...current, [key]: '' } : current))
  }

  const submitPassword = async (event) => {
    event.preventDefault()
    if (changing) return
    const found = {}
    if (!passwords.current) found.current = 'Vui lòng nhập mật khẩu hiện tại.'
    found.next = validateNewPassword(passwords.next)
    if (!found.next && passwords.next === passwords.current) found.next = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
    if (!passwords.confirm) found.confirm = 'Vui lòng nhập lại mật khẩu mới.'
    else if (passwords.confirm !== passwords.next) found.confirm = 'Mật khẩu xác nhận chưa khớp.'
    const cleaned = Object.fromEntries(Object.entries(found).filter(([, message]) => message))
    setPasswordErrors(cleaned)
    if (Object.keys(cleaned).length) return

    setChanging(true)
    try {
      await changePassword({ email, currentPassword: passwords.current, newPassword: passwords.next })
      setPasswords(EMPTY_PASSWORDS)
      toast.success('Đổi mật khẩu thành công')
    } catch (cause) {
      toast.error(cause?.message || 'Không thể đổi mật khẩu.')
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="site-shell profile-shell">
      <SiteHeader />
      <main className="container profile-main">
        <header className="profile-heading">
          <h1>{authProfile?.needs_display_name ? 'Hoàn tất tài khoản' : 'Thông tin cá nhân'}</h1>
          <p>{authProfile?.needs_display_name ? 'Vui lòng nhập tên hiển thị trước khi tiếp tục sử dụng 10A4-Quizz.' : 'Quản lý thông tin tài khoản và bảo mật của bạn.'}</p>
        </header>

        <section className="profile-card profile-summary" aria-label="Tài khoản">
          <span className="avatar avatar-lg" aria-hidden="true">{(shownName.charAt(0) || '?').toUpperCase()}</span>
          <div>
            <p className="profile-name">{shownName} <span className="role-pill">{roleLabel}</span></p>
            <p className="profile-email">{email}</p>
          </div>
        </section>

        <section className="profile-card" aria-labelledby="profile-details-title">
          <h2 id="profile-details-title">Thông tin chi tiết</h2>
          <p className="profile-card-sub">Thông tin liên hệ và hồ sơ của bạn.</p>

          {editing ? (
            <form className="profile-form" onSubmit={saveProfile} noValidate>
              <div className="profile-grid">
                {FIELDS.map((field) => (
                  <div className="form-field" key={field.key}>
                    <label htmlFor={`pf-${field.key}`}>{field.label}</label>
                    {field.type === 'select' ? (
                      <select id={`pf-${field.key}`} value={form[field.key]} onChange={onField(field.key)} disabled={saving}>
                        <option value="">Chưa chọn</option>
                        {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <input id={`pf-${field.key}`} type={field.type || 'text'} value={form[field.key]} onChange={onField(field.key)} autoComplete={field.autoComplete} maxLength={field.maxLength} placeholder={field.placeholder} disabled={saving} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `pf-${field.key}-error` : undefined} />
                    )}
                    {errors[field.key] && <p className="field-error" id={`pf-${field.key}-error`}>{errors[field.key]}</p>}
                  </div>
                ))}
              </div>
              <div className="profile-actions">
                <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
                {!authProfile?.needs_display_name && <button className="button button-quiet" type="button" onClick={() => setEditing(false)} disabled={saving}>Hủy</button>}
              </div>
            </form>
          ) : (
            <>
              <dl className="profile-grid profile-dl">
                {FIELDS.map((field) => (
                  <div key={field.key}><dt>{field.label}</dt><dd>{displayValue(profile, field.key)}</dd></div>
                ))}
                <div><dt>Vai trò</dt><dd>{roleLabel}</dd></div>
                <div><dt>Đăng nhập bằng</dt><dd>{providerText}</dd></div>
              </dl>
              <div className="profile-actions">
                <button className="button button-primary" type="button" onClick={startEditing}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="m4 20 4-1L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                  Chỉnh sửa
                </button>
              </div>
            </>
          )}
        </section>

        {!authProfile?.needs_display_name && <section className="profile-card" aria-labelledby="profile-password-title">
          <h2 id="profile-password-title">Đổi mật khẩu</h2>
          {identity.hasPassword ? (
            <>
              <p className="profile-card-sub">Mật khẩu cần có ít nhất 1 chữ hoa, 1 số, độ dài tối thiểu 8 ký tự.</p>
              <form className="profile-form profile-password-form" onSubmit={submitPassword} noValidate>
                <PasswordField label="Mật khẩu hiện tại" value={passwords.current} onChange={onPassword('current')} error={passwordErrors.current} autoComplete="current-password" disabled={changing} />
                <PasswordField label="Mật khẩu mới" value={passwords.next} onChange={onPassword('next')} error={passwordErrors.next} autoComplete="new-password" disabled={changing} />
                <PasswordField label="Xác nhận mật khẩu mới" value={passwords.confirm} onChange={onPassword('confirm')} error={passwordErrors.confirm} autoComplete="new-password" disabled={changing} />
                <div className="profile-actions">
                  <button className="button button-primary" type="submit" disabled={changing}>{changing ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
                </div>
              </form>
            </>
          ) : (
            <p className="profile-note">Tài khoản này đăng nhập bằng Google nên mật khẩu do Google quản lý. Bạn không cần và không thể đổi mật khẩu tại đây.</p>
          )}
        </section>}
      </main>
    </div>
  )
}
