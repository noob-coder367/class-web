import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as classroomService from '../services/classroomService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { isAdminRole } from '../lib/roles.js'
import { classTabPath } from '../lib/routes.js'
import './ClassMembersPage.css'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const PHOTO_SIZE = 320

function newId() {
  try { return crypto.randomUUID() } catch { return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` }
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return (parts[parts.length - 1] || '?').charAt(0).toUpperCase()
}

/** Nén ảnh: cắt vuông giữa, thu về 320x320, JPEG ~0.82 (còn vài chục KB). */
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight)
        const sx = (img.naturalWidth - side) / 2
        const sy = (img.naturalHeight - side) / 2
        const canvas = document.createElement('canvas')
        canvas.width = PHOTO_SIZE
        canvas.height = PHOTO_SIZE
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE)
        ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch (err) { reject(err) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh này.')) }
    img.src = url
  })
}

function buildChildren(nodes) {
  const map = new Map()
  nodes.forEach((n) => {
    const key = n.parentId || ''
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(n)
  })
  return map
}

function flatten(nodes) {
  const map = buildChildren(nodes)
  const out = []
  const walk = (parentKey, depth) => {
    ;(map.get(parentKey) || []).forEach((n) => { out.push({ node: n, depth }); walk(n.id, depth + 1) })
  }
  walk('', 0)
  return out
}

function isDescendant(nodes, ancestorId, id) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let cur = byId.get(id)
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true
    cur = byId.get(cur.parentId)
  }
  return false
}

function moveNode(nodes, dragId, targetId, zone) {
  if (dragId === targetId || isDescendant(nodes, dragId, targetId)) return nodes
  const drag = nodes.find((n) => n.id === dragId)
  const target = nodes.find((n) => n.id === targetId)
  if (!drag || !target) return nodes
  const rest = nodes.filter((n) => n.id !== dragId)
  if (zone === 'child') return [...rest, { ...drag, parentId: targetId }]
  const idx = rest.findIndex((n) => n.id === targetId)
  const moved = { ...drag, parentId: target.parentId || null }
  rest.splice(zone === 'before' ? idx : idx + 1, 0, moved)
  return rest
}

function Hex({ node, className = '' }) {
  return (
    <span className={className}>
      {node.photo ? <img src={node.photo} alt="" /> : initials(node.name)}
    </span>
  )
}

function TreeBranch({ list, map }) {
  return (
    <ul>
      {list.map((n) => {
        const kids = map.get(n.id) || []
        return (
          <li key={n.id}>
            <div className="cm-member">
              <span className={`cm-role${n.role ? '' : ' cm-role--empty'}`}>{n.role || '.'}</span>
              <div className="cm-hex"><Hex node={n} className="cm-hex-in" /></div>
              <span className="cm-name">{n.name}</span>
            </div>
            {kids.length ? <TreeBranch list={kids} map={map} /> : null}
          </li>
        )
      })}
    </ul>
  )
}

const PAN_MARGIN = 90 // cho kéo lố ra ngoài tối đa ngần này px, không đi quá xa
const PAN_TOP_SPACE = 76 // chừa chỗ cho nút Thoát

/** Vùng cây kéo/vuốt tự do mọi hướng (chéo cũng được), có giới hạn biên. */
function PanArea({ children }) {
  const viewRef = useRef(null)
  const canvasRef = useRef(null)
  const pos = useRef({ x: 0, y: 0 })
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)

  const clamp = useCallback((x, y) => {
    const view = viewRef.current
    const canvas = canvasRef.current
    if (!view || !canvas) return { x, y }
    const vw = view.clientWidth
    const vh = view.clientHeight
    const cw = canvas.offsetWidth
    const ch = canvas.offsetHeight + PAN_TOP_SPACE
    const range = (v, c) => {
      if (c <= v) { const mid = (v - c) / 2; return [mid - PAN_MARGIN, mid + PAN_MARGIN] }
      return [v - c - PAN_MARGIN, PAN_MARGIN]
    }
    const [minX, maxX] = range(vw, cw)
    const [minY, maxY] = range(vh, ch)
    return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) }
  }, [])

  const apply = useCallback((x, y) => {
    const next = clamp(x, y)
    pos.current = next
    if (canvasRef.current) canvasRef.current.style.transform = `translate3d(${next.x}px, ${next.y + PAN_TOP_SPACE}px, 0)`
  }, [clamp])

  // Căn giữa theo chiều ngang lúc đầu & khi đổi kích thước.
  useEffect(() => {
    const center = () => {
      const view = viewRef.current
      const canvas = canvasRef.current
      if (!view || !canvas) return
      apply((view.clientWidth - canvas.offsetWidth) / 2, 0)
    }
    center()
    const onResize = () => apply(pos.current.x, pos.current.y)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [apply])

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: pos.current.x, oy: pos.current.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    apply(d.ox + (e.clientX - d.sx), d.oy + (e.clientY - d.sy))
  }
  const onPointerEnd = (e) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    setDragging(false)
  }
  const onWheel = (e) => apply(pos.current.x - e.deltaX, pos.current.y - e.deltaY)

  return (
    <div
      ref={viewRef}
      className={`cm-viewport${dragging ? ' is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={onWheel}
    >
      <div ref={canvasRef} className="cm-canvas">{children}</div>
    </div>
  )
}

const EMPTY_FORM = { name: '', role: '', photo: '' }

function EditorModal({ initial, onCancel, onSaved }) {
  const [draft, setDraft] = useState(initial)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drag, setDrag] = useState(null) // { id, targetId, zone }
  const dragRef = useRef(null)
  const rows = useMemo(() => flatten(draft), [draft])

  const pickPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) { setError('Hãy chọn một file ảnh.'); return }
    if (file.size > MAX_PHOTO_BYTES) { setError('Ảnh tối đa 10MB.'); return }
    setBusy(true)
    try {
      const photo = await compressPhoto(file)
      setForm((f) => ({ ...f, photo }))
    } catch (err) {
      setError(err.message || 'Không xử lý được ảnh.')
    } finally { setBusy(false) }
  }

  const submitForm = () => {
    const name = form.name.trim()
    if (!name) { setError('Nhập họ và tên.'); return }
    setError('')
    if (editingId) {
      setDraft((d) => d.map((n) => (n.id === editingId ? { ...n, name, role: form.role.trim(), photo: form.photo } : n)))
    } else {
      setDraft((d) => [...d, { id: newId(), name, role: form.role.trim(), photo: form.photo, parentId: null }])
    }
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const startEdit = (n) => {
    setEditingId(n.id)
    setForm({ name: n.name, role: n.role || '', photo: n.photo || '' })
    setError('')
  }

  const removeNode = (n) => {
    if (!window.confirm(`Xóa "${n.name}" khỏi cây? Những người con sẽ được chuyển lên cấp trên.`)) return
    setDraft((d) => d.filter((x) => x.id !== n.id).map((x) => (x.parentId === n.id ? { ...x, parentId: n.parentId || null } : x)))
    if (editingId === n.id) { setEditingId(null); setForm(EMPTY_FORM) }
  }

  // Kéo thả bằng pointer events (chạy được cả trên điện thoại).
  const onGripDown = (event, id) => {
    event.preventDefault()
    const state = { id, targetId: null, zone: null }
    dragRef.current = state
    setDrag({ ...state })
    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-node-id]')
      if (!el || el.dataset.nodeId === id) {
        state.targetId = null; state.zone = null
      } else {
        const rect = el.getBoundingClientRect()
        const ratio = (e.clientY - rect.top) / rect.height
        state.targetId = el.dataset.nodeId
        state.zone = ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'child'
      }
      setDrag({ ...state })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (state.targetId && state.zone) setDraft((d) => moveNode(d, state.id, state.targetId, state.zone))
      dragRef.current = null
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await classroomService.saveOrgChart(draft)
      onSaved(data?.orgChart?.nodes || draft)
    } catch (err) {
      setError(err.message || 'Không lưu được. Thử lại nhé.')
    } finally { setSaving(false) }
  }

  return (
    <div className="cm-backdrop" role="dialog" aria-modal="true" aria-label="Điều chỉnh cây thành viên">
      <div className="cm-modal">
        <div className="cm-modal-head">
          <h3>Điều chỉnh cây thành viên</h3>
          <button type="button" className="cm-x" onClick={onCancel} aria-label="Đóng">✕</button>
        </div>
        <div className="cm-modal-body">
          <div className="cm-form">
            <input type="text" placeholder="Họ và tên" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input type="text" placeholder="Chức vụ (vd: Lớp trưởng)" maxLength={80} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <div className="cm-photo-row">
              <span className="cm-photo-thumb">{form.photo ? <img src={form.photo} alt="" /> : null}</span>
              <label className="cm-file-btn">
                {busy ? 'Đang nén ảnh...' : form.photo ? 'Đổi ảnh' : 'Chọn ảnh (≤ 10MB)'}
                <input type="file" accept="image/*" onChange={pickPhoto} disabled={busy} />
              </label>
              {form.photo ? <button type="button" className="cm-link" onClick={() => setForm({ ...form, photo: '' })}>Bỏ ảnh</button> : null}
            </div>
            <div className="cm-form-actions">
              {editingId ? <button type="button" className="cm-btn cm-btn--ghost" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>Hủy sửa</button> : null}
              <button type="button" className="cm-btn cm-btn--primary" onClick={submitForm} disabled={busy}>{editingId ? 'Cập nhật' : 'Tạo'}</button>
            </div>
          </div>

          {error ? <p className="cm-err">{error}</p> : null}

          <p className="cm-hint">Giữ và kéo ⋮⋮ để sắp xếp: thả vào giữa một người để thành con của người đó, thả vào mép trên/dưới để cùng cấp.</p>
          <div className="cm-list">
            {rows.length === 0 ? <p className="cm-hint">Chưa có ai. Thêm thành viên ở trên.</p> : null}
            {rows.map(({ node, depth }) => {
              const cls = ['cm-row']
              if (drag?.id === node.id) cls.push('is-dragging')
              if (drag?.targetId === node.id && drag.zone) cls.push(`drop-${drag.zone}`)
              return (
                <div key={node.id} data-node-id={node.id} className={cls.join(' ')} style={{ marginLeft: Math.min(depth, 6) * 18 }}>
                  <span className="cm-grip" onPointerDown={(e) => onGripDown(e, node.id)} aria-label="Kéo để di chuyển" />
                  <Hex node={node} className="cm-row-hex" />
                  <span className="cm-row-text">
                    <strong>{node.name}</strong>
                    <span>{node.role || 'Chưa có chức vụ'}</span>
                  </span>
                  <button type="button" className="cm-row-btn" onClick={() => startEdit(node)}>Sửa</button>
                  <button type="button" className="cm-row-btn cm-row-btn--del" onClick={() => removeNode(node)}>Xóa</button>
                </div>
              )
            })}
          </div>
        </div>
        <div className="cm-modal-foot">
          <button type="button" className="cm-btn cm-btn--ghost" onClick={onCancel} disabled={saving}>Đóng</button>
          <button type="button" className="cm-btn cm-btn--primary" onClick={save} disabled={saving || busy}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ClassMembersPage() {
  const navigate = useNavigate()
  const { session, profile, authReady } = useAuth()
  const isAdmin = isAdminRole(profile?.role)
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await classroomService.getOrgChart()
      setNodes(Array.isArray(data?.orgChart?.nodes) ? data.orgChart.nodes : [])
    } catch (err) {
      setError(err.message || 'Không tải được cây thành viên.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (!session) { setLoading(false); return }
    load()
  }, [authReady, session, load])

  const map = useMemo(() => buildChildren(nodes), [nodes])
  const roots = map.get('') || []
  const exit = () => navigate(classTabPath('home'))

  return (
    <div className="cm-page">
      <button type="button" className="cm-exit" onClick={exit}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        Thoát
      </button>

      {!authReady || loading || !session || error || roots.length === 0 ? (
        <div className="cm-scroll">
          {!authReady || loading ? <p className="cm-state">Đang tải...</p>
            : !session ? <p className="cm-state">Bạn cần đăng nhập để xem thành viên lớp.</p>
            : error ? <p className="cm-state cm-state--err">{error}</p>
            : <p className="cm-state">Chưa có thành viên nào trong cây.{isAdmin ? ' Bấm "Điều chỉnh" để thêm.' : ''}</p>}
        </div>
      ) : (
        <PanArea>
          <div className="cm-forest">
            {roots.map((root) => (
              <div className="cm-tree" key={root.id}><TreeBranch list={[root]} map={map} /></div>
            ))}
          </div>
        </PanArea>
      )}

      {isAdmin && session && !loading && !error ? (
        <button type="button" className="cm-adjust" onClick={() => setEditing(true)}>Điều chỉnh</button>
      ) : null}

      {editing ? (
        <EditorModal
          initial={nodes}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => { setNodes(saved); setEditing(false) }}
        />
      ) : null}
    </div>
  )
}
