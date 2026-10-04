import { useCallback, useEffect, useMemo, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isAdminRole } from '../lib/roles.js'
import './FeedbackBoard.css'

const MAX_LEN = 1000

function timeAgo(iso) {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Vừa xong'
  if (min < 60) return `${min} phút trước`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} giờ trước`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

function Avatar({ name }) {
  const parts = String(name || '?').trim().split(/\s+/)
  return <span className="fb-avatar" aria-hidden="true">{(parts[parts.length - 1] || '?').charAt(0).toUpperCase()}</span>
}

function Composer({ placeholder, submitLabel, autoFocus, onSubmit, onCancel }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    const content = text.trim()
    if (!content || busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(content)
      setText('')
    } catch (err) {
      setError(err.message || 'Không gửi được. Thử lại nhé.')
    } finally { setBusy(false) }
  }
  return (
    <div className="fb-composer">
      <textarea
        value={text}
        maxLength={MAX_LEN}
        rows={2}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
      />
      {error ? <p className="fb-error">{error}</p> : null}
      <div className="fb-composer-actions">
        <span className="fb-count">{text.length}/{MAX_LEN}</span>
        {onCancel ? <button type="button" className="fb-btn fb-btn--ghost" onClick={onCancel}>Hủy</button> : null}
        <button type="button" className="fb-btn fb-btn--primary" onClick={send} disabled={busy || !text.trim()}>{busy ? 'Đang gửi...' : submitLabel}</button>
      </div>
    </div>
  )
}

function Comment({ item, canDelete, replying, onLike, onReply, onToggleReply, onDelete, isReply }) {
  return (
    <div className={`fb-item${isReply ? ' fb-item--reply' : ''}`}>
      <Avatar name={item.authorName} />
      <div className="fb-bubble-wrap">
        <div className="fb-bubble">
          <div className="fb-head"><strong>{item.authorName}</strong><span>{timeAgo(item.createdAt)}</span></div>
          <p className="fb-content">{item.content}</p>
        </div>
        <div className="fb-actions">
          <button type="button" className={`fb-act${item.liked ? ' is-liked' : ''}`} onClick={() => onLike(item)} aria-pressed={item.liked}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill={item.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-4.4-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12C19 16.6 12 21 12 21z" /></svg>
            Thích{item.likes > 0 ? ` · ${item.likes}` : ''}
          </button>
          <button type="button" className="fb-act" onClick={() => onToggleReply(item)}>Trả lời</button>
          {canDelete ? <button type="button" className="fb-act fb-act--del" onClick={() => onDelete(item)}>Xóa</button> : null}
        </div>
        {replying ? (
          <Composer
            autoFocus
            placeholder={`Trả lời ${item.authorName}...`}
            submitLabel="Gửi"
            onCancel={() => onToggleReply(item)}
            onSubmit={(content) => onReply(item, content)}
          />
        ) : null}
      </div>
    </div>
  )
}

export default function FeedbackBoard() {
  const { profile } = useAuth()
  const isAdmin = isAdminRole(profile?.role)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [replyingId, setReplyingId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await classroomService.getFeedback()
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (err) {
      setError(err.message || 'Không tải được phản hồi.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const { roots, repliesOf } = useMemo(() => {
    const map = new Map()
    const top = []
    items.forEach((it) => {
      if (it.parentId) {
        if (!map.has(it.parentId)) map.set(it.parentId, [])
        map.get(it.parentId).push(it)
      } else top.push(it)
    })
    map.forEach((list) => list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))
    return { roots: top, repliesOf: map }
  }, [items])

  const post = async (content, parentId = null) => {
    const data = await classroomService.createFeedback({ content, parentId })
    if (data?.item) setItems((list) => [data.item, ...list])
  }

  const like = async (item) => {
    const before = { liked: item.liked, likes: item.likes }
    const patch = (liked, likes) => setItems((list) => list.map((x) => (x.id === item.id ? { ...x, liked, likes } : x)))
    patch(!item.liked, Math.max(0, item.likes + (item.liked ? -1 : 1)))
    try {
      const res = await classroomService.toggleFeedbackLike(item.id)
      patch(!!res?.liked, Number(res?.likes) || 0)
    } catch {
      patch(before.liked, before.likes)
    }
  }

  const remove = async (item) => {
    if (!window.confirm('Xóa phản hồi này? Các trả lời bên dưới cũng sẽ bị xóa.')) return
    try {
      await classroomService.deleteFeedback(item.id)
      setItems((list) => list.filter((x) => x.id !== item.id && x.parentId !== item.id))
    } catch (err) {
      window.alert(err.message || 'Không xóa được.')
    }
  }

  const common = (item, isReply) => ({
    item,
    isReply,
    canDelete: isAdmin || item.userId === profile?.id,
    replying: replyingId === item.id,
    onLike: like,
    onDelete: remove,
    onToggleReply: (it) => setReplyingId((cur) => (cur === it.id ? null : it.id)),
    onReply: async (it, content) => { await post(content, it.id); setReplyingId(null) },
  })

  return (
    <div className="fb-page">
      <header className="fb-banner">
        <h2>Phản hồi</h2>
        <p>Góp ý, hỏi đáp và trao đổi cùng cả lớp 10A4.</p>
      </header>

      <Composer placeholder="Viết phản hồi của bạn..." submitLabel="Đăng" onSubmit={(content) => post(content)} />

      {loading ? <p className="fb-state">Đang tải...</p>
        : error ? <p className="fb-state fb-state--err">{error}</p>
        : roots.length === 0 ? <p className="fb-state">Chưa có phản hồi nào. Hãy là người đầu tiên!</p>
        : (
          <div className="fb-list">
            {roots.map((root) => (
              <div key={root.id} className="fb-thread">
                <Comment {...common(root, false)} />
                {(repliesOf.get(root.id) || []).map((reply) => (
                  <Comment key={reply.id} {...common(reply, true)} />
                ))}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
