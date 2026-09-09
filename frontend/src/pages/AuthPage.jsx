import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import * as authService from '../services/authService.js'
import { supabase } from '../lib/supabaseClient.js'

/**
 * Toàn bộ luồng Auth (login/register/otp/forgot/reset) được chuyển
 * từ App.jsx gốc vào đây. Khác biệt quan trọng so với bản gốc:
 *  - KHÔNG còn hằng số SECRET_CODE ở frontend.
 *  - KHÔNG gọi supabase.auth.signUp / signInWithPassword / verifyOtp
 *    trực tiếp -> tất cả đi qua authService (gọi backend).
 *  - Đăng nhập Google vẫn dùng supabase trực tiếp vì OAuth không
 *    chứa thông tin nhạy cảm cần giấu.
 */
export default function AuthPage({ onClose, initialStep = 'login' }) {
  const { setSession, reloadProfile } = useAuth()

  const [authStep, setAuthStep] = useState(
    initialStep === 'register' ? 'register' : 'login'
  )
  const [authLoading, setAuthLoading] = useState(false)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [secretCode, setSecretCode] = useState('')
  const [isMember, setIsMember] = useState(null)

  const [otp, setOtp] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpCooldown, setOtpCooldown] = useState(0)

  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [otpCooldown])

  const resetAuthForm = () => {
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSecretCode('')
    setIsMember(null)
    setOtp('')
    setOtpEmail('')
    setOtpCooldown(0)
  }

  const getAuthTitle = () => {
    switch (authStep) {
      case 'login': return 'Đăng nhập'
      case 'register': return 'Đăng ký'
      case 'verify-register': return 'Xác nhận email'
      case 'forgot-password': return 'Quên mật khẩu'
      case 'verify-reset': return 'Xác nhận mã'
      case 'reset-password': return 'Đặt mật khẩu mới'
      default: return 'Tài khoản'
    }
  }

  const handleAuthBack = () => {
    if (authLoading) return

    if (authStep === 'verify-register') {
      setOtp('')
      setAuthStep('register')
      return
    }
    if (authStep === 'verify-reset') {
      setOtp('')
      setAuthStep('forgot-password')
      return
    }
    if (authStep === 'reset-password') {
      setOtp('')
      setPassword('')
      setConfirmPassword('')
      setAuthStep('forgot-password')
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
      const { session, profile } = await authService.login({ username, password })
      setSession(session)
      await reloadProfile()
      if (profile) onClose?.()
    } catch (err) {
      alert(err.message || 'Username hoặc mật khẩu không chính xác!')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()

    if (!username.trim()) return alert('Vui lòng nhập username!')
    if (!email.trim()) return alert('Vui lòng nhập email!')
    if (password.length < 8) return alert('Mật khẩu phải có ít nhất 8 ký tự!')
    if (password !== confirmPassword) return alert('Mật khẩu xác nhận không khớp!')
    if (isMember === null) return alert('Vui lòng chọn bạn có phải thành viên 10A4 hay không!')

    setAuthLoading(true)
    try {
      const { email: sentEmail } = await authService.register({
        username,
        email,
        password,
        isMember,
        secretCode,
      })
      setOtpEmail(sentEmail)
      setOtp('')
      setOtpCooldown(60)
      setAuthStep('verify-register')
    } catch (err) {
      alert(err.message || 'Không thể tạo tài khoản!')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyRegister = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) return alert('Vui lòng nhập đủ 6 số!')

    setAuthLoading(true)
    try {
      const { session, profile } = await authService.verifyOtp({
        email: otpEmail,
        otp,
        purpose: 'register',
      })
      setSession(session)
      await reloadProfile()
      if (profile) {
        alert('Đăng ký thành công!')
        onClose?.()
      } else {
        alert('Email đã xác nhận nhưng profile chưa hoàn tất.')
      }
    } catch (err) {
      alert(err.message || 'Mã xác nhận không đúng hoặc đã hết hạn!')
    } finally {
      setAuthLoading(false)
    }
  }

  const resendRegisterOtp = async () => {
    if (otpCooldown > 0 || !otpEmail || authLoading) return
    setAuthLoading(true)
    try {
      await authService.resendOtp({ email: otpEmail })
      setOtpCooldown(60)
      alert('Mã mới đã được gửi tới email!')
    } catch (err) {
      alert(err.message || 'Không thể gửi lại mã!')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!username.trim()) return alert('Vui lòng nhập username!')

    setAuthLoading(true)
    try {
      const { email: sentEmail } = await authService.forgotPassword({ username })
      setOtpEmail(sentEmail)
      setOtp('')
      setOtpCooldown(60)
      setAuthStep('verify-reset')
    } catch (err) {
      alert(err.message || 'Không tìm thấy tài khoản!')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyReset = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) return alert('Vui lòng nhập đủ 6 số!')

    setAuthLoading(true)
    try {
      await authService.verifyOtp({ email: otpEmail, otp, purpose: 'reset' })
      setAuthStep('reset-password')
    } catch (err) {
      alert(err.message || 'Mã xác nhận không đúng hoặc đã hết hạn!')
    } finally {
      setAuthLoading(false)
    }
  }

  const resendResetOtp = async () => {
    if (otpCooldown > 0 || !otpEmail || authLoading) return
    setAuthLoading(true)
    try {
      await authService.resendOtp({ email: otpEmail })
      setOtpCooldown(60)
      alert('Mã mới đã được gửi!')
    } catch (err) {
      alert(err.message || 'Không thể gửi lại mã!')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (password.length < 8) return alert('Mật khẩu mới phải có ít nhất 8 ký tự!')
    if (password !== confirmPassword) return alert('Mật khẩu xác nhận không khớp!')

    setAuthLoading(true)
    try {
      await authService.resetPassword({ email: otpEmail, otp, newPassword: password })
      alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.')
      setPassword('')
      setConfirmPassword('')
      setOtp('')
      setAuthStep('login')
    } catch (err) {
      alert(err.message || 'Không thể đổi mật khẩu!')
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

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeFromOutside()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [authLoading])

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
            <span>&lt;</span>
            Quay lại
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

            {/* =========================================
                LOGIN
            ========================================= */}

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

            {/* =========================================
                REGISTER
            ========================================= */}

            {authStep === 'register' && (
              <>
                <form
                  onSubmit={handleRegisterSubmit}
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
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    autoComplete="email"
                    required
                  />

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
                          onChange={() =>
                            setIsMember(false)
                          }
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

            {/* =========================================
                REGISTER OTP
            ========================================= */}

            {authStep === 'verify-register' && (
              <>

                <p className="setup-hint">
                  Một mã xác nhận gồm 6 chữ số
                  đã được gửi tới:
                </p>

                <p
                  style={{
                    fontWeight: '700',
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}
                >
                  {otpEmail}
                </p>

                <form
                  onSubmit={handleVerifyRegister}
                  className="auth-form"
                >

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Nhập mã 6 số"
                    value={otp}
                    onChange={(e) =>
                      setOtp(
                        e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 6)
                      )
                    }
                    autoComplete="one-time-code"
                    className="otp-input"
                    required
                  />

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={
                      authLoading ||
                      otp.length !== 6
                    }
                  >
                    {authLoading
                      ? 'Đang xác nhận...'
                      : 'Xác nhận'}
                  </button>

                </form>

                <button
                  type="button"
                  className="btn-toggle-mode"
                  onClick={
                    resendRegisterOtp
                  }
                  disabled={
                    authLoading ||
                    otpCooldown > 0
                  }
                >
                  {otpCooldown > 0
                    ? `Gửi lại mã sau ${otpCooldown}s`
                    : 'Gửi lại mã'}
                </button>

                <p className="setup-hint">
                  Bạn có thể mở Gmail để xem
                  mã. Màn hình này sẽ không
                  tự chuyển về sảnh.
                </p>

              </>
            )}

            {/* =========================================
                FORGOT PASSWORD
            ========================================= */}

            {authStep === 'forgot-password' && (
              <>

                <p className="setup-hint">
                  Nhập username của bạn.
                  Chúng tôi sẽ gửi mã 6 số
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

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={authLoading}
                  >
                    {authLoading
                      ? 'Đang gửi mã...'
                      : 'Gửi mã xác nhận'}
                  </button>

                </form>

              </>
            )}

            {/* =========================================
                RESET OTP
            ========================================= */}

            {authStep === 'verify-reset' && (
              <>

                <p className="setup-hint">
                  Mã 6 số đã được gửi tới
                  email bảo mật của tài khoản.
                </p>

                <p
                  style={{
                    fontWeight: '700',
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}
                >
                  {otpEmail}
                </p>

                <form
                  onSubmit={handleVerifyReset}
                  className="auth-form"
                >

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Nhập mã 6 số"
                    value={otp}
                    onChange={(e) =>
                      setOtp(
                        e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 6)
                      )
                    }
                    autoComplete="one-time-code"
                    className="otp-input"
                    required
                  />

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={
                      authLoading ||
                      otp.length !== 6
                    }
                  >
                    {authLoading
                      ? 'Đang xác nhận...'
                      : 'Xác nhận mã'}
                  </button>

                </form>

                <button
                  type="button"
                  className="btn-toggle-mode"
                  onClick={resendResetOtp}
                  disabled={
                    authLoading ||
                    otpCooldown > 0
                  }
                >
                  {otpCooldown > 0
                    ? `Gửi lại mã sau ${otpCooldown}s`
                    : 'Gửi lại mã'}
                </button>

                <p className="setup-hint">
                  Hãy giữ màn hình này mở
                  trong khi kiểm tra email.
                </p>

              </>
            )}

            {/* =========================================
                NEW PASSWORD
            ========================================= */}

            {authStep === 'reset-password' && (
              <>

                <p className="setup-hint">
                  Mã xác nhận chính xác.
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

          </div>
        </div>
  )
}
