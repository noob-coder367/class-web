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

      {/* HERO */}
      <section id="trang-chu" className="hero">
        <div className="hero-ticks" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i}>+</span>
          ))}
        </div>
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

      {/* GIỚI THIỆU */}
      <section id="gioi-thieu" className="section intro">
        <p className="eyebrow">Giới thiệu</p>
        <h2>Về lớp chúng mình</h2>
        <p className="section-desc">
          Đây là trang thông tin chung của lớp 10A67, trường THPT Nguyễn Hữu Huân —
          nơi cả lớp cùng lưu giữ hình ảnh, theo dõi thông báo và tìm hiểu về giáo
          viên chủ nhiệm. Nội dung ở đây sẽ được cập nhật theo từng học kỳ.
        </p>
      </section>

      {/* GIÁO VIÊN */}
      <section id="giao-vien" className="section teacher">
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
      </section>

      {/* ẢNH LỚP */}
      <section id="anh-lop" className="section gallery">
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
      </section>

      {/* THÔNG BÁO */}
      <section id="thong-bao" className="section announcements">
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
      </section>

      <footer className="footer">
        <p>Lớp 10A4 · Trường THPT Nguyễn Hữu Huân</p>
      </footer>
    </div>
  )
}
