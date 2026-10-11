import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Play, Plus, X } from 'lucide-react'
import SiteHeader from '../components/SiteHeader.jsx'
import JoinRoomModal from '../components/JoinRoomModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { GAME_CATALOG, gameCatalogById, gameCreateLink, gameDetailPath, roomPathForApiMode } from '../lib/gameModes.js'
import { ROUTES } from '../lib/routes.js'
import { listGameModeImages } from '../services/gameModeImageService.js'
import { joinRoom, listOpenGameRooms } from '../services/gameRoomService.js'
import { joinWordChainRoom, listOpenWordChainRooms } from '../services/wordChainService.js'
import '../game.css'
import '../game-catalog.css'

export default function GameDetailPage() {
  const { gameId } = useParams()
  const game = gameCatalogById(gameId)
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const [images, setImages] = useState({})
  const [activeSlide, setActiveSlide] = useState(0)
  const [joinOpen, setJoinOpen] = useState(false)
  const [openRooms, setOpenRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomsError, setRoomsError] = useState('')
  const [joiningRoom, setJoiningRoom] = useState('')

  useEffect(() => {
    let active = true
    listGameModeImages(GAME_CATALOG.map((item) => item.id))
      .then((rows) => { if (active) setImages(Object.fromEntries(rows.map((row) => [row.game_key, row]))) })
      .catch((error) => console.warn('[GameDetail] Could not load game content:', error?.message || error))
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    if (!game) return () => { active = false }
    const loadRooms = async () => {
      try {
        const rooms = game.id === 'word-chain'
          ? await listOpenWordChainRooms()
          : game.apiMode ? await listOpenGameRooms(game.apiMode) : []
        if (active) { setOpenRooms(rooms); setRoomsError('') }
      } catch (error) {
        if (active) setRoomsError(error?.message || 'Không thể tải danh sách phòng đang mở.')
      } finally {
        if (active) setRoomsLoading(false)
      }
    }
    void loadRooms()
    const timer = window.setInterval(loadRooms, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [game])

  useEffect(() => { setActiveSlide(0) }, [gameId])

  const content = game ? images[game.id] : null
  const slides = useMemo(() => {
    const list = []
    if (content?.image_url) list.push({ url: content.image_url, label: 'Ảnh bìa' })
    for (const [index, item] of (content?.gallery || []).entries()) list.push({ url: item.url, label: `Ảnh giới thiệu ${index + 1}` })
    return list
  }, [content])

  if (!game) return <Navigate to={ROUTES.play} replace />

  const Icon = game.icon
  const title = content?.display_title || game.title
  const about = content?.detail_description || content?.overlay_content || game.description
  const createLink = game.createLabel !== null ? gameCreateLink(game) : null
  const current = slides[Math.min(activeSlide, Math.max(slides.length - 1, 0))]
  const others = GAME_CATALOG.filter((item) => item.id !== game.id)
  const goTo = (delta) => setActiveSlide((value) => (value + delta + slides.length) % slides.length)
  const enterRoom = async (room) => {
    if (!isLoggedIn) {
      navigate(ROUTES.login, { state: { from: { pathname: location.pathname } } })
      return
    }
    setJoiningRoom(room.code); setRoomsError('')
    try {
      if (game.id === 'word-chain') {
        await joinWordChainRoom(room.code)
        navigate(`${ROUTES.wordChainRoom}/${room.code}`)
      } else {
        const joined = await joinRoom(room.code)
        navigate(`${roomPathForApiMode(joined.game_mode)}/${joined.code || room.code}`)
      }
    } catch (error) {
      setRoomsError(error?.message || 'Không thể tham gia phòng này. Có thể phòng đã bắt đầu hoặc đã đầy.')
    } finally {
      setJoiningRoom('')
    }
  }

  return (
    <div className="game-shell gc-page">
      <SiteHeader />
      <div className="gc-hero">
        {content?.image_url && <img className="gc-hero-bg" src={content.image_url} alt="" aria-hidden="true" />}
        <div className="gc-hero-fade" />
        <Link className="gc-close" to={ROUTES.play} aria-label="Quay lại danh sách trò chơi"><X size={22} /></Link>
      </div>
      <main className="container gc-detail">
        <header className="gc-detail-head">
          <div className="gc-detail-thumb" style={{ '--gc-text': content?.text_color || '#FFFFFF' }}>
            {content?.image_url ? <img src={content.image_url} alt={title} /> : <Icon size={64} aria-hidden="true" />}
          </div>
          <div className="gc-detail-info">
            <h1>{title}</h1>
            <p className="gc-detail-sub">{game.kindLabel} · {game.teamsLabel}</p>
            <div className="gc-detail-actions">
              {game.joinAction === 'passcode' && game.joinLabel && (
                <button className="gc-play" type="button" onClick={() => setJoinOpen(true)}><Play size={20} aria-hidden="true" /> {game.joinLabel}</button>
              )}
              {game.joinPath && game.joinLabel && (
                <Link className="gc-play" to={game.joinPath}><Play size={20} aria-hidden="true" /> {game.joinLabel}</Link>
              )}
              {createLink && (
                <Link className="gc-secondary" to={createLink}><Plus size={18} aria-hidden="true" /> {game.createLabel || 'Tạo phòng mới'}</Link>
              )}
            </div>
          </div>
        </header>

        <div className="gc-chips">
          <span className="gc-chip static">{game.status}</span>
          {game.facts.slice(1, 3).map(([label, value]) => <span className="gc-chip static" key={label}>{label}: {value}</span>)}
        </div>

        <section className="gc-gallery" aria-label="Ảnh trò chơi">
          <div className="gc-gallery-main">
            {current
              ? <img src={current.url} alt={`${title} — ${current.label}`} />
              : <div className="gc-gallery-empty"><Icon size={56} aria-hidden="true" /><span>Chưa có ảnh giới thiệu</span></div>}
            {slides.length > 1 && <>
              <button className="gc-gallery-nav prev" type="button" onClick={() => goTo(-1)} aria-label="Ảnh trước"><ChevronLeft size={22} /></button>
              <button className="gc-gallery-nav next" type="button" onClick={() => goTo(1)} aria-label="Ảnh sau"><ChevronRight size={22} /></button>
            </>}
          </div>
          {slides.length > 1 && (
            <div className="gc-gallery-thumbs">
              {slides.map((slide, index) => (
                <button key={slide.url} type="button" className={index === Math.min(activeSlide, slides.length - 1) ? 'active' : ''} onClick={() => setActiveSlide(index)} aria-label={slide.label}>
                  <img src={slide.url} alt="" aria-hidden="true" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="gc-section">
          <h2>Giới thiệu</h2>
          <p className="gc-about">{about}</p>
        </section>

        <section className="gc-section">
          <h2>Thông tin chi tiết</h2>
          <dl className="gc-facts">
            {game.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>

        <section className="gc-section gc-open-rooms" aria-labelledby="gc-open-rooms-title">
          <div className="gc-open-rooms-heading"><div><h2 id="gc-open-rooms-title">Phòng đang mở</h2><p>Phòng đang chờ người chơi · danh sách tự cập nhật mỗi 15 giây</p></div><span className="gc-open-rooms-count">{openRooms.length} phòng</span></div>
          {roomsError && <p className="gc-rooms-error" role="alert">{roomsError}</p>}
          {roomsLoading ? <p className="gc-rooms-empty" role="status">Đang tìm phòng chờ…</p>
            : game.kind === 'solo' && game.id !== 'word-chain' ? <p className="gc-rooms-empty">Trò chơi này chơi trực tiếp, không sử dụng phòng online.</p>
              : openRooms.length === 0 ? <p className="gc-rooms-empty">Chưa có phòng nào đang mở. {createLink ? 'Bạn có thể tạo phòng mới.' : 'Bạn có thể mở chế độ chơi từ nút phía trên.'}</p>
                : <div className="gc-open-room-list">{openRooms.map((room) => <article className="gc-open-room" key={room.code}>
                  <div className="gc-open-room-info"><strong>{room.title || title}</strong><span>Mã {room.code} · {room.player_count || 0} người đã vào{room.total_turns ? ` · ${room.total_turns} lượt` : ''}</span></div>
                  <button className="gc-room-join" type="button" onClick={() => void enterRoom(room)} disabled={Boolean(joiningRoom)}>{joiningRoom === room.code ? 'Đang vào…' : 'Vào phòng'}</button>
                </article>)}</div>}
        </section>

        <section className="gc-section">
          <h2>Trò chơi khác</h2>
          <div className="gc-others">
            {others.map((item) => {
              const OtherIcon = item.icon
              const other = images[item.id]
              return (
                <Link className="gc-other" key={item.id} to={gameDetailPath(item.id)}>
                  <span className="gc-other-thumb">{other?.image_url ? <img src={other.image_url} alt="" aria-hidden="true" loading="lazy" /> : <OtherIcon size={26} aria-hidden="true" />}</span>
                  <span>{other?.display_title || item.title}</span>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
      {joinOpen && <JoinRoomModal onClose={() => setJoinOpen(false)} description={game.joinDescription || `Nhập passcode để tham gia ${title}.`} />}
    </div>
  )
}
