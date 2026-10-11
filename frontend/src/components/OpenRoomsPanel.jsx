import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, LogIn, RefreshCw, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ROUTES } from '../lib/routes.js'
import { roomPathForApiMode } from '../lib/gameModes.js'
import { joinRoom, listOpenRooms } from '../services/gameRoomService.js'
import { joinWordChainRoom } from '../services/wordChainService.js'

// Tự làm mới khi quay lại tab/cửa sổ, nhưng không dồn dập (cả lớp thường dùng chung 1 IP).
const MIN_AUTO_REFRESH_MS = 20_000

function timeAgo(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (!Number.isFinite(minutes)) return ''
  if (minutes < 1) return 'vừa tạo'
  if (minutes < 60) return `${minutes} phút trước`
  return `${Math.floor(minutes / 60)} giờ trước`
}

/** Danh sách phòng đang mở (ở sảnh) của một game, kèm nút vào phòng. */
export default function OpenRoomsPanel({ game, title }) {
  const navigate = useNavigate()
  const { authReady, isLoggedIn } = useAuth()
  const [rooms, setRooms] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState('')
  const lastLoad = useRef(0)
  const requestSeq = useRef(0)

  const load = useCallback(async ({ silent = false } = {}) => {
    const seq = ++requestSeq.current
    if (!silent) setLoading(true)
    try {
      const next = await listOpenRooms(game.id)
      if (seq !== requestSeq.current) return
      setRooms(next)
      setError('')
    } catch (loadError) {
      if (seq === requestSeq.current) setError(loadError?.message || 'Không thể tải danh sách phòng.')
    } finally {
      lastLoad.current = Date.now()
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [game.id])

  useEffect(() => {
    setRooms(null)
    setError('')
    if (!authReady || !isLoggedIn) return undefined
    void load()
    const refreshIfStale = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > MIN_AUTO_REFRESH_MS) void load({ silent: true })
    }
    document.addEventListener('visibilitychange', refreshIfStale)
    window.addEventListener('focus', refreshIfStale)
    return () => {
      requestSeq.current += 1
      document.removeEventListener('visibilitychange', refreshIfStale)
      window.removeEventListener('focus', refreshIfStale)
    }
  }, [authReady, isLoggedIn, load])

  const enter = async (room) => {
    setJoining(room.code)
    setError('')
    try {
      if (game.id === 'word-chain') {
        if (!room.is_host) await joinWordChainRoom(room.code)
        navigate(`${ROUTES.wordChainRoom}/${room.code}`)
      } else {
        if (!room.is_host) await joinRoom(room.code)
        navigate(`${roomPathForApiMode(game.apiMode)}/${room.code}`)
      }
    } catch (joinError) {
      setError(joinError?.message || 'Không thể vào phòng. Phòng có thể đã bắt đầu hoặc đã đầy.')
      setJoining('')
      void load({ silent: true })
    }
  }

  return (
    <section className="gc-section gc-rooms" aria-label={`Phòng đang mở của ${title}`}>
      <div className="gc-rooms-head">
        <h2>Phòng đang mở</h2>
        {isLoggedIn && (
          <button className="gc-refresh" type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} aria-hidden="true" className={loading ? 'gc-spin' : ''} /> Làm mới
          </button>
        )}
      </div>

      {authReady && !isLoggedIn && (
        <div className="gc-rooms-note"><Lock size={18} aria-hidden="true" /> <span>Đăng nhập để xem và vào các phòng đang mở.</span> <Link className="gc-secondary gc-small" to={ROUTES.login}><LogIn size={16} aria-hidden="true" /> Đăng nhập</Link></div>
      )}

      {isLoggedIn && error && <p className="gc-rooms-error" role="alert">{error}</p>}

      {isLoggedIn && rooms === null && !error && <p className="gc-rooms-note">Đang tải danh sách phòng…</p>}

      {isLoggedIn && rooms && !rooms.length && !error && (
        <p className="gc-rooms-note">Chưa có phòng nào đang chờ người chơi. Hãy nhờ host tạo phòng, hoặc dùng nút tạo phòng ở phía trên.</p>
      )}

      {isLoggedIn && rooms?.length > 0 && (
        <ul className="gc-room-list">
          {rooms.map((room) => (
            <li className="gc-room" key={room.code}>
              <div className="gc-room-main">
                <strong>{room.title}</strong>
                <span className="gc-room-meta">
                  {room.host_name ? `Host: ${room.host_name}` : 'Đang chờ người chơi'} · {timeAgo(room.created_at)}
                </span>
              </div>
              <span className="gc-room-count" title="Số người đã vào phòng">
                <Users size={15} aria-hidden="true" /> {room.max_players ? `${room.player_count}/${room.max_players}` : room.player_count}
                {room.team_count ? ` · ${room.team_count} đội` : ''}
              </span>
              <code className="gc-room-code">{room.code}</code>
              <button className="gc-play gc-small" type="button" onClick={() => void enter(room)} disabled={Boolean(joining) || room.full}>
                {room.full ? 'Đã đầy' : joining === room.code ? 'Đang vào…' : room.is_host ? 'Vào lại phòng' : 'Vào phòng'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
