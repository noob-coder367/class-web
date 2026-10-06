import { useCallback, useEffect, useRef, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import { useServerClock } from '../lib/useServerClock.js'
import ExamStatusTable from './ExamStatusTable.jsx'
import AIGradingManagement from './AIGradingManagement.jsx'
import {
  EXAM_MAX_IMAGE, PHASE_LABEL, extOf, formatShort, phaseOf, toLocalInputValue,
} from '../lib/examUtils.js'
import './ExamBoard.css'

const MAX_IMAGES = 20
const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp']

function defaultOpen() {
  const d = new Date(); d.setMinutes(d.getMinutes() + 10, 0, 0)
  return toLocalInputValue(d)
}
function defaultClose() {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0)
  return toLocalInputValue(d)
}

/** Tab "Kiểm tra" trong Quản lý lớp: tạo đề + danh sách đề đã tạo. */
export default function ExamAdminPanel() {
  const clock = useServerClock(5000)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState([]) // { key, file, url }
  const [duration, setDuration] = useState('60')
  const [openAt, setOpenAt] = useState(defaultOpen)
  const [closeAt, setCloseAt] = useState(defaultClose)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [items, setItems] = useState(null)
  const [listError, setListError] = useState('')
  const [statusTarget, setStatusTarget] = useState(null)
  const pickRef = useRef(null)
  const imagesRef = useRef([])
  imagesRef.current = images

  useEffect(() => () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url)), [])

  const loadList = useCallback(async () => {
    try {
      const res = await classroomService.getExams()
      clock.sync(res.server_now)
      setItems(res.items || [])
      setListError('')
    } catch (err) {
      setListError(err.message || 'Không tải được danh sách bài kiểm tra.')
    }
  }, [clock])
  useEffect(() => { loadList() }, [loadList])

  const addImages = (fileList) => {
    setError('')
    const next = [...imagesRef.current]
    for (const file of Array.from(fileList || [])) {
      if (!IMG_EXT.includes(extOf(file.name))) { setError(`Ảnh "${file.name}" không hợp lệ (chỉ JPG, PNG, WEBP).`); continue }
      if (file.size > EXAM_MAX_IMAGE) { setError(`Ảnh "${file.name}" vượt quá 10MB.`); continue }
      if (next.length >= MAX_IMAGES) { setError(`Tối đa ${MAX_IMAGES} ảnh đề.`); break }
      next.push({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, url: URL.createObjectURL(file) })
    }
    setImages(next)
  }
  const removeImage = (key) => setImages((prev) => {
    const t = prev.find((i) => i.key === key)
    if (t) URL.revokeObjectURL(t.url)
    return prev.filter((i) => i.key !== key)
  })

  const reset = () => {
    images.forEach((i) => URL.revokeObjectURL(i.url))
    setTitle(''); setContent(''); setImages([]); setDuration('60'); setOpenAt(defaultOpen()); setCloseAt(defaultClose())
  }

  const save = async () => {
    if (saving) return
    setError(''); setOkMsg('')
    const mins = Number.parseInt(duration, 10)
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề.')
    if (!content.trim() && !images.length) return setError('Nhập nội dung đề hoặc thêm ít nhất 1 ảnh đề.')
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) return setError('Thời gian làm bài phải từ 1 đến 600 phút.')
    if (!openAt || !closeAt) return setError('Vui lòng chọn thời điểm mở đề và hạn chót.')
    const openMs = new Date(openAt).getTime()
    const closeMs = new Date(closeAt).getTime()
    if (closeMs <= openMs) return setError('Hạn chót phải sau thời điểm bắt đầu mở đề.')
    setSaving(true)
    try {
      await classroomService.createExam({
        title: title.trim(), content: content.trim(), duration_minutes: mins,
        open_at: new Date(openMs).toISOString(), close_at: new Date(closeMs).toISOString(),
      }, images.map((i) => i.file))
      reset()
      setOkMsg('Đã tạo bài kiểm tra.')
      window.dispatchEvent(new CustomEvent('classweb-class-refresh'))
      await loadList()
    } catch (err) {
      setError(err.message || 'Không tạo được bài kiểm tra.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Xóa bài kiểm tra "${item.title}"? Toàn bộ bài đã nộp và ảnh đề cũng bị xóa.`)) return
    try {
      await classroomService.deleteExam(item.id)
      setItems((prev) => (prev || []).filter((x) => x.id !== item.id))
      window.dispatchEvent(new CustomEvent('classweb-class-refresh'))
    } catch (err) {
      alert(err.message || 'Xóa thất bại.')
    }
  }

  const nowMs = clock.now()
  return (
    <div className="ex-root ex-admin">
      <h3 className="ex-card-title">Tạo bài kiểm tra</h3>
      <div className="ex-form">
        <label className="ex-field">Tiêu đề
          <input className="ex-input" value={title} maxLength={200} placeholder="VD: Đề kiểm tra 1 - Lớp A*" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="ex-field">Nội dung đề <small>(có thể để trống nếu đã có ảnh đề)</small>
          <textarea className="ex-textarea" value={content} maxLength={20000} placeholder="Nhập nội dung / hướng dẫn làm bài..." onChange={(e) => setContent(e.target.value)} />
        </label>
        <div className="ex-field">Ảnh đề <small>(tối đa {MAX_IMAGES} ảnh, ≤ 10MB/ảnh)</small>
          <div className="ex-img-picker">
            {images.map((i) => (
              <div key={i.key} className="ex-img-tile">
                <img src={i.url} alt={i.file.name} />
                <button type="button" onClick={() => removeImage(i.key)} aria-label="Bỏ ảnh">×</button>
              </div>
            ))}
            <button type="button" className="ex-img-add" onClick={() => pickRef.current?.click()} aria-label="Thêm ảnh đề">+</button>
          </div>
          <input ref={pickRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={(e) => { addImages(e.target.files); e.target.value = '' }} />
        </div>
        <div className="ex-field-row">
          <label className="ex-field">Thời gian làm bài (phút)
            <input className="ex-input" type="number" min="1" max="600" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label className="ex-field">Bắt đầu mở đề từ
            <input className="ex-input" type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
          </label>
          <label className="ex-field">Hạn chót (đóng đề)
            <input className="ex-input" type="datetime-local" value={closeAt} min={openAt || undefined} onChange={(e) => setCloseAt(e.target.value)} />
          </label>
        </div>
        <p className="ex-muted">Mỗi học sinh có đúng {duration || '…'} phút kể từ lúc bấm Bắt đầu, nhưng không quá hạn chót.</p>
        {error ? <p className="ex-error">{error}</p> : null}
        {okMsg ? <p className="ex-success">{okMsg}</p> : null}
        <button type="button" className="ex-btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo bài kiểm tra'}</button>
      </div>

      <h3 className="ex-section-title">Các bài kiểm tra đã tạo</h3>
      {listError ? <p className="ex-error">{listError}</p> : null}
      {!items && !listError ? <p className="ex-muted">Đang tải...</p> : null}
      {items && !items.length ? <p className="ex-muted">Không có gì</p> : null}
      <div className="ex-admin-list">
        {(items || []).map((item) => {
          const phase = phaseOf(item, nowMs)
          return (
            <article key={item.id} className="ex-admin-item">
              <h4>{item.title}</h4>
              <p className="ex-muted">
                {formatShort(item.open_at)} → {formatShort(item.close_at)} · Làm bài {item.duration_minutes} phút · {item.image_count} ảnh đề
              </p>
              <p className="ex-muted">
                <span className={`ex-badge ex-badge--${phase}`}>{PHASE_LABEL[phase]}</span> Đã nộp: {item.submitted_count}
              </p>
              <div className="ex-admin-actions">
                <button type="button" className="ex-btn-sm" onClick={() => setStatusTarget(item)}>Xem bài nộp</button>
                <button type="button" className="ex-btn-sm ex-btn-sm--danger" onClick={() => remove(item)}>Xóa</button>
              </div>
              <AIGradingManagement
                examId={item.id}
                canManage
                onViewResults={() => setStatusTarget(item)}
                onReview={() => setStatusTarget(item)}
              />
            </article>
          )
        })}
      </div>

      {statusTarget ? (
        <div className="ex-overlay" role="presentation" onClick={() => setStatusTarget(null)}>
          <div className="ex-modal ex-modal--wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="ex-modal-head">
              <h3>{statusTarget.title}</h3>
              <button type="button" className="ex-modal-close" onClick={() => setStatusTarget(null)} aria-label="Đóng">✕</button>
            </header>
            <div className="ex-modal-body"><ExamStatusTable examId={statusTarget.id} canManage /></div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
