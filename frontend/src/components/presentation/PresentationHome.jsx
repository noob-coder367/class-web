import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as presentationService from '../../services/presentationService.js'
import { presentationCreatePath, presentationListPath, presentationViewPath } from '../../lib/routes.js'
import PresentationEditor from './PresentationEditor.jsx'
import './PresentationHome.css'

function Player({ item }) {
  const [index, setIndex] = useState(0)
  const slide = item.slides[index]
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight' || event.key === ' ') setIndex((i) => Math.min(item.slides.length - 1, i + 1))
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (event.key === 'Escape' && document.fullscreenElement) document.exitFullscreen?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item.slides.length])
  return (
    <div className="presentation-player" onClick={() => setIndex((i) => Math.min(item.slides.length - 1, i + 1))}>
      <div className="presentation-player-slide" style={{ background: slide?.background?.value || '#fff' }}>
        {slide?.elements?.map((element) => (
          <div key={element.id} className={`presentation-element presentation-element--${element.type}`} style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`, transform: `rotate(${element.rotation || 0}deg)`, opacity: element.opacity, zIndex: element.zIndex, ...element.style }}>
            {element.type === 'text' ? element.text : element.type === 'image' && element.src ? <img src={element.src} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : null}
          </div>
        ))}
      </div>
      <div className="presentation-player-controls">← {index + 1} / {item.slides.length} →</div>
    </div>
  )
}

function CreatePresentation() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const create = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const { item } = await presentationService.createPresentation({ title, description, visibility, password })
      navigate(presentationCreatePath(item.id))
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <div className="presentation-page">
      <header className="presentation-header"><button type="button" onClick={() => navigate(presentationListPath())}>← Thuyết trình</button><div><span>THUYẾT TRÌNH</span><h1>Tạo bài thuyết trình</h1></div></header>
      <form className="presentation-create-form" onSubmit={create}>
        <label>Tên bài<input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ví dụ: Ô nhiễm môi trường" /></label>
        <label>Mô tả<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn về bài" /></label>
        <label>Quyền riêng tư<select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="public">Công khai</option><option value="private">Riêng tư</option></select></label>
        {visibility === 'private' ? <label>Mật khẩu<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={4} required /></label> : null}
        {error ? <p className="presentation-error">{error}</p> : null}
        <button className="presentation-primary" type="submit">Tạo bài và mở trình biên tập</button>
      </form>
    </div>
  )
}

export default function PresentationHome({ mode = 'list', presentationId = null, embedded = false }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const [lookup, setLookup] = useState('')
  const [privatePassword, setPrivatePassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [loading, setLoading] = useState(mode !== 'create' && mode !== 'editor')

  useEffect(() => {
    let cancelled = false
    if (mode === 'list') {
      setLoading(true)
      presentationService.listPresentations().then((data) => { if (!cancelled) setItems(data.items || []) }).catch((err) => { if (!cancelled) setError(err.message) }).finally(() => { if (!cancelled) setLoading(false) })
    }
    if (mode === 'view' || mode === 'player') {
      setLoading(true)
      presentationService.getPresentation(presentationId).then((data) => { if (!cancelled) setItem(data.item) }).catch((err) => { if (!cancelled) { setError(err.message); setNeedsPassword(err.status === 401) } }).finally(() => { if (!cancelled) setLoading(false) })
    }
    return () => { cancelled = true }
  }, [mode, presentationId])

  const loadByPassword = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await presentationService.getPresentation(presentationId, privatePassword)
      setItem(data.item)
      setNeedsPassword(false)
    } catch (err) {
      setError(err.message)
      setNeedsPassword(err.status === 401)
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'editor') return <PresentationEditor presentationId={presentationId} />
  if (mode === 'create') return <CreatePresentation />
  if (loading) return <div className={`presentation-page${embedded ? ' presentation-page--embedded' : ''}`}><div className="presentation-empty">Đang tải bài thuyết trình…</div></div>
  if (mode === 'player' && item) return <Player item={item} />
  if ((mode === 'view' || mode === 'player') && !item) {
    return <div className={`presentation-page${embedded ? ' presentation-page--embedded' : ''}`}><p className="presentation-error">{error || 'Không tải được bài thuyết trình.'}</p>{needsPassword ? <form className="presentation-code-box" onSubmit={loadByPassword}><strong>Nhập mật khẩu bài riêng tư</strong><input type="password" value={privatePassword} onChange={(e) => setPrivatePassword(e.target.value)} autoFocus /><button type="submit">Mở bài</button></form> : null}</div>
  }
  if (mode === 'view' && item) {
    return <div className={`presentation-page${embedded ? ' presentation-page--embedded' : ''}`}><header className="presentation-header"><button type="button" onClick={() => navigate(presentationListPath())}>← Thuyết trình</button><div><span>BÀI THUYẾT TRÌNH</span><h1>{item.title}</h1></div><div className="presentation-header-actions"><button type="button" onClick={() => navigate(presentationViewPath(item.id, true))}>Trình chiếu</button>{item.canEdit ? <button type="button" onClick={() => navigate(presentationCreatePath(item.id))}>Chỉnh sửa</button> : null}</div></header><Player item={item} /></div>
  }

  const openByCode = () => { if (lookup.trim()) navigate(presentationViewPath(lookup.trim())) }
  return <div className={`presentation-page${embedded ? ' presentation-page--embedded' : ''}`}>
    <header className="presentation-header"><button type="button" onClick={() => navigate(embedded ? '/vo-lop/thong-bao-chung' : '/')}>← {embedded ? 'Khu vực lớp' : 'Trang chủ'}</button><div><span>CLASSROOM PRESENTATIONS</span><h1>Thuyết trình</h1><p>Tạo, chỉnh sửa và trình chiếu bài thuyết trình</p></div><button className="presentation-primary" type="button" onClick={() => navigate(presentationCreatePath())}>＋ Tạo bài thuyết trình</button></header>
    <div className="presentation-code-box"><strong>Vào bằng mã bài</strong><input placeholder="Nhập mã bài 6 số" value={lookup} onChange={(e) => setLookup(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(e) => { if (e.key === 'Enter') openByCode() }} /><button type="button" onClick={openByCode}>→</button></div>
    {error ? <p className="presentation-error">{error}</p> : null}
    {loading ? <div className="presentation-empty">Đang tải…</div> : <div className="presentation-card-grid">{items.map((entry) => <article className="presentation-card" key={entry.id}><div className="presentation-card-cover">{entry.cover ? <img src={entry.cover} alt="" /> : <span>▧</span>}</div><div className="presentation-card-body"><h2>{entry.title}</h2><p>{entry.description || 'Chưa có mô tả'}</p><small>Mã bài: {entry.code} · {entry.slideCount} slide</small><small>Tác giả: {entry.ownerName}</small><div><button type="button" onClick={() => navigate(presentationViewPath(entry.id))}>Thuyết trình</button>{entry.canEdit ? <button type="button" onClick={() => navigate(presentationCreatePath(entry.id))}>Chỉnh sửa</button> : null}</div></div></article>)}</div>}
    {!items.length && !error && !loading ? <div className="presentation-empty">Chưa có bài thuyết trình. Hãy tạo bài đầu tiên.</div> : null}
  </div>
}
