import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader, { Brand } from '../components/SiteHeader.jsx'
import PetMascot from '../components/pet/PetMascot.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { EMPTY_OUTFIT, loadOutfit } from '../lib/petOutfit.js'
import { ROUTES } from '../lib/routes.js'
import { ArrowRight } from 'lucide-react'
import '../pet.css'

function FeatureIcon({ kind }) {
  if (kind === 'create') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  if (kind === 'play') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /></svg>
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.7 5.48 6.05.88-4.38 4.27 1.03 6.03L12 16.81l-5.4 2.85 1.03-6.03-4.38-4.27 6.05-.88L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
}

function RoomGuideModal({ onClose }) {
  return (
    <div className="guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="room-guide-title">
        <button className="guide-close" type="button" aria-label="Đóng hướng dẫn" onClick={onClose}>×</button>
        <p className="section-overline">Bắt đầu thật dễ</p>
        <h2 id="room-guide-title">Hướng dẫn tạo phòng</h2>
        <ol className="guide-list">
          <li>Nhấn <strong>“Create”</strong>.</li>
          <li>Chọn bộ câu hỏi muốn sử dụng.</li>
          <li>Chọn Game Mode.</li>
          <li>Thiết lập số đội, số người, độ dài đường đua và thời gian.</li>
          <li>Nhấn <strong>“Tạo phòng”</strong>.</li>
          <li>Chia sẻ mã phòng cho những người chơi khác.</li>
          <li>Người chơi nhập mã phòng hoặc mở link phòng để tham gia.</li>
        </ol>
        <button className="button button-primary guide-action" type="button" onClick={onClose}>Đã hiểu</button>
      </section>
    </div>
  )
}

function QuizPreview({ onOpenGuide }) {
  return (
    <div className="preview-wrap" aria-label="Minh họa giao diện quiz">
      <div className="preview-glow" />
      <button className="float-chip float-chip-create" type="button" onClick={onOpenGuide}><FeatureIcon kind="create" /> Hướng dẫn tạo phòng</button>
      <div className="preview-card">
        <div className="preview-top"><span className="preview-kicker">Bản xem trước</span><span className="preview-label"><span /> Đang hoạt động</span></div>
        <h2>Một câu hỏi thú vị</h2>
        <p className="preview-subtitle">Quiz tương tác · Chơi cùng bạn bè</p>
        <div className="preview-answer is-active"><span className="answer-key">A</span> Cùng học qua trò chơi</div>
        <div className="preview-answer"><span className="answer-key">B</span> Từng bước, thật vui</div>
        <div className="preview-answer"><span className="answer-key">C</span> Theo cách của bạn</div>
        <div className="preview-footer"><span>Quiz tương tác</span><span>Treasure Race</span></div>
      </div>
      <Link className="float-chip float-chip-play" to={ROUTES.play}><FeatureIcon kind="play" /> Chọn game mode</Link>
    </div>
  )
}

const features = [
  { kind: 'create', title: 'Create', description: 'Tự xây dựng những bộ câu hỏi của riêng bạn, theo cách thật đơn giản.' },
  { kind: 'play', title: 'Play', description: 'Chọn game mode và bắt đầu một cuộc đua quiz cùng bạn bè.' },
  { kind: 'compete', title: 'Compete', description: 'Thử thách bản thân và bạn bè trong những trải nghiệm cạnh tranh lành mạnh.' },
]

export default function HomePage() {
  const [guideOpen, setGuideOpen] = useState(false)
  const { session, authReady } = useAuth()
  const userId = session?.user?.id ?? null
  const requestId = useRef(0)
  const [petState, setPetState] = useState({ userId: null, outfit: { ...EMPTY_OUTFIT } })

  useEffect(() => {
    if (!authReady) return undefined
    const currentRequest = ++requestId.current
    let active = true

    if (!userId) {
      setPetState({ userId: null, outfit: { ...EMPTY_OUTFIT } })
      return () => { active = false }
    }

    void loadOutfit(userId).then((outfit) => {
      if (active && requestId.current === currentRequest) setPetState({ userId, outfit })
    }).catch((error) => {
      if (active && requestId.current === currentRequest) {
        console.error('[home] Không tải được trang phục:', error)
        setPetState({ userId, outfit: { ...EMPTY_OUTFIT } })
      }
    })

    return () => { active = false }
  }, [authReady, userId])

  const petOutfit = authReady && petState.userId === userId ? petState.outfit : EMPTY_OUTFIT

  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> Một cách học mới đang đến</div>
              <h1>Học nhanh hơn.<br /><span>Chơi vui hơn.</span></h1>
              <p className="hero-description">10A4-Quizz biến những câu hỏi hay thành trải nghiệm học tập vui, nhẹ nhàng và đáng nhớ.</p>
              <div className="hero-actions">
                <button className="button button-primary button-large" type="button" onClick={() => setGuideOpen(true)}>Hướng dẫn <ArrowRight className="ico" size={16} aria-hidden="true" /></button>
                <a className="button button-quiet button-large" href="#tinh-nang">Tìm hiểu thêm</a>
              </div>
              <p className="hero-note">MVP đầu tiên: Đua tới kho báu — tạo phòng và chơi cùng bạn bè.</p>
            </div>
            <QuizPreview onOpenGuide={() => setGuideOpen(true)} />
          </div>
        </section>
        <section className="section" id="tinh-nang">
          <div className="container">
            <div className="section-heading">
              <p className="section-overline">Nền móng cho điều thú vị</p>
              <h2>Học theo cách của bạn</h2>
              <p>Create để xây dựng phòng, Play để chọn game mode và bắt đầu cuộc chơi.</p>
            </div>
            <Link className="feature-card feature-card-link pet-card" to={ROUTES.pet}>
              <div className="pet-card-art"><PetMascot outfit={petOutfit} size={110} /></div>
              <div>
                <h3>Điều chỉnh giao diện của bạn</h3>
                <p>Nuôi linh vật ngọn lửa và thay cho bạn ấy những bộ trang phục thật xinh.</p>
                <span className="feature-cta">Tùy chỉnh ngay <ArrowRight className="ico" size={16} aria-hidden="true" /></span>
              </div>
            </Link>
            <div className="feature-grid">
              <Link className="feature-card feature-card-link" to={ROUTES.createRoom}>
                <div className="feature-icon"><FeatureIcon kind="create" /></div>
                <h3>{features[0].title}</h3>
                <p>{features[0].description}</p>
                <span className="feature-cta">Tạo phòng <ArrowRight className="ico" size={16} aria-hidden="true" /></span>
              </Link>
              <Link className="feature-card feature-card-link" to={ROUTES.play}>
                <div className="feature-icon"><FeatureIcon kind="play" /></div>
                <h3>{features[1].title}</h3>
                <p>{features[1].description}</p>
                <span className="feature-cta">Chọn game mode <ArrowRight className="ico" size={16} aria-hidden="true" /></span>
              </Link>
              <article className="feature-card feature-card-muted">
                <div className="feature-icon"><FeatureIcon kind="compete" /></div>
                <h3>{features[2].title}</h3>
                <p>{features[2].description}</p>
                <span className="status-pill">Sắp ra mắt</span>
              </article>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer"><div className="container footer-inner"><Brand /><span>10A4-Quizz · Đua tới kho báu đã sẵn sàng.</span></div></footer>
      {guideOpen && <RoomGuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  )
}
