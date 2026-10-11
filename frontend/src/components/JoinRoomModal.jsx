import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomPathForApiMode } from '../lib/gameModes.js'
import { joinRoom } from '../services/gameRoomService.js'
import '../game.css'

export default function JoinRoomModal({ onClose, description }) {
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
      const roomPath = roomPathForApiMode(room.game_mode)
      navigate(`${roomPath}/${room.code || normalizedCode}`)
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
