import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import AuthPage from './AuthPage.jsx'
import EventsSection from '../components/EventsSection.jsx'
import AdminPanel from '../components/AdminPanel.jsx'
import {
  Fish,
  Jellyfish,
  Anglerfish,
  Bubbles,
  Glow,
} from '../components/decor/SeaDecor.jsx'

const NAV_LINKS = [
  { href: '#trang-chu', label: 'Trang chủ' },
  { href: '#su-kien', label: 'Sự kiện' },
  { href: '#gioi-thieu', label: 'Giới thiệu' },
  { href: '#giao-vien', label: 'Giáo viên' },
  { href: '#anh-lop', label: 'Ảnh lớp' },
  { href: '#thong-bao', label: 'Thông báo' },
]

const PHOTO_PLACEHOLDER_COUNT = 6

/**
 * Trang chính (landing page). Nội dung hiển thị được giữ nguyên như
 * bản gốc; phần khác biệt là:
 *  - Auth (login/logout/profile) lấy từ AuthContext thay vì state cục bộ.
 *  - Modal đăng nhập/đăng ký nay là <AuthPage /> độc lập.
 *  - Admin panel gọi backend qua adminService (xem components/AdminPanel.jsx).
 *
 * Việc đăng/xóa "announcements" (thông báo chung) vẫn dùng Supabase
 * trực tiếp với anon key + RLS, giống bản gốc — đây không phải là dữ
 * liệu nhạy cảm như tài khoản/OTP, nhưng nếu cần siết chặt hơn, nên
 * chuyển 2 thao tác này (handleSubmit, handleDeleteAnnouncement) sang
 * một route backend tương tự admin.routes.js.
 */
export default function HomePage() {
  const { session, profile, authReady, isAdmin, logout } = useAuth()

  const [showAuth, setShowAuth] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('trang-chu')

  const [announcements, setAnnouncements] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sender, setSender] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openAuth = (step = 'login') => {
    setShowAuth(true)
  }

  useEffect(() => {
    fetchAnnouncements()

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
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className={`page ${showAuth ? 'no-scroll' : ''}`}>
      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}

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
      className={
        activeSection === link.href.replace('#', '')
          ? 'active'
          : ''
      }
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

      {/* =====================================================
          SỰ KIỆN
      ===================================================== */}

      <EventsSection profile={profile} />

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

    <div className="announcement-card-header">
      <h4>
        {item.title}
      </h4>

      {profile?.role === 'admin' && (
        <button
          className="btn-delete-event"
          onClick={() =>
            handleDeleteAnnouncement(item.id)
          }
        >
          Xóa
        </button>
      )}
    </div>
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
