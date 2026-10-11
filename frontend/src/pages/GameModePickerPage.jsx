import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Lock, Play, Search, Users } from 'lucide-react'
import SiteHeader from '../components/SiteHeader.jsx'
import { GAME_CATALOG, gameDetailPath } from '../lib/gameModes.js'
import { listGameModeImages } from '../services/gameModeImageService.js'
import '../game.css'
import '../game-catalog.css'

const FILTERS = Object.freeze([
  { id: 'all', label: 'Tất cả' },
  { id: 'room', label: 'Phòng online' },
  { id: 'solo', label: 'Chơi ngay' },
])

function GameTile({ game, content }) {
  const Icon = game.icon
  const title = content?.display_title || game.title
  const overlay = content?.overlay_content || ''
  return (
    <Link className="gc-tile" to={gameDetailPath(game.id)} aria-label={`Xem chi tiết ${title}`}>
      <div className="gc-thumb" style={{ '--gc-text': content?.text_color || '#FFFFFF' }}>
        {content?.image_url
          ? <img src={content.image_url} alt="" aria-hidden="true" loading="lazy" />
          : <div className="gc-thumb-empty"><Icon size={44} aria-hidden="true" /></div>}
        <span className="gc-badge">{game.status}</span>
        <div className="gc-thumb-hover" aria-hidden="true">
          <span className="gc-thumb-play"><Play size={20} /></span>
          {overlay && <p>{overlay}</p>}
        </div>
      </div>
      <h2 className="gc-tile-title">{title}</h2>
      <p className="gc-tile-meta"><Users size={14} aria-hidden="true" /> {game.teamsLabel} <span aria-hidden="true">·</span> {game.kindLabel}</p>
    </Link>
  )
}

export default function GameModePickerPage() {
  const [images, setImages] = useState({})
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let active = true
    listGameModeImages(GAME_CATALOG.map((game) => game.id))
      .then((rows) => { if (active) setImages(Object.fromEntries(rows.map((row) => [row.game_key, row]))) })
      .catch((error) => console.warn('[GameModePicker] Could not load game content:', error?.message || error))
    return () => { active = false }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return GAME_CATALOG.filter((game) => {
      if (filter !== 'all' && game.kind !== filter) return false
      if (!needle) return true
      const title = images[game.id]?.display_title || game.title
      return `${title} ${game.description}`.toLowerCase().includes(needle)
    })
  }, [filter, images, query])

  return (
    <div className="game-shell gc-page">
      <SiteHeader />
      <main className="container game-main">
        <div className="game-breadcrumb">Play <ChevronRight className="ico" size={14} aria-hidden="true" /> Chọn Game Mode</div>
        <header className="gc-heading">
          <div>
            <p className="game-overline">Play</p>
            <h1>Chọn trò chơi</h1>
            <p>Bấm vào một trò chơi để xem ảnh, thông tin chi tiết và cách vào chơi.</p>
          </div>
          <label className="gc-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" placeholder="Tìm trò chơi…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Tìm trò chơi" />
          </label>
        </header>
        <div className="gc-filters" role="tablist" aria-label="Lọc trò chơi">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={`gc-chip${filter === item.id ? ' active' : ''}`} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
        <section className="gc-grid" aria-label="Danh sách trò chơi">
          {visible.map((game) => <GameTile key={game.id} game={game} content={images[game.id]} />)}
          {filter === 'all' && !query.trim() && (
            <div className="gc-tile gc-tile-locked" aria-disabled="true">
              <div className="gc-thumb gc-thumb-locked"><Lock size={34} aria-hidden="true" /><span>Sắp ra mắt</span></div>
              <h2 className="gc-tile-title">Game mode mới</h2>
              <p className="gc-tile-meta">Đang được chuẩn bị</p>
            </div>
          )}
        </section>
        {!visible.length && <p className="gc-empty">Không tìm thấy trò chơi phù hợp.</p>}
      </main>
    </div>
  )
}
