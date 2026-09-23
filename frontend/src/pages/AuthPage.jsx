import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import * as authService from '../services/authService.js'
import { supabase } from '../lib/supabaseClient.js'

function GhostIcon({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2.6c-4.5 0-8.1 3.5-8.1 8.5V20.2c0 .7.8 1 1.3.5l1.7-1.6 1.6 1.7c.4.4 1.1.4 1.5 0l1.9-2 2 2c.4.4 1.1.4 1.5 0l1.6-1.7 1.7 1.6c.5.5 1.3.2 1.3-.5v-9.1c0-5-3.6-8.5-8.1-8.5z"
      />
      <ellipse cx="9.1" cy="11.1" rx="1.55" ry="1.85" fill="#fff" />
      <ellipse cx="14.9" cy="11.1" rx="1.55" ry="1.85" fill="#fff" />
      <circle cx="9.45" cy="11.4" r="0.72" fill="#2a1848" />
      <circle cx="15.25" cy="11.4" r="0.72" fill="#2a1848" />
    </svg>
  )
}

/**
 * Toàn bộ luồng Auth (login/register/forgot/reset) được chuyển
 * từ App.jsx gốc vào đây. Khác biệt quan trọng so với bản gốc:
 *  - KHÔNG còn hằng số SECRET_CODE ở frontend.
 *  - KHÔNG gọi supabase.auth.signUp / signInWithPassword
 *    trực tiếp -> tất cả đi qua authService (gọi backend).
 *  - Xác thực email = link trong email (đăng ký: Confirm signup,
 *    quên mật khẩu: PASSWORD_RECOVERY -> form "Đặt mật khẩu mới").
 *  - Đăng nhập Google vẫn dùng supabase trực tiếp vì OAuth không
 *    chứa thông tin nhạy cảm cần giấu.
 */
export default function AuthPage({ onClose, initialStep = 'login', deferCloseOnSuccess = false }) {
  const { setSession, reloadProfile, logout, setProfile, profile, clearPasswordRecovery } = useAuth()

  const [authStep, setAuthStep] = useState(
    initialStep === 'display-name'
      ? 'display-name'
      : initialStep === 'reset-password'
        ? 'reset-password'
        : initialStep === 'register'
          ? 'register'
          : 'login'
  )
  const [authLoading, setAuthLoading] = useState(false)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [secretCode, setSecretCode] = useState('')
  const [isMember, setIsMember] = useState(null)
  const [ghostMode, setGhostMode] = useState(false)

  // Email (đăng ký) hoặc email đã che (quên mật khẩu) để hiển thị ở màn "Kiểm tra email"
  const [sentEmail, setSentEmail] = useState('')

  const resetAuthForm = () => {
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSecretCode('')
    setIsMember(null)
    setGhostMode(false)
    setSentEmail('')
  }

  const getAuthTitle = () => {
    switch (authStep) {
      case 'login': return 'Đăng nhập'
      case 'register': return 'Đăng ký'
      case 'register-sent': return 'Kiểm tra email'
      case 'forgot-password': return 'Quên mật khẩu'
      case 'forgot-sent': return 'Kiểm tra email'
      case 'reset-password': return 'Đặt mật khẩu mới'
      case 'display-name': return 'Tên hiển thị'
      default: return 'Tài khoản'
    }
  }

  const handleAuthBack = () => {
    if (authLoading) return

    if (authStep === 'display-name') {
      setAuthLoading(true)
      logout()
        .catch(() => {})
        .finally(() => {
          setAuthLoading(false)
          onClose?.()
        })
      return
    }
    if (authStep === 'register-sent') {
      setAuthStep('register')
      return
    }
    if (authStep === 'forgot-sent') {
      setAuthStep('forgot-password')
      return
    }
    if (authStep === 'reset-password') {
      // Đang giữ session khôi phục từ link email -> hủy thì đăng xuất luôn.
      setAuthLoading(true)
      clearPasswordRecovery()
      logout()
        .catch(() => {})
        .finally(() => {
          setPassword('')
          setConfirmPassword('')
          setAuthLoading(false)
          onClose?.()
        })
      return
    }
    if (authStep === 'forgot-password') {
      setUsername('')
      setAuthStep('login')
      return
    }
    onClose?.()
  }

  const closeFromOutside = () => {
    if (authLoading) return
    if (authStep === 'display-name' || authStep === 'reset-password') return
    onClose?.()
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) closeFromOutside()
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim()) return alert('Vui lòng nhập username!')
    if (!password) return alert('Vui lòng nhập mật khẩu!')

    setAuthLoading(true)
    try {
      const { session, profile: nextProfile } = await authService.login({ username, password })
      setSession(session)
      await reloadProfile()
      if (nextProfile?.needs_display_name) {
        setUsername('')
        setAuthStep('display-name')
        return
      }
      if (nextProfile && !deferCloseOnSuccess) onClose?.()
    } catch (err) {
      alert(err.message || 'Username hoặc mật khẩu không chính xác!')
    } finally {
      setAuthLoading(false)
    }
  }

  const clearGhostMode = () => {
    setGhostMode(false)
    setEmail('')
  }

  const handleGhostClick = async () => {
    if (authLoading) return
    if (ghostMode) {
      clearGhostMode()
      return
    }

    setAuthLoading(true)
    try {
      const data = await authService.previewGhostAccount()
      if (!data?.remainingToday) {
        alert('Hôm nay đã hết lượt tài khoản ma (tối đa 2 tài khoản/ngày).')
        return
      }
      setGhostMode(true)
      setEmail(data.email)
      setUsername('')
      setIsMember(true)
    } catch (err) {
      alert(err.message || 'Không lấy được tài khoản ma!')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()

    if (!ghostMode && !username.trim()) return alert('Vui lòng nhập username!')
    if (!email.trim()) return alert('Vui lòng nhập email!')
    if (password.length < 8) return alert('Mật khẩu phải có ít nhất 8 ký tự!')
    if (password !== confirmPassword) return alert('Mật khẩu xác nhận không khớp!')
    if (isMember === null) return alert('Vui lòng chọn bạn có phải thành viên 10A4 hay không!')
    if (ghostMode && (isMember !== true || !secretCode.trim())) {
      return alert('Tài khoản ma chỉ đăng ký được với mã thành viên 10A4!')
    }

    setAuthLoading(true)
    try {
      const result = await authService.register({
        username: ghostMode ? '' : username,
        email,
        password,
        isMember,
        secretCode,
      })

      if (result.ghost && result.session) {
        setSession(result.session)
        if (result.profile) setProfile(result.profile)
        else await reloadProfile()
        setUsername('')
        setAuthStep('display-name')
        return
      }

      setSentEmail(result.email)
      setAuthStep('register-sent')
    } catch (err) {
      alert(err.message || 'Không thể tạo tài khoản!')
    } finally {
      setAuthLoading(false)
    }
  }

  const resendRegisterConfirmation = async () => {
    if (!sentEmail || authLoading) return
    setAuthLoading(true)
    try {
      await authService.resendConfirmation({ email: sentEmail })
      alert('Email xác nhận đã được gửi lại!')
    } catch (err) {
      alert(err.message || 'Không thể gửi lại email xác nhận!')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!username.trim()) return alert('Vui lòng nhập username hoặc email!')

    setAuthLoading(true)
    try {
      const { email: maskedEmail } = await authService.forgotPassword({ username })
      setSentEmail(maskedEmail)
      setAuthStep('forgot-sent')
    } catch (err) {
      alert(err.message || 'Không tìm thấy tài khoản!')
    } finally {
      setAuthLoading(false)
    }
  }

  const resendResetEmail = async () => {
    if (!username.trim() || authLoading) return
    setAuthLoading(true)
    try {
      await authService.forgotPassword({ username })
      alert('Email đặt lại mật khẩu đã được gửi lại!')
    } catch (err) {
      alert(err.message || 'Không thể gửi lại email đặt lại mật khẩu!')
    } finally {
      setAuthLoading(false)
    }
  }

  // Bước cuối của luồng quên mật khẩu: user đã bấm link trong email và
  // Supabase đã phát PASSWORD_RECOVERY -> đổi mật khẩu bằng supabase.auth.updateUser.
  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (password.length < 8) return alert('Mật khẩu mới phải có ít nhất 8 ký tự!')
    if (password !== confirmPassword) return alert('Mật khẩu xác nhận không khớp!')

    setAuthLoading(true)
    try {
      await authService.updatePassword({ newPassword: password })
      clearPasswordRecovery()
      await logout()
      alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.')
      setPassword('')
      setConfirmPassword('')
      setUsername('')
      setAuthStep('login')
    } catch (err) {
      const msg = String(err?.message || '')
      if (/different from the old password/i.test(msg)) {
        alert('Mật khẩu mới phải khác mật khẩu cũ!')
      } else if (/session missing|expired|invalid/i.test(msg)) {
        alert('Liên kết đã hết hạn. Hãy bấm Hủy rồi yêu cầu gửi lại email đặt lại mật khẩu.')
      } else {
        alert(msg || 'Không thể đổi mật khẩu!')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (authLoading) return
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) {
        alert('Không thể đăng nhập Google: ' + error.message)
        setAuthLoading(false)
      }
    } catch (error) {
      console.error(error)
      alert('Có lỗi xảy ra khi đăng nhập Google!')
      setAuthLoading(false)
    }
  }

  const handleDisplayNameSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim()) return alert('Vui lòng nhập tên hiển thị!')

    setAuthLoading(true)
    try {
      const { profile: nextProfile } = await authService.setDisplayName({ username })
      if (nextProfile) setProfile(nextProfile)
      else await reloadProfile()
      onClose?.()
    } catch (err) {
      alert(err.message || 'Không thể lưu tên hiển thị!')
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeFromOutside()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [authLoading, authStep])

  return (
        <div
          className="auth-overlay fade-in"
          onClick={handleOverlayClick}
          role="presentation"
        >

          <button
            className="btn-back"
            onClick={handleAuthBack}
            disabled={authLoading}
          >
            <span>{'<'}</span>
            {authStep === 'display-name'
              ? 'Đăng xuất'
              : authStep === 'reset-password'
                ? 'Hủy'
                : 'Quay lại'}
          </button>

          <div
            className="auth-card slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >

            <h2 id="auth-title">
              {getAuthTitle()}
            </h2>

            {authStep === 'login' && (
              <>
                <form
                  onSubmit={handleLoginSubmit}
                  className="auth-form"
                >

                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                      )
                    }
                    autoComplete="username"
                    required
                  />

                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={authLoading}
                  >
                    {authLoading
                      ? 'Đang đăng nhập...'
                      : 'Đăng nhập'}
                  </button>

                </form>

                <div className="auth-links">
                  <button
                    type="button"
                    className="btn-toggle-mode"
                    onClick={() => {
                      if (authLoading) return
                      resetAuthForm()
                      setAuthStep('forgot-password')
                    }}
                  >
                    Quên mật khẩu?
                  </button>

                  <div className="divider">
                    hoặc
                  </div>

                  <div className="btn-google-frame">
                    <button
                      type="button"
                      className="btn-google"
                      onClick={handleGoogleLogin}
                      disabled={authLoading}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        xmlns="http://www.w3.org/2000/svg"
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
                      Đăng nhập với Google
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn-toggle-mode"
                    onClick={() => {
                      if (authLoading) return
                      resetAuthForm()
                      setAuthStep('register')
                    }}
                  >
                    Chưa có tài khoản? Đăng ký ngay
                  </button>
                </div>
              </>
            )}

            {authStep === 'register' && (
              <>
                <form
                  onSubmit={handleRegisterSubmit}
                  className="auth-form"
                >

                  {!ghostMode && (
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) =>
                        setUsername(
                          e.target.value
                        )
                      }
                      autoComplete="username"
                      required
                    />
                  )}

                  <div className="email-with-ghost">
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => {
                        const next = e.target.value
                        setEmail(next)
                        if (ghostMode && !next.toLowerCase().endsWith('@ghost.com')) {
                          setGhostMode(false)
                        }
                      }}
                      autoComplete="email"
                      required
                      readOnly={ghostMode}
                    />
                    <button
                      type="button"
                      className={`btn-ghost${ghostMode ? ' active' : ''}`}
                      onClick={handleGhostClick}
                      disabled={authLoading}
                      title={ghostMode ? 'Bỏ tài khoản ma' : 'Dùng tài khoản ma'}
                      aria-label={ghostMode ? 'Bỏ tài khoản ma' : 'Dùng tài khoản ma'}
                    >
                      <GhostIcon />
                    </button>
                  </div>

                  {ghostMode && (
                    <p className="ghost-hint">
                      Tài khoản ma không cần xác nhận email. Chỉ đăng ký được
                      với mã thành viên 10A4, sau đó sẽ đặt tên hiển thị ngay.
                    </p>
                  )}

                  <input
                    type="password"
                    placeholder="Mật khẩu (ít nhất 8 ký tự)"
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />

                  <input
                    type="password"
                    placeholder="Xác nhận mật khẩu"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    autoComplete="new-password"
                    required
                  />

                  <div className="member-question">

                    <p>
                      Bạn có phải là thành viên
                      của 10A4 không?
                    </p>

                    <div className="radio-group">

                      <label
                        className={
                          isMember === true
                            ? 'active'
                            : ''
                        }
                      >
                        <input
                          type="radio"
                          name="isMember"
                          checked={
                            isMember === true
                          }
                          onChange={() =>
                            setIsMember(true)
                          }
                        />
                        Có
                      </label>

                      <label
                        className={
                          isMember === false
                            ? 'active'
                            : ''
                        }
                      >
                        <input
                          type="radio"
                          name="isMember"
                          checked={
                            isMember === false
                          }
                          onChange={() => {
                            if (ghostMode) {
                              alert('Tài khoản ma bắt buộc là thành viên 10A4.')
                              return
                            }
                            setIsMember(false)
                          }}
                        />
                        Không
                      </label>

                    </div>

                  </div>

                  {isMember === true && (
                    <input
                      type="text"
                      placeholder="Mã thành viên 10A4"
                      value={secretCode}
                      onChange={(e) =>
                        setSecretCode(
                          e.target.value
                        )
                      }
                      required
                    />
                  )}

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={authLoading}
                  >
                    {authLoading
                      ? 'Đang tạo tài khoản...'
                      : 'Đăng ký'}
                  </button>

                </form>

                <button
                  type="button"
                  className="btn-toggle-mode"
                  onClick={() => {
                    if (authLoading) return

                    resetAuthForm()
                    setAuthStep('login')
                  }}
                >
                  Đã có tài khoản?
                  <br />
                  Đăng nhập ngay
                </button>
              </>
            )}

            {authStep === 'register-sent' && (
              <>

                <p className="setup-hint">
                  Kiểm tra email để xác nhận tài khoản.
                  Chúng tôi đã gửi email xác nhận tới:
                </p>

                <p
                  style={{
                    fontWeight: '700',
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}
                >
                  {sentEmail}
                </p>

                <p className="setup-hint">
                  Hãy mở hộp thư (kiểm tra cả mục Spam), bấm vào liên kết
                  xác nhận trong email, rồi quay lại đây để đăng nhập.
                </p>

                <button
                  type="button"
                  className="btn-submit"
                  onClick={() => {
                    resetAuthForm()
                    setAuthStep('login')
                  }}
                >
                  Đã xác nhận, đăng nhập
                </button>

                <button
                  type="button"
                  className="btn-toggle-mode"
                  onClick={resendRegisterConfirmation}
                  disabled={authLoading}
                >
                  Gửi lại email xác nhận
                </button>

              </>
            )}

            {authStep === 'forgot-password' && (
              <>

                <p className="setup-hint">
                  Nhập username hoặc email của bạn.
                  Chúng tôi sẽ gửi liên kết đặt lại mật khẩu
                  tới email đã đăng ký.
                </p>

                <form
                  onSubmit={
                    handleForgotPassword
                  }
                  className="auth-form"
                >

                  <input
                    type="text"
                    placeholder="Username hoặc email"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                      )
                    }
                    autoComplete="username"
                    required
                  />

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={authLoading}
                  >
                    {authLoading
                      ? 'Đang gửi email...'
                      : 'Gửi email đặt lại mật khẩu'}
                  </button>

                </form>

              </>
            )}

            {authStep === 'forgot-sent' && (
              <>

                <p className="setup-hint">
                  Kiểm tra email và bấm vào liên kết
                  đặt lại mật khẩu. Email đã được gửi tới:
                </p>

                <p
                  style={{
                    fontWeight: '700',
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}
                >
                  {sentEmail}
                </p>

                <p className="setup-hint">
                  Không thấy email? Hãy kiểm tra cả mục Spam.
                </p>

                <button
                  type="button"
                  className="btn-toggle-mode"
                  onClick={resendResetEmail}
                  disabled={authLoading}
                >
                  Gửi lại email đặt lại mật khẩu
                </button>

              </>
            )}

            {authStep === 'reset-password' && (
              <>

                <p className="setup-hint">
                  Liên kết hợp lệ.
                  Hãy đặt mật khẩu mới cho
                  tài khoản của bạn.
                </p>

                <form
                  onSubmit={handleResetPassword}
                  className="auth-form"
                >

                  <input
                    type="password"
                    placeholder="Mật khẩu mới"
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />

                  <input
                    type="password"
                    placeholder="Xác nhận mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={authLoading}
                  >
                    {authLoading
                      ? 'Đang đổi mật khẩu...'
                      : 'Đổi mật khẩu'}
                  </button>

                </form>

              </>
            )}

            {authStep === 'display-name' && (
              <>
                <p className="setup-hint">
                  {ghostMode || profile?.is_ghost
                    ? 'Tài khoản ma đã sẵn sàng. Hãy đặt tên hiển thị — tên này sẽ hiện trong Quản lý Admin.'
                    : 'Tài khoản của bạn đã được tạo. Hãy đặt tên hiển thị — tên này sẽ hiện trong Quản lý Admin.'}
                </p>

                <form
                  onSubmit={handleDisplayNameSubmit}
                  className="auth-form"
                >
                  <input
                    type="text"
                    placeholder="Tên hiển thị"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="nickname"
                    minLength={2}
                    maxLength={40}
                    required
                    autoFocus
                  />

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={authLoading}
                  >
                    {authLoading ? 'Đang lưu...' : 'Lưu tên hiển thị'}
                  </button>
                </form>

                <p className="setup-hint">
                  Bấm Đăng xuất nếu muốn đặt tên sau.
                </p>
              </>
            )}

          </div>
        </div>
  )
}
