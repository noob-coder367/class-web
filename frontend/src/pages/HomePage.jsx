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

  // Push + SW: moi tai khoan da login (da co ten) deu bat thong bao day duoc.
  // - Dang nhap ten hien thi: KHONG hoi / khong che form ten.
  // - Sau khi co ten: hoi neu trinh duyet chua cap quyen.
  // - Da granted + pref bat: tu subscribe.
  useEffect(() => {
    if (!authReady || !session) return
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

    // Moi tai khoan (A4 hoac khong) deu duoc hoi / bat push
    if (needsPushPrompt() && !hasPromptedPermission()) {
      promptTimer = setTimeout(() => setShowPushPrompt(true), 600)
    } else if (perm === 'granted' && isPushEnabledPref()) {
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
    if (error) console.error('Loi lay du lieu:', error)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title || !content) return alert('Vui long nhap du tieu de va noi dung!')

    setSubmitting(true)
    const { error } = await supabase
      .from('announcements')
      .insert([{ title, content, sender: sender || 'An danh' }])
    setSubmitting(false)

    if (error) return alert('Loi dang thong bao: ' + error.message)

    setTitle('')
    setContent('')
    setSender('')
  }

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Ban co chac muon xoa thong bao nay?')) return

    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) return alert('Xoa thong bao that bai: ' + error.message)

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
      markPrompted()
      alert(
        err?.message ||
          'Khong bat duoc thong bao. Hay cho phep quyen thong bao trong cai dat trinh duyet, roi thu lai.'
      )
    }
  }

  const handleDenyPush = () => {
    markPrompted()
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
            <span className="brand-name">Nguyen Huu Huan</span>
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
                Vo Lop 10A4
                {unreadTotal > 0 ? (
                  <span className="nav-unread-badge" aria-label={`${unreadTotal} thong bao moi`}>
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
                Quan ly Admin
              </button>
            )}

            {!authReady ? (
              <button className="btn-verify" disabled>
                Dang kiem tra...
              </button>
            ) : session ? (
              <ProfileMenu onLogout={handleSignOut} />
            ) : (
              <>
                <button className="btn-verify" onClick={() => openAuth('login')}>
                  Dang nhap
                </button>
                <button
                  className="btn-verify"
                  style={{
                    background: 'transparent',
                    color: 'var(--primary)',
                    border: '1px solid var(--primary)',
                    boxShadow: 'none',
                  }}
                  onClick={() => alert('Nut dang ky dang bao tri')}
                >
                  Dang ky
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section id="trang-chu" className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <p className="eyebrow">Truong THPT Nguyen Huu Huan</p>
            <h1>
              Lop <span className="highlight">10A4</span>
            </h1>
            <p className="hero-desc">
              Mot khoa hoc, mot tap the — noi luu lai nhung gio hoc, nhung tam
              anh va tin tuc cua ca lop trong suot nam hoc.
            </p>
            <div className="hero-stats">
              <div className="stat-card">
                <span className="stat-label">Giao vien chu nhiem</span>
                <span className="stat-value">Co Le Thi Ut</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Nien khoa</span>
                <span className="stat-value">2026 – 2027</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Truong</span>
                <span className="stat-value">THPT Nguyen Huu Huan</span>
              </div>
            </div>
          </div>

          <div className="hero-photo">
            <div className="polaroid polaroid--hero">
              <div className="photo-frame">
                {heroPhoto ? (
                  <img
                    src={heroPhoto.url}
                    alt={heroPhoto.caption || 'Anh lop 10A4'}
                  />
                ) : (
                  'Anh lop'
                )}
              </div>
              <span className="polaroid-caption">
                {heroPhoto?.caption || 'Lop 10A4'}
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
          <p className="eyebrow">Gioi thieu</p>
          <h2>Ve lop chung minh</h2>
          <p className="section-desc">
            Day la trang thong tin chung cua lop 10A4, truong THPT Nguyen Huu
            Huan — noi ca lop cung luu giu hinh anh, theo doi thong bao va tim
            hieu ve giao vien chu nhiem. Noi dung o day se duoc cap nhat theo
            tung hoc ky.
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
                  alt={teacherPhoto.caption || 'Anh giao vien chu nhiem'}
                />
              ) : (
                'Anh co Ut'
              )}
            </div>
            {siteImages.teacher.length > 1 && (
              <div className="teacher-thumbs">
                {siteImages.teacher.slice(1).map((photo) => (
                  <img
                    key={photo.path}
                    src={photo.url}
                    alt={photo.caption || 'Giao vien'}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="teacher-info">
            <p className="eyebrow">Giao vien chu nhiem</p>
            <h2>Co Le Thi Ut</h2>
            <p className="section-desc">
              Co Le Thi Ut la giao vien chu nhiem cua lop 10A4, dong hanh cung
              lop trong cac hoat dong hoc tap va phong trao cua truong THPT
              Nguyen Huu Huan.
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
          <p className="eyebrow">Ky niem</p>
          <h2>Anh lop</h2>
          <p className="section-desc">
            Nhung khoanh khac cua lop 10A4 se duoc cap nhat tai day.
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
                      alt={photo.caption || `Anh lop ${i + 1}`}
                    />
                  ) : (
                    'Anh lop'
                  )}
                </div>
                {photo.caption ? (
                  <span className="polaroid-caption">{photo.caption}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="thong-bao" className="zone zone--abyss">
        <Glow count={7} />
        <Jellyfish style={{ top: '18%', right: '12%', width: 52, opacity: 0.45 }} />
        <Anglerfish style={{ bottom: '12%', left: '8%', width: 64, opacity: 0.5 }} />
        <div className="section-inner">
          <p className="eyebrow">Cong dong</p>
          <h2>Tro chuyen lop</h2>
          <p className="section-desc">
            Gui loi chao, thong bao nhanh hoac chia se khoanh khac — moi nguoi
            trong lop deu co the xem.
          </p>

          <form className="announcement-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Tieu de"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Noi dung..."
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <input
              type="text"
              placeholder="Nguoi gui (tuy chon)"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'Dang gui...' : 'Gui thong bao'}
            </button>
          </form>

          <div className="announcement-list">
            {announcements.length === 0 ? (
              <p className="announcement-empty">Chua co tin nhan nao.</p>
            ) : (
              announcements.map((item) => (
                <article key={item.id} className="announcement-card">
                  <div className="announcement-card-header">
                    <h3>{item.title}</h3>
                    {profile?.role === 'admin' && (
                      <button
                        type="button"
                        className="btn-delete-announcement"
                        onClick={() => handleDeleteAnnouncement(item.id)}
                      >
                        Xoa
                      </button>
                    )}
                  </div>
                  <p>{item.content}</p>
                  <div className="announcement-meta">
                    <span>{item.sender || 'An danh'}</span>
                    <span>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString('vi-VN')
                        : ''}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <footer className="site-footer zone zone--floor">
        <div className="section-inner">
          <p>Lop 10A4 · THPT Nguyen Huu Huan · Nien khoa 2026 – 2027</p>
        </div>
      </footer>

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  )
}
