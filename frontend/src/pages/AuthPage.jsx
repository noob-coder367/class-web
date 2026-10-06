import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import * as authService from '../services/authService.js'

function Brand() {
  return <Link className="brand" to="/" aria-label="Quizly, về trang chủ"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 4.5h10A2.5 2.5 0 0 1 19.5 7v10a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.8"/><path d="m8 12 2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span><span>quizly</span></Link>
}

export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const { reloadProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 8) {
      setError('Mật khẩu cần có ít nhất 8 ký tự.')
      return
    }
    if (isRegister && password !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }
    if (isRegister && displayName.trim().length < 2) {
      setError('Tên hiển thị cần có ít nhất 2 ký tự.')
      return
    }

    setLoading(true)
    try {
      if (isRegister) {
        const result = await authService.register({ displayName: displayName.trim(), email: email.trim(), password })
        setSuccess(result.message || `Liên kết xác nhận đã được gửi đến ${result.email || email}. Hãy mở email để hoàn tất đăng ký.`)
      } else {
        await authService.login({ email: email.trim(), password })
        await reloadProfile()
        navigate('/', { replace: true })
      }
    } catch (cause) {
      setError(cause?.message || (isRegister ? 'Không thể tạo tài khoản lúc này.' : 'Email hoặc mật khẩu chưa chính xác.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <main className="auth-main">
        <div>
          <Link className="auth-back" to="/">← Quay về trang chủ</Link>
          <section className="auth-card" aria-labelledby="auth-title">
            <div className="auth-brand"><Brand /></div>
            <h1 className="auth-heading" id="auth-title">{isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
            <p className="auth-subheading">{isRegister ? 'Đăng ký để sẵn sàng cho những trải nghiệm học tập mới.' : 'Đăng nhập để tiếp tục hành trình của bạn.'}</p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {isRegister && (
                <div className="form-field">
                  <label htmlFor="display-name">Tên hiển thị</label>
                  <input id="display-name" name="name" type="text" autoComplete="name" placeholder="Tên bạn muốn mọi người thấy" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required />
                </div>
              )}
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="ban@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="form-field">
                <label htmlFor="password">Mật khẩu</label>
                <input id="password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="Ít nhất 8 ký tự" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
              </div>
              {isRegister && (
                <div className="form-field">
                  <label htmlFor="confirm-password">Xác nhận mật khẩu</label>
                  <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
                </div>
              )}
              <button className="button button-primary auth-submit" type="submit" disabled={loading}>
                {loading ? (isRegister ? 'Đang tạo tài khoản…' : 'Đang đăng nhập…') : (isRegister ? 'Đăng ký' : 'Đăng nhập')}
              </button>
            </form>

            {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
            {success && <p className="auth-message auth-message-success" role="status">{success}</p>}
            <p className="auth-switch">
              {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
              <Link to={isRegister ? '/dang-nhap' : '/dang-ky'}>{isRegister ? 'Đăng nhập' : 'Đăng ký'}</Link>
            </p>
          </section>
        </div>
      </main>
      <footer className="auth-footer">Quizly · Nền tảng đang trong giai đoạn xây dựng.</footer>
    </div>
  )
}
