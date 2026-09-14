import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import AuthPage from './AuthPage.jsx'
import EventsSection from '../components/EventsSection.jsx'
import AdminPanel from '../components/AdminPanel.jsx'
import ClassRoomView from '../components/ClassRoomView.jsx'
import ProfileMenu from '../components/ProfileMenu.jsx'
import NotificationPermissionModal from '../components/NotificationPermissionModal.jsx'
import {
  Fish,
  Jellyfish,
  Anglerfish,
  Bubbles,
  Glow,
} from '../components/decor/SeaDecor.jsx'
import * as adminService from '../services/adminService.js'
import * as classroomService from '../services/classroomService.js'
import {
  isPushEnabledPref,
  requestPermissionAndSubscribe,
  registerServiceWorker,
  getNotificationPermission,
  needsPushPrompt,
  hasPromptedPermission,
  markPrompted,
} from '../services/pushService.js'
import { countNewer } from '../lib/unreadStore.js'

const NAV_LINKS = [
  { href: '#trang-chu', label: 'Trang chủ' },
  { href: '#su-kien', label: 'Sự kiện' },
  { href: '#gioi-thieu', label: 'Giới thiệu' },
  { href: '#giao-vien', label: 'Giáo viên' },
  { href: '#anh-lop', label: 'Ảnh lớp' },
  { href: '#thong-bao', label: 'Trò chuyện' },
]

const PHOTO_PLACEHOLDER_COUNT = 6

export default function HomePage() {
  const { session, profile, authReady, isAdmin, logout } = useAuth()

  const [showAuth, setShowAuth] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showClassRoom, setShowClassRoom] = useState(false)
  const [classInitialTab, setClassInitialTab] = useState('announcements')
  const [authLoading, setAuthLoading] = useState(false)
  const [authInitialStep, setAuthInitialStep] = useState('login')
  const [activeSection, setActiveSection] = useState('trang-chu')

  const [announcements, setAnnouncements] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sender, setSender] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [siteImages, setSiteImages] = useState({
    teacher: [],
    hero: [],
    gallery: [],
  })

  const [unreadTotal, setUnreadTotal] = useState(0)
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  const teacherPhoto = siteImages.teacher[0]
  const heroPhoto = siteImages.hero[0]
  const galleryPhotos = siteImages.gallery

  const loadSiteImages = async () => {
    try {
      const data = await adminService.getPublicSiteImages()
      setSiteImages({
        teacher: data.images?.teacher || [],
        hero: data.images?.hero || [],
        gallery: data.images?.gallery || [],
      })
    } catch (err) {
      console.error('Lỗi tải ảnh website:', err)
    }
  }

  const refreshUnread = useCallback(async () => {
    if (!profile?.is_member) {
      setUnreadTotal(0)
      return
    }
    try {
      const [ann, hw] = await Promise.all([
        classroomService.getAnnouncements().catch(() => ({ items: [] })),
        classroomService.getHomework().catch(() => ({ items: [] })),
      ])
      const annItems = Array.isArray(ann?.items) ? ann.items : []
      const hwItems = Array.isArray(hw?.items) ? hw.items : []
      const a = countNewer(annItems, 'announcements')
      const h = countNewer(hwItems, 'homework')
      setUnreadTotal(Math.min(99, a + h))
    } catch {
      setUnreadTotal(0)
    }
  }, [profile?.is_member])

  const openAuth = (step = 'login') => {
    setAuthInitialStep(step === 'register' ? 'register' : 'login')
    setShowAuth(true)
  }

  useEffect(() => {
    if (!authReady) return
    if (profile?.needs_display_name) {
      setAuthInitialStep('display-name')
      setShowAuth(true)
    }
  }, [authReady, profile?.needs_display_name])

  // Push + SW: đăng ký SW cho mọi user đã login.
  // - Đang nhập tên hiển thị (Google lần đầu): KHÔNG hỏi thông báo / không che form tên.
  // - Sau khi có tên: thành viên A4 hỏi liên tục đến khi permission = granted.
  // - Tài khoản lần đầu (chưa member): hỏi một lần sau khi nhập tên nếu trình duyệt chưa cấp quyền.
  // - Đã granted: tự subscribe.
  useEffect(() => {
    if (!authReady || !session) return
    // Chưa xong tên → chờ, không hiện bảng push (tránh chỉ thấy form tên).
    if (profile?.needs_display_name) {
      setShowPushPrompt(false)
      return
    }

    let onUnread = null
    if (profile?.is_member) {
      refreshUnread()
      onUnread = () => refreshUnread()
      window.addEventListener('classweb-unread-updated', onUnread)
    }

    registerServiceWorker().catch(() => {})

    const perm = getNotificationPermission()
    let promptTimer = null

    const shouldAskMember = profile?.is_member && needsPushPrompt()
    // Lần đầu (sau set tên, chưa member): hỏi 1 lần nếu chưa prompted và chưa granted
    const shouldAskFirstTime =
      !profile?.is_member &&
      needsPushPrompt() &&
      !hasPromptedPermission()

    if (shouldAskMember || shouldAskFirstTime) {
      promptTimer = setTimeout(() => setShowPushPrompt(true), 600)
    } else if (perm === 'granted' && (profile?.is_member || isPushEnabledPref())) {
      requestPermissionAndSubscribe().catch(() => {})
    }

    return () => {
      if (promptTimer) clearTimeout(promptTimer)
      if (onUnread) window.removeEventListener('classweb-unread-updated', onUnread)
    }
  }, [
    authReady,
    session,
    profile?.is_member,
    profile?.needs_display_name,
    refreshUnread,
  ])

  useEffect(() => {
    if (!authReady || !profile?.is_member || showClassRoom) return

    const POLL_MS = 20_000
    let timer = null

    const tick = () => {
      if (document.visibilityState === 'visible') refreshUnread()
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUnread()
    }

    timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authReady, profile?.is_member, showClassRoom, refreshUnread])

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash || ''
      if (hash.startsWith('#/classroom')) {
        const parts = hash.replace(/^#\/?/, '').split('/')
        const tab = parts[1] || 'announcements'
        const allowed = new Set(['announcements', 'timetable', 'homework', 'rules', 'cleaning-duty'])
        setClassInitialTab(allowed.has(tab) ? tab : 'announcements')
        if (profile?.is_member) setShowClassRoom(true)
      }
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)

    const onMsg = (event) => {
      if (event.data?.type === 'CLASS_REFRESH') {
        window.dispatchEvent(new CustomEvent('classweb-class-refresh'))
        window.dispatchEvent(new CustomEvent('classweb-unread-updated'))
        return
      }
      if (event.data?.type === 'PUSH_NAVIGATE' && event.data.url) {
        try {
          const u = new URL(event.data.url, window.location.origin)
          window.location.hash = u.hash || '#/classroom/announcements'
        } catch {
          window.location.hash = '#/classroom/announcements'
        }
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMsg)
    }
    return () => {
      window.removeEventListener('hashchange', applyHash)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMsg)
      }
    }
  }, [profile?.is_member])

  useEffect(() => {
    fetchAnnouncements()
    loadSiteImages()

    const onImagesUpdated = () => loadSiteImages()
    window.addEventListener('site-images-updated', onImagesUpdated)

    const channel = supabase
      .channel('realtime-announcements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          setAnnouncements((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('site-images-updated', onImagesUpdated)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const sectionIds = NAV_LINKS.map((link) => link.href.replace('#', ''))

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    )

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setAnnouncements(data)
    if (error) console.error('Lỗi lấy dữ liệu:', error)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title || !content) return alert('Vui lòng nhập đủ tiêu đề và nội dung!')

    setSubmitting(true)
    const { error } = await supabase
      .from('announcements')
      .insert([{ title, content, sender: sender || 'Ẩn danh' }])
    setSubmitting(false)

    if (error) return alert('Lỗi đăng thông báo: ' + error.message)

    setTitle('')
    setContent('')
    setSender('')
  }

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa thông báo này?')) return

    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) return alert('Xóa thông báo thất bại: ' + error.message)

    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSignOut = async () => {
    if (authLoading) return
    setAuthLoading(true)
    try {
      await logout()
      setShowAuth(false)
      setShowClassRoom(false)
      setUnreadTotal(0)
      setShowPushPrompt(false)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleAllowPush = async () => {
    try {
      await requestPermissionAndSubscribe()
      setShowPushPrompt(false)
    } catch (err) {
      console.warn('Push subscribe:', err?.message || err)
      // Vẫn đánh dấu đã hỏi (lần đầu) để không spam user non-member
      markPrompted()
      alert(
        err?.message ||
          'Không bật được thông báo. Hãy cho phép quyền thông báo trong cài đặt trình duyệt, rồi thử lại.'
      )
    }
  }

  const handleDenyPush = () => {
    // Non-member: đánh dấu đã hỏi 1 lần. Member: chỉ ẩn phiên này, lần sau hỏi lại.
    if (!profile?.is_member) markPrompted()
    setShowPushPrompt(false)
  }

  const openClassRoom = (tab = 'announcements') => {
    setClassInitialTab(tab)
    setShowClassRoom(true)
  }

  const closeClassRoom = () => {
    setShowClassRoom(false)
    refreshUnread()
  }

  return (
    <div className={`page ${showAuth || showClassRoom ? 'no-scroll' : ''}`}>
      {showAuth && (
        <AuthPage
          key={authInitialStep}
          initialStep={authInitialStep}
          onClose={() => setShowAuth(false)}
        />
      )}

      {showClassRoom && (
        <ClassRoomView
          onClose={closeClassRoom}
          initialTab={classInitialTab}
        />
      )}

      {showPushPrompt && !profile?.needs_display_name && (
        <NotificationPermissionModal
          blocked={getNotificationPermission() === 'denied'}
          onAllow={handleAllowPush}
          onDeny={handleDenyPush}
        />
      )}

      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="#trang-chu">
            <span className="brand-mark">10A4</span>
            <span className="brand-name">Nguyễn Hữu Huân</span>
          </a>

          <nav className="nav-links">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={
                  activeSection === link.href.replace('#', '') ? 'active' : ''
                }
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            {profile?.is_member && (
              <button
                type="button"
                className="btn-class btn-class--badge"
                onClick={() => openClassRoom('announcements')}
              >
                Vô Lớp 10A4
                {unreadTotal > 0 ? (
                  <span className="nav-unread-badge" aria-label={`${unreadTotal} thông báo mới`}>
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </span>
                ) : null}
              </button>
            )}

            {profile?.role === 'admin' && (
              <button
                className="btn-class"
                style={{ background: '#e0a640' }}
                onClick={() => setShowAdminPanel(true)}
              >
                Quản lý Admin 🤓
              </button>
            )}

            {!authReady ? (
              <button className="btn-verify" disabled>
                Đang kiểm tra...
              </button>
            ) : session ? (
              <ProfileMenu onLogout={handleSignOut} />
            ) : (
              <>
                <button className="btn-verify" onClick={() => openAuth('login')}>
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
                  onClick={() => alert('Nút đăng ký đang bảo trì')}
                >
                  Đăng ký
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section id="trang-chu" className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <p className="eyebrow">Trường THPT Nguyễn Hữu Huân</p>
            <h1>
              Lớp <span className="highlight">10A4</span>
            </h1>
            <p className="hero-desc">
              Một khoá học, một tập thể — nơi lưu lại những giờ học, những tấm
              ảnh và tin tức của cả lớp trong suốt năm học.
            </p>
            <div className="hero-stats">
              <div className="stat-card">
                <span className="stat-label">Giáo viên chủ nhiệm</span>
                <span className="stat-value">Cô Lê Thị Út</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Niên khoá</span>
                <span className="stat-value">2026 – 2027</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Trường</span>
                <span className="stat-value">THPT Nguyễn Hữu Huân</span>
              </div>
            </div>
          </div>

          <div className="hero-photo">
            <div className="polaroid polaroid--hero">
              <div className="photo-frame">
                {heroPhoto ? (
                  <img
                    src={heroPhoto.url}
                    alt={heroPhoto.caption || 'Ảnh lớp 10A4'}
                  />
                ) : (
                  'Ảnh lớp'
                )}
              </div>
              <span className="polaroid-caption">
                {heroPhoto?.caption || 'Lớp 10A4'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <EventsSection profile={profile} />

      <section id="gioi-thieu" className="zone zone--shallow">
        <Bubbles count={5} />
        <Fish style={{ top: '20%', left: '8%', width: 46, opacity: 0.5 }} />
        <Fish
          style={{ top: '60%', right: '10%', width: 34, opacity: 0.4 }}
          flip
        />
        <div className="section-inner">
          <p className="eyebrow">Giới thiệu</p>
          <h2>Về lớp chúng mình</h2>
          <p className="section-desc">
            Đây là trang thông tin chung của lớp 10A4, trường THPT Nguyễn Hữu
            Huân — nơi cả lớp cùng lưu giữ hình ảnh, theo dõi thông báo và tìm
            hiểu về giáo viên chủ nhiệm. Nội dung ở đây sẽ được cập nhật theo
            từng học kỳ.
          </p>
        </div>
      </section>

      <section id="giao-vien" className="zone zone--mid">
        <Bubbles count={4} className="bubbles--right" />
        <Fish style={{ top: '75%', left: '15%', width: 40, opacity: 0.4 }} />
        <div className="section-inner teacher">
          <div className="teacher-photo">
            <div className="photo-frame photo-frame--teacher">
              {teacherPhoto ? (
                <img
                  src={teacherPhoto.url}
                  alt={teacherPhoto.caption || 'Ảnh giáo viên chủ nhiệm'}
                />
              ) : (
                'Ảnh cô Út'
              )}
            </div>
            {siteImages.teacher.length > 1 && (
              <div className="teacher-thumbs">
                {siteImages.teacher.slice(1).map((photo) => (
                  <img
                    key={photo.path}
                    src={photo.url}
                    alt={photo.caption || 'Giáo viên'}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="teacher-info">
            <p className="eyebrow">Giáo viên chủ nhiệm</p>
            <h2>Cô Lê Thị Út</h2>
            <p className="section-desc">
              Cô Lê Thị Út là giáo viên chủ nhiệm của lớp 10A4, đồng hành cùng
              lớp trong các hoạt động học tập và phong trào của trường THPT
              Nguyễn Hữu Huân.
            </p>
          </div>
        </div>
      </section>

      <section id="anh-lop" className="zone zone--deep">
        <Fish style={{ top: '12%', left: '6%', width: 36, opacity: 0.35 }} />
        <Fish style={{ top: '18%', left: '14%', width: 24, opacity: 0.3 }} />
        <Fish
          style={{ top: '85%', right: '8%', width: 38, opacity: 0.3 }}
          flip
        />
        <div className="section-inner">
          <p className="eyebrow">Kỷ niệm</p>
          <h2>Ảnh lớp</h2>
          <p className="section-desc">
            Những khoảnh khắc của lớp 10A4 sẽ được cập nhật tại đây.
          </p>
          <div className="gallery-grid">
            {(galleryPhotos.length
              ? galleryPhotos
              : Array.from({ length: PHOTO_PLACEHOLDER_COUNT }, (_, i) => ({
                  path: `placeholder-${i}`,
                  url: '',
                  caption: '',
                }))
            ).map((photo, i) => (
              <div
                className={`polaroid ${i % 2 === 0 ? 'tilt-left' : 'tilt-right'}`}
                key={photo.path}
              >
                <div className="photo-frame">
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.caption || `Ảnh lớp ${i + 1}`}
                    />
                  ) : (
                    'Ảnh'
                  )}
                </div>
                <span className="polaroid-caption">
                  {photo.caption || `Kỷ niệm ${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  )
}
