import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const NAV_LINKS = [
  { href: '#trang-chu', label: 'Trang chủ' },
  { href: '#gioi-thieu', label: 'Giới thiệu' },
  { href: '#anh-lop', label: 'Ảnh lớp' },
  { href: '#thong-bao', label: 'Thông báo' },
  { href: '#giao-vien', label: 'Giáo viên' },
]

// Số lượng ô ảnh trống hiển thị trong mục "Ảnh lớp".
// Khi có ảnh thật, thay mỗi div.photo-frame bằng <img src="..." alt="..." />
const PHOTO_PLACEHOLDER_COUNT = 6

/* ---------- Trang trí đại dương (SVG tự vẽ, chỉ để làm nền) ---------- */

function IslandScene() {
  return (
    <svg className="decor-svg island-scene" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {/* gò đất / đảo */}
      <path d="M0,180 Q200,90 460,130 Q650,160 820,110 Q1000,70 1200,140 L1200,260 L0,260 Z" fill="#5c8a4a" />
      <path d="M0,200 Q220,150 480,175 Q680,195 860,160 Q1040,130 1200,175 L1200,260 L0,260 Z" fill="#4a7440" />
      {/* cây dừa */}
      <g transform="translate(180,55)">
        <rect x="-4" y="0" width="8" height="80" fill="#7a5230" />
        <g fill="#3f7d3a">
          <ellipse cx="-28" cy="-6" rx="30" ry="10" transform="rotate(-25 -28 -6)" />
          <ellipse cx="28" cy="-6" rx="30" ry="10" transform="rotate(25 28 -6)" />
          <ellipse cx="0" cy="-16" rx="14" ry="30" />
          <ellipse cx="-20" cy="-24" rx="26" ry="9" transform="rotate(-45 -20 -24)" />
          <ellipse cx="20" cy="-24" rx="26" ry="9" transform="rotate(45 20 -24)" />
        </g>
      </g>
      {/* chim */}
      <g stroke="#2c3e50" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M950,40 q12,-14 24,0 q12,-14 24,0" />
        <path d="M1020,70 q10,-11 20,0 q10,-11 20,0" />
      </g>
      {/* con vật trên đất (chó nhỏ) */}
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
      <path d="M4,15 Q18,0 40,8 L34,15 L40,22 Q18,30 4,15 Z" fill="currentColor" />
      <path d="M0,15 L10,9 L10,21 Z" fill="currentColor" />
      <circle cx="30" cy="12" r="1.6" fill="#0a2c3d" />
    </svg>
  )
}

function Jellyfish({ style }) {
  return (
    <svg className="decor-svg jellyfish" style={style} viewBox="0 0 60 80" aria-hidden="true">
      <path d="M10,30 Q10,0 30,0 Q50,0 50,30 Q30,42 10,30 Z" fill="currentColor" opacity="0.85" />
      <g stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M16,32 Q14,55 18,76" />
        <path d="M28,34 Q26,58 30,78" />
        <path d="M40,32 Q42,55 38,76" />
      </g>
    </svg>
  )
}

function Anglerfish({ style }) {
  return (
    <svg className="decor-svg anglerfish" style={style} viewBox="0 0 100 60" aria-hidden="true">
      <path d="M8,30 Q20,8 55,14 Q80,18 88,30 Q80,42 55,46 Q20,52 8,30 Z" fill="currentColor" />
      <path d="M4,30 L14,22 L14,38 Z" fill="currentColor" />
      <path d="M55,14 Q40,-6 34,-10" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="33" cy="-11" r="4.5" className="lure" />
      <circle cx="66" cy="27" r="2" fill="#0a1620" />
    </svg>
  )
}

function Bubbles({ count = 6, className = '' }) {
  return (
    <div className={`bubbles ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="bubble" style={{ '--i': i }} />
      ))}
    </div>
  )
}

function Glow({ count = 5, className = '' }) {
  return (
    <div className={`glow-dots ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="glow-dot" style={{ '--i': i }} />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- */

export default function App() {
  const [announcements, setAnnouncements] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sender, setSender] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

    if (error) {
      alert('Lỗi đăng thông báo: ' + error.message)
    } else {
      setTitle('')
      setContent('')
      setSender('')
    }
  }

  return (
    <div className="page">
      {/* NAV */}
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="#trang-chu">
            <span className="brand-mark">10A4</span>
            <span className="brand-name">Nguyễn Hữu Huân</span>
          </a>
          <nav className="nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* HERO — mặt đất / hòn đảo, đầu nguồn của đại dương */}
      <section id="trang-chu" className="hero">
        <IslandScene />
        <div className="hero-inner">
          <div className="hero-text">
            <p className="eyebrow">Trường THPT Nguyễn Hữu Huân</p>
            <h1>
              Lớp <span className="highlight">10A4</span>
            </h1>
            <p className="hero-desc">
              Một khoá học, một tập thể — nơi lưu lại những giờ học, những tấm ảnh
              và tin tức của cả lớp trong suốt năm học.
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
              <div className="photo-frame">Ảnh lớp</div>
              <span className="polaroid-caption">Lớp 10A4</span>
            </div>
          </div>
        </div>
      </section>

      {/* GIỚI THIỆU — vùng nước nông ngay dưới mặt biển */}
      <section id="gioi-thieu" className="zone zone--shallow">
        <Bubbles count={5} />
        <Fish style={{ top: '20%', left: '8%', width: 46, opacity: 0.5 }} />
        <Fish style={{ top: '60%', right: '10%', width: 34, opacity: 0.4 }} flip />
        <div className="section-inner">
          <p className="eyebrow">Giới thiệu</p>
          <h2>Về lớp chúng mình</h2>
          <p className="section-desc">
            Đây là trang thông tin chung của lớp 10A4, trường THPT Nguyễn Hữu Huân —
            nơi cả lớp cùng lưu giữ hình ảnh, theo dõi thông báo và tìm hiểu về giáo
            viên chủ nhiệm. Nội dung ở đây sẽ được cập nhật theo từng học kỳ.
          </p>
        </div>
      </section>

      {/* GIÁO VIÊN — nước biển vừa, ánh sáng còn chiếu tới */}
      <section id="giao-vien" className="zone zone--mid">
        <Bubbles count={4} className="bubbles--right" />
        <Fish style={{ top: '75%', left: '15%', width: 40, opacity: 0.4 }} />
        <div className="section-inner teacher">
          <div className="teacher-photo">
            <div className="photo-frame photo-frame--teacher">Ảnh cô Út</div>
          </div>
          <div className="teacher-info">
            <p className="eyebrow">Giáo viên chủ nhiệm</p>
            <h2>Cô Lê Thị Út</h2>
            <p className="section-desc">
              Cô Lê Thị Út là giáo viên chủ nhiệm của lớp 10A4, đồng hành cùng lớp
              trong các hoạt động học tập và phong trào của trường THPT Nguyễn Hữu
              Huân. Phần giới thiệu chi tiết hơn sẽ được bổ sung sau.
            </p>
          </div>
        </div>
      </section>

      {/* ẢNH LỚP — vùng nước sâu hơn, ánh sáng nhạt dần */}
      <section id="anh-lop" className="zone zone--deep">
        <Fish style={{ top: '12%', left: '6%', width: 36, opacity: 0.35 }} />
        <Fish style={{ top: '18%', left: '14%', width: 24, opacity: 0.3 }} />
        <Fish style={{ top: '85%', right: '8%', width: 38, opacity: 0.3 }} flip />
        <div className="section-inner">
          <p className="eyebrow">Kỷ niệm</p>
          <h2>Ảnh lớp</h2>
          <p className="section-desc">
            Những khoảnh khắc của lớp 10A4 sẽ được cập nhật tại đây.
          </p>
          <div className="gallery-grid">
            {Array.from({ length: PHOTO_PLACEHOLDER_COUNT }).map((_, i) => (
              <div className={`polaroid ${i % 2 === 0 ? 'tilt-left' : 'tilt-right'}`} key={i}>
                <div className="photo-frame">Ảnh lớp</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THÔNG BÁO — vùng biển sâu, tối, có sinh vật phát sáng */}
      <section id="thong-bao" className="zone zone--abyss">
        <Glow count={7} />
        <Jellyfish style={{ top: '8%', right: '12%', width: 44, opacity: 0.55 }} />
        <Anglerfish style={{ bottom: '10%', left: '6%', width: 90, opacity: 0.7 }} />
        <div className="section-inner">
          <p className="eyebrow">Bảng tin</p>
          <h2>Thông báo</h2>

          <form onSubmit={handleSubmit} className="announcement-form">
            <input
              type="text"
              placeholder="Tên người đăng (vd: Lớp trưởng, cô Út...)"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />
            <input
              type="text"
              placeholder="Tiêu đề thông báo..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Nội dung thông báo chi tiết..."
              rows="4"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'Đang đăng...' : 'Đăng thông báo'}
            </button>
          </form>

          <div className="announcement-list">
            <h3>Danh sách thông báo ({announcements.length})</h3>
            {announcements.length === 0 ? (
              <p className="empty-state">Chưa có thông báo nào.</p>
            ) : (
              announcements.map((item) => (
                <article className="announcement-card" key={item.id}>
                  <h4>{item.title}</h4>
                  <p>{item.content}</p>
                  <div className="announcement-meta">
                    <span>Người đăng: <strong>{item.sender}</strong></span>
                    <span>{new Date(item.created_at).toLocaleString('vi-VN')}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ĐÁY BIỂN — tối nhất */}
      <footer className="zone zone--floor footer">
        <Glow count={4} />
        <p>Lớp 10A4 · Trường THPT Nguyễn Hữu Huân</p>
      </footer>
    </div>
  )
}
