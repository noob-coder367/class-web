import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as presentationService from '../../services/presentationService.js'
import {
  classTabPath,
  presentationCreatePath,
  presentationViewPath,
} from '../../lib/routes.js'
import PresentationEditor from './PresentationEditor.jsx'
import SlideStage from './SlideStage.jsx'
import './PresentationHome.css'

function Player({ item, onExit }) {
  const [index, setIndex] = useState(0)
  const slide = item.slides?.[index]
  const total = item.slides?.length || 1

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        setIndex((i) => Math.min(total - 1, i + 1))
      }
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (event.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen?.()
        else onExit?.()
      }
      if (event.key === 'f' || event.key === 'F') {
        document.documentElement.requestFullscreen?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, onExit])

  return (
    <div
      className="presentation-player"
      onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
    >
      <SlideStage slide={slide} className="presentation-player-slide" />
      <div className="presentation-player-controls">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setIndex((i) => Math.max(0, i - 1))
          }}
        >
          ←
        </button>
        <span>
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setIndex((i) => Math.min(total - 1, i + 1))
          }}
        >
          →
        </button>
      </div>
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
  const [submitting, setSubmitting] = useState(false)

  const create = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const { item } = await presentationService.createPresentation({
        title,
        description,
        visibility,
        password,
      })
      navigate(presentationCreatePath(item.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="presentation-page">
      <header className="presentation-header">
        <button type="button" onClick={() => navigate(classTabPath('presentation'))}>
          ← Thuyết trình
        </button>
        <div>
          <span>THUYẾT TRÌNH</span>
          <h1>Tạo bài thuyết trình</h1>
        </div>
      </header>
      <form className="presentation-create-form" onSubmit={create}>
        <label>
          Tên bài
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ví dụ: Ô nhiễm môi trường"
          />
        </label>
        <label>
          Mô tả
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn về bài"
          />
        </label>
        <label>
          Quyền riêng tư
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Công khai với thành viên lớp</option>
            <option value="private">Riêng tư (cần mật khẩu)</option>
          </select>
        </label>
        {visibility === 'private' ? (
          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={4}
              required
            />
          </label>
        ) : null}
        {error ? <p className="presentation-error">{error}</p> : null}
        <button className="presentation-primary" type="submit" disabled={submitting}>
          {submitting ? 'Đang tạo…' : 'Tạo bài và mở trình biên tập'}
        </button>
      </form>
    </div>
  )
}

function PasswordGate({ error, code, password, setPassword, onSubmit, onBack }) {
  const room = code === 'CLASS_SPACE_PASSWORD_REQUIRED'
  return (
    <div className="presentation-page presentation-page--gate">
      <header className="presentation-header">
        <button type="button" onClick={onBack}>
          ← Thuyết trình
        </button>
        <div>
          <span>THUYẾT TRÌNH</span>
          <h1>{room ? 'Phòng lớp riêng tư' : 'Bài riêng tư'}</h1>
          <p>
            {room
              ? 'Bài này được gắn với phòng lớp có mật khẩu. Hãy nhập mật khẩu phòng (6 số) theo cơ chế hiện tại.'
              : 'Nhập mật khẩu bài thuyết trình để xem.'}
          </p>
        </div>
      </header>
      <form
        className="presentation-create-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label>
          Mật khẩu
          <input
            type={room ? 'text' : 'password'}
            inputMode={room ? 'numeric' : undefined}
            value={password}
            onChange={(e) => setPassword(room ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value)}
            autoFocus
            required
            minLength={room ? 6 : 4}
            maxLength={room ? 6 : undefined}
            placeholder={room ? '••••••' : 'Mật khẩu bài'}
          />
        </label>
        {error ? <p className="presentation-error">{error}</p> : null}
        <button className="presentation-primary" type="submit">
          Mở bài
        </button>
      </form>
    </div>
  )
}

export default function PresentationHome({
  mode = 'list',
  presentationId = null,
  embedded = false,
}) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [password, setPassword] = useState('')
  const [gateCode, setGateCode] = useState('')
  const [loading, setLoading] = useState(mode === 'list' || mode === 'view' || mode === 'player')

  const goList = () => navigate(classTabPath('presentation'))

  useEffect(() => {
    let cancelled = false
    setError('')
    setGateCode('')
    setItem(null)

    const loadList = async () => {
      setLoading(true)
      try {
        const data = await presentationService.listPresentations()
        if (!cancelled) setItems(data.items || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const loadOne = async () => {
      setLoading(true)
      try {
        const data = await presentationService.getPresentation(presentationId)
        if (!cancelled) setItem(data.item)
      } catch (err) {
        if (cancelled) return
        if (err.code === 'PRESENTATION_PASSWORD_REQUIRED' || err.code === 'CLASS_SPACE_PASSWORD_REQUIRED') {
          setGateCode(err.code)
          setError(err.message)
        } else {
          setError(err.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (mode === 'list') loadList()
    else if (mode === 'view' || mode === 'player') loadOne()
    else setLoading(false)

    return () => {
      cancelled = true
    }
  }, [mode, presentationId])

  const submitUnlock = async () => {
    setError('')
    try {
      const data = await presentationService.unlockPresentation(presentationId, password)
      setItem(data.item)
      setGateCode('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (mode === 'editor') return <PresentationEditor presentationId={presentationId} />
  if (mode === 'create') return <CreatePresentation />

  if ((mode === 'view' || mode === 'player') && gateCode) {
    return (
      <PasswordGate
        error={error}
        code={gateCode}
        password={password}
        setPassword={setPassword}
        onSubmit={submitUnlock}
        onBack={goList}
      />
    )
  }

  if (mode === 'player' && item) {
    return <Player item={item} onExit={() => navigate(presentationViewPath(item.id))} />
  }

  if (mode === 'view' && item) {
    return (
      <div className="presentation-page">
        <header className="presentation-header">
          <button type="button" onClick={goList}>
            ← Thuyết trình
          </button>
          <div>
            <span>BÀI THUYẾT TRÌNH</span>
            <h1>{item.title}</h1>
          </div>
          <div className="presentation-header-actions">
            <button type="button" onClick={() => navigate(presentationViewPath(item.id, true))}>
              Trình chiếu
            </button>
            {item.canEdit ? (
              <button type="button" onClick={() => navigate(presentationCreatePath(item.id))}>
                Chỉnh sửa
              </button>
            ) : null}
          </div>
        </header>
        <Player item={item} onExit={goList} />
      </div>
    )
  }

  if ((mode === 'view' || mode === 'player') && loading) {
    return (
      <div className={`presentation-page${embedded ? ' is-embedded' : ''}`}>
        <p className="presentation-empty">Đang tải bài thuyết trình…</p>
      </div>
    )
  }

  if ((mode === 'view' || mode === 'player') && error) {
    return (
      <div className={`presentation-page${embedded ? ' is-embedded' : ''}`}>
        <header className="presentation-header">
          <button type="button" onClick={goList}>
            ← Thuyết trình
          </button>
          <div>
            <span>THUYẾT TRÌNH</span>
            <h1>Không mở được bài</h1>
          </div>
        </header>
        <p className="presentation-error">{error}</p>
      </div>
    )
  }

  const remove = async (entry) => {
    if (!entry?.canEdit) return
    if (!window.confirm(`Xóa bài "${entry.title}"? Hành động này không thể hoàn tác.`)) return
    try {
      await presentationService.deletePresentation(entry.id)
      setItems((prev) => prev.filter((row) => row.id !== entry.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={`presentation-page${embedded ? ' is-embedded' : ''}`}>
      <header className="presentation-header">
        {embedded ? null : (
          <button type="button" onClick={() => navigate('/')}>
            ← Trang chủ
          </button>
        )}
        <div>
          <span>CLASSROOM PRESENTATIONS</span>
          <h1>Thuyết trình</h1>
          <p>Tạo, chỉnh sửa và trình chiếu bài thuyết trình của lớp</p>
        </div>
        <button
          className="presentation-primary"
          type="button"
          onClick={() => navigate(presentationCreatePath())}
        >
          ＋ Tạo bài thuyết trình
        </button>
      </header>

      <div className="presentation-code-box">
        <strong>Vào bằng mã bài</strong>
        <input
          placeholder="Nhập mã bài 6 số"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
        />
        <button
          type="button"
          onClick={() => {
            if (codeInput.trim()) navigate(presentationViewPath(codeInput.trim()))
          }}
        >
          →
        </button>
      </div>

      {error ? <p className="presentation-error">{error}</p> : null}

      {loading ? <p className="presentation-empty">Đang tải danh sách…</p> : null}

      <div className="presentation-card-grid">
        {items.map((entry) => (
          <article className="presentation-card" key={entry.id}>
            <div className="presentation-card-cover">
              {entry.cover ? <img src={entry.cover} alt="" /> : <span>▧</span>}
            </div>
            <div className="presentation-card-body">
              <h2>{entry.title}</h2>
              <p>{entry.description || 'Chưa có mô tả'}</p>
              <small>
                Mã bài: {entry.code} · {entry.slideCount} slide
              </small>
              <small>Tác giả: {entry.ownerName}</small>
              {entry.linkedClassRoomTitle ? (
                <small>
                  Gắn phòng: {entry.linkedClassRoomTitle}
                  {entry.linkedClassRoomCode ? ` (${entry.linkedClassRoomCode})` : ''}
                </small>
              ) : (
                <small>{entry.visibility === 'private' ? 'Riêng tư' : 'Công khai'}</small>
              )}
              <div>
                <button type="button" onClick={() => navigate(presentationViewPath(entry.id))}>
                  Thuyết trình
                </button>
                {entry.canEdit ? (
                  <button type="button" onClick={() => navigate(presentationCreatePath(entry.id))}>
                    Chỉnh sửa
                  </button>
                ) : null}
                {entry.canEdit ? (
                  <button type="button" className="presentation-danger" onClick={() => remove(entry)}>
                    Xóa
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!items.length && !error && !loading ? (
        <div className="presentation-empty">Chưa có bài thuyết trình. Hãy tạo bài đầu tiên.</div>
      ) : null}
    </div>
  )
}
