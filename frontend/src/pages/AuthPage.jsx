import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import * as authService from '../services/authService.js'
import PasswordField from '../components/PasswordField.jsx'
import { Brand } from '../components/SiteHeader.jsx'
import { ROUTES } from '../lib/routes.js'
import { validateEmail, validateNewPassword } from '../lib/validation.js'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const toast = useToast()
  const { reloadProfile } = useAuth()
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  // Quay lại bằng nút Back từ trang Google: bỏ trạng thái loading bị kẹt
  useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) setBusy('')
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const setField = (key) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => (current[key] ? { ...current, [key]: '' } : current))
  }

  const validate = () => {
    const next = { email: validateEmail(form.email) }
    if (isRegister) {
      if (form.displayName.trim().length < 2) next.displayName = 'Tên hiển thị cần có ít nhất 2 ký tự.'
      next.password = validateNewPassword(form.password)
      if (!form.confirmPassword) next.confirmPassword = 'Vui lòng nhập lại mật khẩu.'
      else if (form.password !== form.confirmPassword) next.confirmPassword = 'Mật khẩu xác nhận chưa khớp.'
    } else if (!form.password) {
      next.password = 'Vui lòng nhập mật khẩu.'
    }
    return Object.fromEntries(Object.entries(next).filter(([, message]) => message))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy('email')
    setNotice('')
    try {
      if (isRegister) {
        const result = await authService.register({
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          password: form.password,
        })
        setNotice(`Liên kết xác nhận đã được gửi đến ${result.email || form.email.trim()}. Hãy mở email để hoàn tất đăng ký.`)
        setForm((current) => ({ ...current, password: '', confirmPassword: '' }))
        toast.success('Đăng ký thành công')
      } else {
        await authService.login({ email: form.email.trim(), password: form.password })
        await reloadProfile()
        toast.success('Đăng nhập thành công')
        navigate(ROUTES.home, { replace: true })
      }
    } catch (cause) {
      toast.error(cause?.message || (isRegister ? 'Đăng ký không thành công.' : 'Email hoặc mật khẩu chưa chính xác.'))
    } finally {
      setBusy('')
    }
  }

  const handleGoogle = async () => {
    if (busy) return
    setBusy('google')
    try {
      await authService.signInWithGoogle() // trình duyệt chuyển sang Google
    } catch {
      toast.error('Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.')
      setBusy('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-visual" aria-hidden="true">
        <div className="login-plus-grid" />
        {/* PLACEHOLDER ẢNH: thêm ảnh bằng <img> hoặc background-image cho .login-photo-slot */}
        <div className="login-photo-slot" />
        <div className="login-visual-copy">
          <p className="login-visual-title">Học nhanh hơn.<br /><span>Chơi vui hơn.</span></p>
          <p>Tạo, chơi và thử thách cùng bạn bè trên một nền tảng quiz gọn nhẹ.</p>
        </div>
      </div>

      <main className="login-panel">
        <div className="login-brand"><Brand /></div>
        <section className="login-card" aria-labelledby="auth-title">
          <nav className="login-tabs" aria-label="Chọn đăng nhập hoặc đăng ký">
            <Link to={ROUTES.login} className={isRegister ? '' : 'is-active'} aria-current={isRegister ? undefined : 'page'}>Đăng nhập</Link>
            <Link to={ROUTES.register} className={isRegister ? 'is-active' : ''} aria-current={isRegister ? 'page' : undefined}>Đăng ký</Link>
          </nav>
          <h1 id="auth-title">{isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
          <p className="login-sub">{isRegister ? 'Điền thông tin bên dưới để bắt đầu.' : 'Vui lòng nhập email và mật khẩu để đăng nhập.'}</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <div className="form-field">
                <label htmlFor="displayName">Tên hiển thị</label>
                <input id="displayName" value={form.displayName} onChange={setField('displayName')} autoComplete="nickname" maxLength={40} disabled={Boolean(busy)} aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? 'displayName-error' : undefined} />
                {errors.displayName && <p className="field-error" id="displayName-error">{errors.displayName}</p>}
              </div>
            )}
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={form.email} onChange={setField('email')} autoComplete="email" disabled={Boolean(busy)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />
              {errors.email && <p className="field-error" id="email-error">{errors.email}</p>}
            </div>
            <PasswordField label="Mật khẩu" value={form.password} onChange={setField('password')} error={errors.password} autoComplete={isRegister ? 'new-password' : 'current-password'} disabled={Boolean(busy)} />
            {isRegister && (
              <PasswordField label="Xác nhận mật khẩu" value={form.confirmPassword} onChange={setField('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" disabled={Boolean(busy)} />
            )}
            {isRegister && <p className="login-hint">Ít nhất 8 ký tự, gồm 1 chữ hoa và 1 chữ số.</p>}

            {notice && <p className="login-notice" role="status">{notice}</p>}

            <button className="button button-primary login-submit" type="submit" disabled={Boolean(busy)}>
              {busy === 'email' ? 'Đang xử lý…' : isRegister ? 'Đăng ký' : 'Đăng nhập'}
            </button>
          </form>

          <div className="login-divider"><span>hoặc</span></div>
          <button className="button button-quiet login-google" type="button" onClick={() => void handleGoogle()} disabled={Boolean(busy)}>
            <GoogleIcon />
            {busy === 'google' ? 'Đang chuyển đến Google…' : 'Tiếp tục với Google'}
          </button>
        </section>
      </main>
    </div>
  )
}
