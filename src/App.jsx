import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import AdminPanel from './AdminPanel'
import EventsSection from './EventsSection'

const NAV_LINKS = [
  { href: '#trang-chu', label: 'Trang chủ' },
  { href: '#gioi-thieu', label: 'Giới thiệu' },
  { href: '#su-kien', label: 'Sự kiện' }, // 👈 THÊM DÒNG NÀY
  { href: '#anh-lop', label: 'Ảnh lớp' },
  { href: '#thong-bao', label: 'Thông báo' },
  { href: '#giao-vien', label: 'Giáo viên' },
]

const PHOTO_PLACEHOLDER_COUNT = 6
const SECRET_CODE = 'A4-NHH-MaiDinh'

function IslandScene() {
  return (
    <svg
      className="decor-svg island-scene"
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <path
        d="M0,180 Q200,90 460,130 Q650,160 820,110 Q1000,70 1200,140 L1200,260 L0,260 Z"
        fill="#5c8a4a"
      />

      <path
        d="M0,200 Q220,150 480,175 Q680,195 860,160 Q1040,130 1200,175 L1200,260 L0,260 Z"
        fill="#4a7440"
      />

      <g transform="translate(180,55)">
        <rect x="-4" y="0" width="8" height="80" fill="#7a5230" />

        <g fill="#3f7d3a">
          <ellipse
            cx="-28"
            cy="-6"
            rx="30"
            ry="10"
            transform="rotate(-25 -28 -6)"
          />
          <ellipse
            cx="28"
            cy="-6"
            rx="30"
            ry="10"
            transform="rotate(25 28 -6)"
          />
          <ellipse cx="0" cy="-16" rx="14" ry="30" />
          <ellipse
            cx="-20"
            cy="-24"
            rx="26"
            ry="9"
            transform="rotate(-45 -20 -24)"
          />
          <ellipse
            cx="20"
            cy="-24"
            rx="26"
            ry="9"
            transform="rotate(45 20 -24)"
          />
        </g>
      </g>

      <g
        stroke="#2c3e50"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      >
        <path d="M950,40 q12,-14 24,0 q12,-14 24,0" />
        <path d="M1020,70 q10,-11 20,0 q10,-11 20,0" />
      </g>

      <g transform="translate(620,168)">
        <ellipse cx="0" cy="0" rx="26" ry="14" fill="#8a5a34" />
        <circle cx="24" cy="-8" r="11" fill="#8a5a34" />
        <path d="M30,-16 l6,-10 l2,10 Z" fill="#8a5a34" />
        <rect x="-20" y="10" width="6" height="14" fill="#8a5a34" />
        <rect x="8" y="10" width="6" height="14" fill="#8a5a34" />
      </g>
    </svg>
  )
}

function Fish({ style, flip }) {
  return (
    <svg
      className="decor-svg fish"
      style={style}
      viewBox="0 0 60 30"
      aria-hidden="true"
      transform={flip ? 'scale(-1,1)' : undefined}
    >
      <path
        d="M4,15 Q18,0 40,8 L34,15 L40,22 Q18,30 4,15 Z"
        fill="currentColor"
      />
      <path
        d="M0,15 L10,9 L10,21 Z"
        fill="currentColor"
      />
      <circle cx="30" cy="12" r="1.6" fill="#0a2c3d" />
    </svg>
  )
}

function Jellyfish({ style }) {
  return (
    <svg
      className="decor-svg jellyfish"
      style={style}
      viewBox="0 0 60 80"
      aria-hidden="true"
    >
      <path
        d="M10,30 Q10,0 30,0 Q50,0 50,30 Q30,42 10,30 Z"
        fill="currentColor"
        opacity="0.85"
      />

      <g
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      >
        <path d="M16,32 Q14,55 18,76" />
        <path d="M28,34 Q26,58 30,78" />
        <path d="M40,32 Q42,55 38,76" />
      </g>
    </svg>
  )
}

function Anglerfish({ style }) {
  return (
    <svg
      className="decor-svg anglerfish"
      style={style}
      viewBox="0 0 100 60"
      aria-hidden="true"
    >
      <path
        d="M8,30 Q20,8 55,14 Q80,18 88,30 Q80,42 55,46 Q20,52 8,30 Z"
        fill="currentColor"
      />

      <path
        d="M4,30 L14,22 L14,38 Z"
        fill="currentColor"
      />

      <path
        d="M55,14 Q40,-6 34,-10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />

      <circle cx="33" cy="-11" r="4.5" className="lure" />
      <circle cx="66" cy="27" r="2" fill="#0a1620" />
    </svg>
  )
}

function Bubbles({ count = 6, className = '' }) {
  return (
    <div
      className={`bubbles ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="bubble"
          style={{ '--i': i }}
        />
      ))}
    </div>
  )
}

function Glow({ count = 5, className = '' }) {
  return (
    <div
      className={`glow-dots ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="glow-dot"
          style={{ '--i': i }}
        />
      ))}
    </div>
  )
}

export default function App() {
  /* =====================================================
     ANNOUNCEMENTS
  ===================================================== */

  const [announcements, setAnnouncements] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sender, setSender] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /* =====================================================
     ADMIN
  ===================================================== */

  const [showAdminPanel, setShowAdminPanel] = useState(false)

  /* =====================================================
     AUTH
  ===================================================== */

  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)

  /*
    login
    register
    verify-register
    forgot-password
    verify-reset
    reset-password
  */
  const [authStep, setAuthStep] = useState('login')
  const [showAuth, setShowAuth] = useState(false)

  /* =====================================================
     FORM DATA
  ===================================================== */

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [secretCode, setSecretCode] = useState('')
  const [isMember, setIsMember] = useState(null)

  /* =====================================================
     OTP
  ===================================================== */

  const [otp, setOtp] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpCooldown, setOtpCooldown] = useState(0)

  /*
    register / reset
  */
  const [otpPurpose, setOtpPurpose] = useState(null)

  /* =====================================================
     OTP COUNTDOWN
  ===================================================== */

  useEffect(() => {
    if (otpCooldown <= 0) return

    const timer = setInterval(() => {
      setOtpCooldown((prev) =>
        prev > 0 ? prev - 1 : 0
      )
    }, 1000)

    return () => clearInterval(timer)
  }, [otpCooldown])

  /* =====================================================
     INITIAL AUTH
  ===================================================== */

  useEffect(() => {
    let mounted = true

    fetchAnnouncements()

    const initAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        if (!mounted) return

        setSession(currentSession)

        if (currentSession?.user) {
          await loadProfile(currentSession.user)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error(
          'Lỗi khởi tạo Auth:',
          error
        )
      } finally {
        if (mounted) {
          setAuthReady(true)
        }
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return

        setSession(newSession)

        if (newSession?.user) {
          await loadProfile(newSession.user)
        } else {
          setProfile(null)
        }

        if (mounted) {
          setAuthReady(true)
        }
      }
    )

    const channel = supabase
      .channel('realtime-announcements')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
        },
        (payload) => {
          if (!mounted) return

          setAnnouncements((prev) => [
            payload.new,
            ...prev,
          ])
        }
      )
      .subscribe()

    return () => {
      mounted = false
      subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [])

  /* =====================================================
     FETCH ANNOUNCEMENTS
  ===================================================== */

  const fetchAnnouncements = async () => {
    const {
      data,
      error,
    } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (data) {
      setAnnouncements(data)
    }

    if (error) {
      console.error(
        'Lỗi lấy dữ liệu:',
        error
      )
    }
  }

  /* =====================================================
     LOAD PROFILE
  ===================================================== */

  const loadProfile = async (user) => {
    if (!user?.id) return null

    const {
      data,
      error,
    } = await supabase
      .from('profiles')
      .select(
        'id, username, email, is_member, role'
      )
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error(
        'Lỗi lấy profile:',
        error
      )

      return null
    }

    if (data) {
      setProfile(data)
      setShowAuth(false)

      return data
    }

    /*
      Nếu Auth có user nhưng profiles
      chưa có dữ liệu thì yêu cầu hoàn tất.
    */

    setProfile(null)

    setAuthStep('register')

    setUsername('')
    setSecretCode('')
    setIsMember(null)

    setShowAuth(true)

    return null
  }

  /* =====================================================
     RESET AUTH FORM
  ===================================================== */

  const resetAuthForm = () => {
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSecretCode('')
    setIsMember(null)

    setOtp('')
    setOtpEmail('')
    setOtpPurpose(null)
    setOtpCooldown(0)
  }

  /* =====================================================
     OPEN AUTH
  ===================================================== */

  const openAuth = (step = 'login') => {
    resetAuthForm()

    setAuthStep(step)
    setShowAuth(true)
  }

  /* =====================================================
     CHECK USERNAME
  ===================================================== */

  const isUsernameTaken = async (name) => {
    const {
      data,
      error,
    } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', name)
      .maybeSingle()

    if (error) {
      console.error(
        'Lỗi kiểm tra username:',
        error
      )

      return false
    }

    return !!data
  }

  /* =====================================================
     FIND EMAIL FROM USERNAME

     IMPORTANT:
     profiles cần có cột email.
  ===================================================== */

  const getEmailFromUsername = async (name) => {
    const {
      data,
      error,
    } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', name.trim())
      .maybeSingle()

    if (error) {
      console.error(
        'Lỗi tìm email:',
        error
      )

      return null
    }

    return data?.email || null
  }

  /* =====================================================
     REGISTER STEP 1

     Nhập:
     username
     email
     password
     confirm password
     member
     secret code

     Sau đó gửi OTP.
  ===================================================== */

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()

    const cleanUsername =
      username.trim()

    const cleanEmail =
      email.trim().toLowerCase()

    if (!cleanUsername) {
      return alert(
        'Vui lòng nhập username!'
      )
    }

    if (!cleanEmail) {
      return alert(
        'Vui lòng nhập email!'
      )
    }

    if (password.length < 8) {
      return alert(
        'Mật khẩu phải có ít nhất 8 ký tự!'
      )
    }

    if (password !== confirmPassword) {
      return alert(
        'Mật khẩu xác nhận không khớp!'
      )
    }

    if (isMember === null) {
      return alert(
        'Vui lòng chọn bạn có phải thành viên 10A4 hay không!'
      )
    }

    if (
      isMember === true &&
      secretCode !== SECRET_CODE
    ) {
      return alert(
        'Mã thành viên không chính xác!'
      )
    }

    setAuthLoading(true)

    try {
      if (
        await isUsernameTaken(
          cleanUsername
        )
      ) {
        alert(
          'Username này đã được sử dụng!'
        )

        return
      }

      /*
        signUp tạo Auth user.

        Email confirmation được dùng để
        xác nhận email.
      */

      const {
        data,
        error,
      } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      })

      if (error) {
        console.error(
          'Register error:',
          error
        )

        alert(error.message)

        return
      }

      const user = data?.user

      if (!user) {
        alert(
          'Không thể tạo tài khoản!'
        )

        return
      }

      /*
        Lưu profile.

        email được lưu cùng username để
        sau này username có thể tìm email.
      */

      const {
        error: profileError,
      } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id,
            username: cleanUsername,
            email: cleanEmail,
            is_member: isMember === true,
          },
        ])

      if (profileError) {
        console.error(
          'Profile error:',
          profileError
        )

        /*
          Nếu profile lỗi nhưng Auth user
          đã được tạo thì báo rõ.
        */

        alert(
          'Tài khoản Auth đã được tạo nhưng profile bị lỗi: ' +
          profileError.message
        )

        return
      }

      /*
        Gửi OTP 6 số.
      */

      const {
        error: otpError,
      } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
        },
      })

      if (otpError) {
        console.error(
          'OTP error:',
          otpError
        )

        alert(
          'Không thể gửi mã xác nhận: ' +
          otpError.message
        )

        return
      }

      setOtpEmail(cleanEmail)
      setOtpPurpose('register')
      setOtp('')
      setOtpCooldown(60)

      /*
        QUAN TRỌNG:
        Không setShowAuth(false).

        Người dùng vẫn đứng ở màn hình OTP.
      */

      setAuthStep('verify-register')

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     VERIFY REGISTER OTP
  ===================================================== */

  const handleVerifyRegister = async (e) => {
    e.preventDefault()

    if (otp.length !== 6) {
      return alert(
        'Vui lòng nhập đủ 6 số!'
      )
    }

    setAuthLoading(true)

    try {
      const {
        data,
        error,
      } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otp,
        type: 'email',
      })

      if (error) {
        console.error(
          'Verify register OTP error:',
          error
        )

        alert(
          'Mã xác nhận không đúng hoặc đã hết hạn!'
        )

        return
      }

      if (!data?.user) {
        alert(
          'Xác nhận email thất bại!'
        )

        return
      }

      /*
        Đảm bảo profile được load.
      */

      const loadedProfile =
        await loadProfile(data.user)

      if (loadedProfile) {
        alert(
          'Đăng ký thành công!'
        )

        /*
          Chỉ lúc này mới đóng màn hình.
        */

        setShowAuth(false)
      } else {
        alert(
          'Email đã xác nhận nhưng profile chưa hoàn tất.'
        )
      }

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     RESEND REGISTER OTP
  ===================================================== */

  const resendRegisterOtp = async () => {
    if (
      otpCooldown > 0 ||
      !otpEmail ||
      authLoading
    ) {
      return
    }

    setAuthLoading(true)

    try {
      const {
        error,
      } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) {
        alert(
          'Không thể gửi lại mã: ' +
          error.message
        )

        return
      }

      setOtpCooldown(60)

      alert(
        'Mã mới đã được gửi tới email!'
      )

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     LOGIN

     USERNAME + PASSWORD

     username
       ↓
     email
       ↓
     signInWithPassword()
  ===================================================== */

  const handleLoginSubmit = async (e) => {
    e.preventDefault()

    const cleanUsername =
      username.trim()

    if (!cleanUsername) {
      return alert(
        'Vui lòng nhập username!'
      )
    }

    if (!password) {
      return alert(
        'Vui lòng nhập mật khẩu!'
      )
    }

    setAuthLoading(true)

    try {
      const userEmail =
        await getEmailFromUsername(
          cleanUsername
        )

      if (!userEmail) {
        alert(
          'Username hoặc mật khẩu không chính xác!'
        )

        return
      }

      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      })

      if (error) {
        console.error(
          'Login error:',
          error
        )

        alert(
          'Username hoặc mật khẩu không chính xác!'
        )

        return
      }

      if (!data?.user) {
        alert(
          'Đăng nhập thất bại!'
        )

        return
      }

      setSession(data.session)

      const loadedProfile =
        await loadProfile(data.user)

      if (loadedProfile) {
        /*
          Chỉ đăng nhập thành công
          mới về sảnh.
        */

        setShowAuth(false)
      }

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     FORGOT PASSWORD STEP 1

     Nhập username.

     username
       ↓
     tìm email
       ↓
     gửi OTP
  ===================================================== */

  const handleForgotPassword = async (e) => {
    e.preventDefault()

    const cleanUsername =
      username.trim()

    if (!cleanUsername) {
      return alert(
        'Vui lòng nhập username!'
      )
    }

    setAuthLoading(true)

    try {
      const userEmail =
        await getEmailFromUsername(
          cleanUsername
        )

      if (!userEmail) {
        alert(
          'Không tìm thấy tài khoản!'
        )

        return
      }

      const {
        error,
      } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) {
        console.error(
          'Reset OTP error:',
          error
        )

        alert(
          'Không thể gửi mã: ' +
          error.message
        )

        return
      }

      setOtpEmail(userEmail)
      setOtp('')
      setOtpPurpose('reset')
      setOtpCooldown(60)

      /*
        KHÔNG về sảnh.
      */

      setAuthStep('verify-reset')

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     VERIFY RESET OTP
  ===================================================== */

  const handleVerifyReset = async (e) => {
    e.preventDefault()

    if (otp.length !== 6) {
      return alert(
        'Vui lòng nhập đủ 6 số!'
      )
    }

    setAuthLoading(true)

    try {
      const {
        data,
        error,
      } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otp,
        type: 'email',
      })

      if (error) {
        console.error(
          'Verify reset error:',
          error
        )

        alert(
          'Mã xác nhận không đúng hoặc đã hết hạn!'
        )

        return
      }

      if (!data?.session) {
        alert(
          'Không thể xác thực mã!'
        )

        return
      }

      /*
        OTP đúng.

        Bây giờ người dùng được phép
        đặt mật khẩu mới.
      */

      setAuthStep('reset-password')

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     RESEND RESET OTP
  ===================================================== */

  const resendResetOtp = async () => {
    if (
      otpCooldown > 0 ||
      !otpEmail ||
      authLoading
    ) {
      return
    }

    setAuthLoading(true)

    try {
      const {
        error,
      } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) {
        alert(
          'Không thể gửi lại mã: ' +
          error.message
        )

        return
      }

      setOtpCooldown(60)

      alert(
        'Mã mới đã được gửi!'
      )

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     RESET PASSWORD
  ===================================================== */

  const handleResetPassword = async (e) => {
    e.preventDefault()

    if (password.length < 8) {
      return alert(
        'Mật khẩu mới phải có ít nhất 8 ký tự!'
      )
    }

    if (password !== confirmPassword) {
      return alert(
        'Mật khẩu xác nhận không khớp!'
      )
    }

    setAuthLoading(true)

    try {
      const {
        data,
        error,
      } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        console.error(
          'Reset password error:',
          error
        )

        alert(
          'Không thể đổi mật khẩu: ' +
          error.message
        )

        return
      }

      if (!data?.user) {
        alert(
          'Không thể cập nhật mật khẩu!'
        )

        return
      }

      alert(
        'Đổi mật khẩu thành công!'
      )

      /*
        Không giữ session reset.

        Đăng xuất rồi đưa người dùng
        về màn hình đăng nhập.
      */

      await supabase.auth.signOut()

      setSession(null)
      setProfile(null)

      setPassword('')
      setConfirmPassword('')
      setOtp('')

      setAuthStep('login')

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     GOOGLE LOGIN

     Google vẫn có thể giữ lại.
  ===================================================== */

  const handleGoogleLogin = async () => {
    if (authLoading) return

    setAuthLoading(true)

    try {
      const {
        error,
      } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:
            window.location.origin,
        },
      })

      if (error) {
        console.error(
          'Google login error:',
          error
        )

        alert(
          'Không thể đăng nhập Google: ' +
          error.message
        )

        setAuthLoading(false)
      }
    } catch (error) {
      console.error(error)

      alert(
        'Có lỗi xảy ra khi đăng nhập Google!'
      )

      setAuthLoading(false)
    }
  }

  /* =====================================================
     LOGOUT
  ===================================================== */

  const handleSignOut = async () => {
    if (authLoading) return

    setAuthLoading(true)

    try {
      const {
        error,
      } = await supabase.auth.signOut()

      if (error) {
        alert(
          'Không thể đăng xuất!'
        )

        return
      }

      setSession(null)
      setProfile(null)
      setShowAuth(false)

    } finally {
      setAuthLoading(false)
    }
  }

  /* =====================================================
     ANNOUNCEMENT SUBMIT
  ===================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!title || !content) {
      return alert(
        'Vui lòng nhập đủ tiêu đề và nội dung!'
      )
    }

    setSubmitting(true)

    const {
      error,
    } = await supabase
      .from('announcements')
      .insert([
        {
          title,
          content,
          sender: sender || 'Ẩn danh',
        },
      ])

    setSubmitting(false)

    if (error) {
      alert(
        'Lỗi đăng thông báo: ' +
        error.message
      )

      return
    }

    setTitle('')
    setContent('')
    setSender('')
  }

  /* =====================================================
     BACK BUTTON
  ===================================================== */

  const handleAuthBack = () => {
    if (authLoading) return

    if (
      authStep === 'verify-register'
    ) {
      setOtp('')
      setAuthStep('register')
      return
    }

    if (
      authStep === 'verify-reset'
    ) {
      setOtp('')
      setAuthStep('forgot-password')
      return
    }

    if (
      authStep === 'reset-password'
    ) {
      setOtp('')
      setPassword('')
      setConfirmPassword('')
      setAuthStep('forgot-password')
      return
    }

    if (
      authStep === 'forgot-password'
    ) {
      setUsername('')
      setAuthStep('login')
      return
    }

    setShowAuth(false)
  }

  /* =====================================================
     AUTH TITLE
  ===================================================== */

  const getAuthTitle = () => {
    switch (authStep) {
      case 'login':
        return 'Đăng nhập'

      case 'register':
        return 'Đăng ký'

      case 'verify-register':
        return 'Xác nhận email'

      case 'forgot-password':
        return 'Quên mật khẩu'

      case 'verify-reset':
        return 'Xác nhận mã'

      case 'reset-password':
        return 'Đặt mật khẩu mới'

      default:
        return 'Tài khoản'
    }
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div
      className={`page ${
        showAuth ? 'no-scroll' : ''
      }`}
    >

      {/* =================================================
          AUTH OVERLAY
      ================================================= */}

      {showAuth && (
        <div className="auth-overlay fade-in">

          {/* BACK */}

          <button
            className="btn-back"
            onClick={handleAuthBack}
            disabled={authLoading}
          >
            <span>&lt;</span>
            Quay lại
          </button>

          {/* CARD */}

          <div className="auth-card slide-up">

            <h2>
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

                <button
                  type="button"
                  className="btn-toggle-mode"
                  onClick={() => {
                    resetAuthForm()
                    setAuthStep('register')
                  }}
                >
                  Chưa có tài khoản?
                  <br />
                  Đăng ký ngay
                </button>
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
      )}

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <header className="nav">

        <div className="nav-inner">

          <a
            className="brand"
            href="#trang-chu"
          >
            <span className="brand-mark">
              10A4
            </span>

            <span className="brand-name">
              Nguyễn Hữu Huân
            </span>
          </a>

          <nav className="nav-links">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">

            {profile?.is_member && (
              <a
                className="btn-class"
                href="#"
                onClick={(e) => {
                  e.preventDefault()

                  alert(
                    'Nội dung khu vực lớp 10A4 sẽ được cập nhật sau.'
                  )
                }}
              >
                Vô Lớp 10A4
              </a>
            )}

            {profile?.role === 'admin' && (
              <button
                className="btn-class"
                style={{
                  background: '#e0a640',
                }}
                onClick={() =>
                  setShowAdminPanel(true)
                }
              >
                Quản lý Admin 🤓
              </button>
            )}

            {!authReady ? (
              <button
                className="btn-verify"
                disabled
              >
                Đang kiểm tra...
              </button>
            ) : session ? (
              <button
                className="btn-verify"
                onClick={handleSignOut}
                disabled={authLoading}
              >
                {authLoading
                  ? 'Đang xử lý...'
                  : 'Đăng xuất'}
              </button>
                        ) : (
              <>
                <button
                  className="btn-verify"
                  onClick={() =>
                    openAuth('login')
                  }
                >
                  Đăng nhập
                </button>

                <button
                  className="btn-verify"
                  style={{
                    background: 'transparent',
                    color: 'var(--primary)',
                    border: '1px solid var(--primary)',
                    boxShadow: 'none',
                  }}
                  onClick={() =>
                    openAuth('register')
                  }
                >
                  Đăng ký
                </button>
              </>
            )}

          </div>
        </div>
      </header>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section
        id="trang-chu"
        className="hero"
      >

        <IslandScene />

        <div className="hero-inner">

          <div className="hero-text">

            <p className="eyebrow">
              Trường THPT Nguyễn Hữu Huân
            </p>

            <h1>
              Lớp{' '}
              <span className="highlight">
                10A4
              </span>
            </h1>

            <p className="hero-desc">
              Một khoá học, một tập thể —
              nơi lưu lại những giờ học,
              những tấm ảnh và tin tức
              của cả lớp trong suốt năm học.
            </p>

            <div className="hero-stats">

              <div className="stat-card">
                <span className="stat-label">
                  Giáo viên chủ nhiệm
                </span>

                <span className="stat-value">
                  Cô Lê Thị Út
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">
                  Niên khoá
                </span>

                <span className="stat-value">
                  2026 – 2027
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">
                  Trường
                </span>

                <span className="stat-value">
                  THPT Nguyễn Hữu Huân
                </span>
              </div>

            </div>
          </div>

          <div className="hero-photo">

            <div className="polaroid polaroid--hero">

              <div className="photo-frame">
                Ảnh lớp
              </div>

              <span className="polaroid-caption">
                Lớp 10A4
              </span>

            </div>

          </div>

        </div>
      </section>

      {/* ẢNH LỚP */}
      <section id="anh-lop" className="zone zone--deep">
        {/* ... giữ nguyên code cũ của phần ảnh lớp ... */}
      </section>

      {/* ========================================================= */}
      {/* 🎯 CHÈN SỰ KIỆN VÀO ĐÂY */}
      {/* ========================================================= */}
      <EventsSection profile={profile} />

      {/* THÔNG BÁO */}
      <section id="thong-bao" className="zone zone--abyss">
        {/* ... giữ nguyên code cũ của phần thông báo ... */}
      </section>

      {/* =====================================================
          GIỚI THIỆU
      ===================================================== */}

      <section
        id="gioi-thieu"
        className="zone zone--shallow"
      >

        <Bubbles count={5} />

        <Fish
          style={{
            top: '20%',
            left: '8%',
            width: 46,
            opacity: 0.5,
          }}
        />

        <Fish
          style={{
            top: '60%',
            right: '10%',
            width: 34,
            opacity: 0.4,
          }}
          flip
        />

        <div className="section-inner">

          <p className="eyebrow">
            Giới thiệu
          </p>

          <h2>
            Về lớp chúng mình
          </h2>

          <p className="section-desc">
            Đây là trang thông tin chung
            của lớp 10A4, trường THPT
            Nguyễn Hữu Huân — nơi cả lớp
            cùng lưu giữ hình ảnh, theo dõi
            thông báo và tìm hiểu về giáo
            viên chủ nhiệm. Nội dung ở đây
            sẽ được cập nhật theo từng học kỳ.
          </p>

        </div>
      </section>

      {/* =====================================================
          GIÁO VIÊN
      ===================================================== */}

      <section
        id="giao-vien"
        className="zone zone--mid"
      >

        <Bubbles
          count={4}
          className="bubbles--right"
        />

        <Fish
          style={{
            top: '75%',
            left: '15%',
            width: 40,
            opacity: 0.4,
          }}
        />

        <div className="section-inner teacher">

          <div className="teacher-photo">

            <div className="photo-frame photo-frame--teacher">
              Ảnh cô Út
            </div>

          </div>

          <div className="teacher-info">

            <p className="eyebrow">
              Giáo viên chủ nhiệm
            </p>

            <h2>
              Cô Lê Thị Út
            </h2>

            <p className="section-desc">
              Cô Lê Thị Út là giáo viên chủ
              nhiệm của lớp 10A4, đồng hành
              cùng lớp trong các hoạt động
              học tập và phong trào của trường
              THPT Nguyễn Hữu Huân.
            </p>

          </div>

        </div>
      </section>

      {/* =====================================================
          ẢNH LỚP
      ===================================================== */}

      <section
        id="anh-lop"
        className="zone zone--deep"
      >

        <Fish
          style={{
            top: '12%',
            left: '6%',
            width: 36,
            opacity: 0.35,
          }}
        />

        <Fish
          style={{
            top: '18%',
            left: '14%',
            width: 24,
            opacity: 0.3,
          }}
        />

        <Fish
          style={{
            top: '85%',
            right: '8%',
            width: 38,
            opacity: 0.3,
          }}
          flip
        />

        <div className="section-inner">

          <p className="eyebrow">
            Kỷ niệm
          </p>

          <h2>
            Ảnh lớp
          </h2>

          <p className="section-desc">
            Những khoảnh khắc của lớp 10A4
            sẽ được cập nhật tại đây.
          </p>

          <div className="gallery-grid">

            {Array.from({
              length: PHOTO_PLACEHOLDER_COUNT,
            }).map((_, i) => (

              <div
                className={`polaroid ${
                  i % 2 === 0
                    ? 'tilt-left'
                    : 'tilt-right'
                }`}
                key={i}
              >

                <div className="photo-frame">
                  Ảnh lớp
                </div>

              </div>

            ))}

          </div>

        </div>
      </section>

      {/* =====================================================
          THÔNG BÁO
      ===================================================== */}

      <section
        id="thong-bao"
        className="zone zone--abyss"
      >

        <Glow count={7} />

        <Jellyfish
          style={{
            top: '8%',
            right: '12%',
            width: 44,
            opacity: 0.55,
          }}
        />

        <Anglerfish
          style={{
            bottom: '10%',
            left: '6%',
            width: 90,
            opacity: 0.7,
          }}
        />

        <div className="section-inner">

          <p className="eyebrow">
            Bảng tin
          </p>

          <h2>
            Thông báo
          </h2>

          <form
            onSubmit={handleSubmit}
            className="announcement-form"
          >

            <input
              type="text"
              placeholder="Tên người đăng..."
              value={sender}
              onChange={(e) =>
                setSender(e.target.value)
              }
            />

            <input
              type="text"
              placeholder="Tiêu đề thông báo..."
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
            />

            <textarea
              placeholder="Nội dung thông báo..."
              rows="4"
              value={content}
              onChange={(e) =>
                setContent(e.target.value)
              }
            />

            <button
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? 'Đang đăng...'
                : 'Đăng thông báo'}
            </button>

          </form>

          <div className="announcement-list">

            <h3>
              Danh sách thông báo (
              {announcements.length}
              )
            </h3>

            {announcements.length === 0 ? (
              <p className="empty-state">
                Chưa có thông báo nào.
              </p>
            ) : (
              announcements.map((item) => (
                <article
                  className="announcement-card"
                  key={item.id}
                >

                  <h4>
                    {item.title}
                  </h4>

                  <p>
                    {item.content}
                  </p>

                  <div className="announcement-meta">

                    <span>
                      Người đăng:{' '}
                      <strong>
                        {item.sender}
                      </strong>
                    </span>

                    <span>
                      {new Date(
                        item.created_at
                      ).toLocaleString(
                        'vi-VN'
                      )}
                    </span>

                  </div>

                </article>
              ))
            )}

          </div>

        </div>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer
        className="zone zone--floor footer"
      >

        <Glow count={4} />

        <p>
          Lớp 10A4 · Trường THPT Nguyễn Hữu Huân
        </p>

      </footer>

      {/* =====================================================
          ADMIN
      ===================================================== */}

      {showAdminPanel && (
        <AdminPanel
          onClose={() =>
            setShowAdminPanel(false)
          }
        />
      )}

    </div>
  )
}
