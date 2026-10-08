import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { ROUTES } from '../lib/routes.js'
import { GAME_MODES } from '../lib/gameModes.js'
import { listGameModeImages } from '../services/gameModeImageService.js'
import { joinRoom } from '../services/gameRoomService.js'
import '../game.css'
import { ArrowRight, ChevronRight, Lock, Play, Plus } from 'lucide-react'

function JoinRoomModal({ onClose, description }) {
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
        <p className="join-modal-description">{description}</p>
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

function ModeCard({ mode, image, onJoin }) {
  const ModeIcon = mode.icon
  return (
    <article className="mode-card mode-card-active mode-card-with-image">
      <div className="mode-card-cover">
        {image
          ? <img src={image} alt={`Ảnh đại diện Game Mode: ${mode.title}`} loading="lazy" />
          : <div className="mode-card-cover-placeholder"><ModeIcon size={38} aria-hidden="true" /><span>Ảnh trò chơi</span></div>}
      </div>
      <div className="mode-icon"><ModeIcon size={38} aria-hidden="true" /></div>
      <div className="mode-card-topline"><span className="live-pill">{mode.status}</span><span className="mode-arrow" aria-hidden="true"><ArrowRight size={22} /></span></div>
      <h2>{mode.title}</h2>
      <p>{mode.description}</p>
      <div className="mode-preview"><span>{mode.previewLabel || 'PLAY'}</span><i /><i /><i /><b><ModeIcon size={26} aria-hidden="true" /></b></div>
      <div className="mode-actions">
        {mode.joinAction === 'passcode' && mode.joinLabel && (
          <button className="game-button primary" type="button" onClick={() => onJoin(mode)}><Play className="ico" size={16} aria-hidden="true" /> {mode.joinLabel}</button>
        )}
        {mode.joinPath && mode.joinLabel && (
          <Link className="game-button primary" to={mode.joinPath}><Play className="ico" size={16} aria-hidden="true" /> {mode.joinLabel}</Link>
        )}
        {mode.createPath && mode.createLabel !== null && (
          <Link className="game-button quiet" to={mode.createPath}><Plus className="ico" size={16} aria-hidden="true" /> {mode.createLabel || 'Tạo phòng mới'}</Link>
        )}
      </div>
    </article>
  )
}

export default function GameModePickerPage() {
  const [joinMode, setJoinMode] = useState(null)
  const [images, setImages] = useState({})

  useEffect(() => {
    let active = true
    listGameModeImages(GAME_MODES.map((mode) => mode.id))
      .then((rows) => {
        if (active) setImages(Object.fromEntries(rows.map((row) => [row.game_key, row.image_url])))
      })
      .catch((error) => console.warn('[GameModePicker] Could not load game images:', error?.message || error))
    return () => { active = false }
  }, [])

  return (
    <div className="game-shell">
      <SiteHeader />
      <main className="container game-main">
        <div className="game-breadcrumb">Play <ChevronRight className="ico" size={14} aria-hidden="true" /> Chọn Game Mode</div>
        <header className="game-heading">
          <p className="game-overline">Play</p>
          <h1>Chọn Game Mode</h1>
          <p>Chọn cách bạn muốn chơi cùng bộ câu hỏi của mình.</p>
        </header>
        <section className="mode-grid" aria-label="Danh sách game mode">
          {GAME_MODES.map((mode) => <ModeCard key={mode.id} mode={mode} image={images[mode.id]} onJoin={setJoinMode} />)}
          <article className="mode-card mode-card-locked">
            <div className="mode-icon"><Lock size={38} aria-hidden="true" /></div>
            <h2>Game mode mới</h2>
            <p>Các trải nghiệm chơi mới đang được chuẩn bị để bạn khám phá.</p>
            <span className="coming-pill">Sắp ra mắt</span>
          </article>
        </section>
      </main>
      {joinMode && <JoinRoomModal onClose={() => setJoinMode(null)} description={joinMode.joinDescription || `Nhập passcode để tham gia ${joinMode.title}.`} />}
    </div>
  )
}
