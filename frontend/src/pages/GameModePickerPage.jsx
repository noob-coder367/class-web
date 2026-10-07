import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { ROUTES } from '../lib/routes.js'
import '../game.css'

export default function GameModePickerPage() {
  return (
    <div className="game-shell">
      <SiteHeader />
      <main className="container game-main">
        <div className="game-breadcrumb">Play <span>→</span> Chọn Game Mode</div>
        <header className="game-heading">
          <p className="game-overline">Play</p>
          <h1>Chọn Game Mode</h1>
          <p>Chọn cách bạn muốn chơi cùng bộ câu hỏi của mình.</p>
        </header>
        <section className="mode-grid" aria-label="Danh sách game mode">
          <Link className="mode-card mode-card-active mode-card-link" to={ROUTES.createRoom}>
            <div className="mode-icon">🏆</div>
            <div className="mode-card-topline"><span className="live-pill">Sẵn sàng</span><span className="mode-arrow" aria-hidden="true">→</span></div>
            <h2>Đua tới kho báu</h2>
            <p>Chia đội, trả lời câu hỏi và đua tới kho báu. Đội trả lời tốt sẽ tiến về phía trước nhanh hơn.</p>
            <div className="mode-preview"><span>START</span><i /><i /><i /><b>🏆</b></div>
            <span className="mode-select-label">Chọn game mode</span>
          </Link>
          <article className="mode-card mode-card-locked">
            <div className="mode-icon">🔒</div>
            <h2>Game mode mới</h2>
            <p>Các trải nghiệm chơi mới đang được chuẩn bị để bạn khám phá.</p>
            <span className="coming-pill">Sắp ra mắt</span>
          </article>
        </section>
      </main>
    </div>
  )
}
