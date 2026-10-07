import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { ROUTES } from '../lib/routes.js'
import { joinRoom } from '../services/gameRoomService.js'
import '../game.css'

function JoinRoomModal({ onClose }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [state, setState] = useState({ loading: false, error: '' })

  const submit = async (event) => {
    event.preventDefault()
    const normalizedCode = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      setState({ loading: false, error: 'Passcode phải gồm 6 ký tự.' })
      return
    }
    setState({ loading: true, error: '' })
    try {
      const room = await joinRoom(normalizedCode)
      navigate(`${ROUTES.room}/${room.code || normalizedCode}`)
    } catch (error) {
      setState({ loading: false, error: error.message || 'Không thể vào phòng. Hãy kiểm tra lại passcode.' })
    }
  }

  return (
    <div className="join-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="join-modal" role="dialog" aria-modal="true" aria-labelledby="join-room-title">
        <button className="join-modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        <p className="game-overline">Vào phòng chơi</p>
        <h2 id="join-room-title">Nhập passcode</h2>
        <p className="join-modal-description">Nhập mã phòng 6 ký tự do host chia sẻ để tham gia Đua tới kho báu.</p>
        <form onSubmit={submit}>
          <label className="join-code-label" htmlFor="join-room-code">Passcode phòng</label>
          <input
            id="join-room-code"
            className="join-code-input"
            value={code}
            onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setState({ loading: false, error: '' }) }}
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={6}
            autoFocus
          />
          {state.error && <p className="join-error" role="alert">{state.error}</p>}
          <div className="join-modal-actions">
            <button className="game-button quiet" type="button" onClick={onClose}>Đóng</button>
            <button className="game-button primary" type="submit" disabled={state.loading || code.length !== 6}>{state.loading ? 'Đang vào phòng...' : 'Xác nhận / Vào phòng'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default function GameModePickerPage() {
  const [joinOpen, setJoinOpen] = useState(false)
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
          <article className="mode-card mode-card-active">
            <div className="mode-icon">🏆</div>
            <div className="mode-card-topline"><span className="live-pill">Sẵn sàng</span><span className="mode-arrow" aria-hidden="true">→</span></div>
            <h2>Đua tới kho báu</h2>
            <p>Chia đội, trả lời câu hỏi và đua tới kho báu. Đội trả lời tốt sẽ tiến về phía trước nhanh hơn.</p>
            <div className="mode-preview"><span>START</span><i /><i /><i /><b>🏆</b></div>
            <div className="mode-actions">
              <button className="game-button primary" type="button" onClick={() => setJoinOpen(true)}>▶ Vào phòng bằng passcode</button>
              <Link className="game-button quiet" to={ROUTES.createRoom}>+ Tạo phòng mới</Link>
            </div>
          </article>
          <article className="mode-card mode-card-locked">
            <div className="mode-icon">🔒</div>
            <h2>Game mode mới</h2>
            <p>Các trải nghiệm chơi mới đang được chuẩn bị để bạn khám phá.</p>
            <span className="coming-pill">Sắp ra mắt</span>
          </article>
        </section>
      </main>
      {joinOpen && <JoinRoomModal onClose={() => setJoinOpen(false)} />}
    </div>
  )
}
