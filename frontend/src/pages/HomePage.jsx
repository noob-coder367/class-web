import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Quizly, về trang chủ">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M7 4.5h10a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.8"/><path d="m8 12 2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
      <span>quizly</span>
    </Link>
  )
}

function FeatureIcon({ kind }) {
  if (kind === 'create') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  if (kind === 'play') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/></svg>
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.7 5.48 6.05.88-4.38 4.27 1.03 6.03L12 16.81l-5.4 2.85 1.03-6.03-4.38-4.27 6.05-.88L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
}

function QuizPreview() {
  return (
    <div className="preview-wrap" aria-label="Minh họa giao diện quiz, chưa phải tính năng hoạt động">
      <div className="preview-glow" />
      <div className="float-chip float-chip-create"><FeatureIcon kind="create" /> Tạo bộ câu hỏi</div>
      <div className="preview-card">
        <div className="preview-top"><span className="preview-kicker">Bản xem trước</span><span className="preview-label"><span /> Sắp ra mắt</span></div>
        <h2>Một câu hỏi thú vị</h2>
        <p className="preview-subtitle">Giao diện minh họa · Chưa thể chơi</p>
        <div className="preview-answer is-active"><span className="answer-key">A</span> Cùng học qua trò chơi</div>
        <div className="preview-answer"><span className="answer-key">B</span> Từng bước, thật vui</div>
        <div className="preview-answer"><span className="answer-key">C</span> Theo cách của bạn</div>
        <div className="preview-footer"><span>Quiz tương tác</span><span>Đang phát triển</span></div>
      </div>
      <div className="float-chip float-chip-play"><FeatureIcon kind="play" /> Chế độ chơi</div>
    </div>
  )
}

const features = [
  { kind: 'create', title: 'Create', description: 'Tự xây dựng những bộ câu hỏi của riêng bạn, theo cách thật đơn giản.' },
  { kind: 'play', title: 'Play', description: 'Biến việc ôn tập thành những lượt chơi ngắn gọn, vui và dễ tham gia.' },
  { kind: 'compete', title: 'Compete', description: 'Thử thách bản thân và bạn bè trong những trải nghiệm cạnh tranh lành mạnh.' },
]

export default function HomePage() {
  const { authReady, isLoggedIn, profile, logout } = useAuth()
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || ''

  return (
    <div className="site-shell">
      <header className="site-nav">
        <div className="container nav-inner">
          <Brand />
          <nav className="nav-actions" aria-label="Điều hướng tài khoản">
            {authReady && isLoggedIn ? (
              <>
                <span className="nav-user" title={displayName}>{displayName}</span>
                <button className="button button-quiet" type="button" onClick={() => void logout()}>Đăng xuất</button>
              </>
            ) : (
              <>
                <Link className="button button-quiet" to="/dang-nhap">Đăng nhập</Link>
                <Link className="button button-primary" to="/dang-ky">Đăng ký</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> Một cách học mới đang đến</div>
              <h1>Học nhanh hơn.<br /><span>Chơi vui hơn.</span></h1>
              <p className="hero-description">Quizly đang được xây dựng để biến những câu hỏi hay thành trải nghiệm học tập vui, nhẹ nhàng và đáng nhớ.</p>
              <div className="hero-actions">
                {isLoggedIn ? (
                  <a className="button button-primary button-large" href="#tinh-nang">Khám phá nền tảng <span aria-hidden="true">→</span></a>
                ) : (
                  <Link className="button button-primary button-large" to="/dang-ky">Bắt đầu <span aria-hidden="true">→</span></Link>
                )}
                <a className="button button-quiet button-large" href="#tinh-nang">Tìm hiểu thêm</a>
              </div>
              <p className="hero-note">Đây là nền tảng khởi đầu — các chế độ quiz và game chưa khả dụng.</p>
            </div>
            <QuizPreview />
          </div>
        </section>

        <section className="section" id="tinh-nang">
          <div className="container">
            <div className="section-heading">
              <p className="section-overline">Nền móng cho điều thú vị</p>
              <h2>Học theo cách của bạn</h2>
              <p>Chúng tôi đang chuẩn bị những công cụ để bạn tạo, chơi và chia sẻ. Các tính năng bên dưới hiện là định hướng tương lai, chưa thể sử dụng.</p>
            </div>
            <div className="feature-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.kind}>
                  <div className="feature-icon"><FeatureIcon kind={feature.kind} /></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <span className="status-pill">Sắp ra mắt · Chưa khả dụng</span>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner"><Brand /><span>Quizly · Đang xây dựng nền tảng.</span></div>
      </footer>
    </div>
  )
}
