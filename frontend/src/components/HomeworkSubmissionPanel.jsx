import { useCallback, useEffect, useRef, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './HomeworkSubmissionPanel.css'

const MAX_FILES = 10
const MAX_FILE_BYTES = 20 * 1024 * 1024
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']
const PREVIEWABLE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const FILE_ACCEPT = ALLOWED_EXT.map((ext) => `.${ext}`).join(',')
const POLL_MS = 20_000

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatVNDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN')
}

function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

function extOf(name) {
  const s = String(name || '')
  return s.includes('.') ? s.split('.').pop().toLowerCase() : ''
}

/** Phần tên (chữ cuối) để sắp xếp A-Z kiểu Việt, giống trang Quản lý lớp. */
function givenNameKey(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1].toLocaleLowerCase('vi') : ''
}

function compareByGivenName(a, b) {
  const byGiven = givenNameKey(a).localeCompare(givenNameKey(b), 'vi', { sensitivity: 'base' })
  return byGiven !== 0 ? byGiven : String(a || '').localeCompare(String(b || ''), 'vi', { sensitivity: 'base' })
}

const PHASE_LABEL = { upcoming: 'Chưa mở', open: 'Đang nhận bài', closed: 'Đã hết hạn' }

/* ------------------------------------------------------------------ */
/* Modal tạo bài tập                                                   */
/* ------------------------------------------------------------------ */
function CreateAssignmentModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [allowResubmit, setAllowResubmit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (saving) return
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề bài tập.')
    if (!startDate) return setError('Vui lòng chọn ngày bắt đầu nộp.')
    if (!endDate) return setError('Vui lòng chọn ngày kết thúc nộp.')
    if (endDate < startDate) return setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.')
    setSaving(true)
    setError('')
    try {
      await classroomService.createHomeworkAssignment({
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        allow_resubmit: allowResubmit,
      })
      onCreated()
    } catch (err) {
      setError(err.message || 'Không tạo được bài tập.')
      setSaving(false)
    }
  }

  return (
    <div className="hw-composer-overlay" role="presentation" onClick={() => !saving && onClose()}>
      <div className="hw-composer-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="hw-composer-header">
          <h2>Thêm bài tập</h2>
          <button type="button" className="hw-composer-close" onClick={onClose} disabled={saving} aria-label="Đóng">✕</button>
        </header>
        <div className="hw-composer-body">
          <label className="hw-field">
            Tiêu đề bài tập
            <input
              type="text"
              className="hw-text-input"
              placeholder="Nhập tiêu đề bài tập..."
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>
          <label className="hw-field">
            Ngày bắt đầu nộp
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="hw-field">
            Ngày kết thúc nộp
            <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <div className="hw-toggle-row">
            <span className="hw-toggle-label">Cho phép nộp lại</span>
            <button
              type="button"
              className={`hw-switch${allowResubmit ? ' is-on' : ''}`}
              role="switch"
              aria-checked={allowResubmit}
              onClick={() => setAllowResubmit((v) => !v)}
            >
              <span className="hw-switch-knob" />
            </button>
          </div>
          {error ? <p className="hws-error">{error}</p> : null}
        </div>
        <footer className="hw-composer-footer">
          <button type="button" className="hw-btn-post" onClick={save} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu và tạo bài tập'}
          </button>
        </footer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal nộp bài                                                       */
/* ------------------------------------------------------------------ */
function SubmitModal({ assignment, onClose, onSubmitted }) {
  const [entries, setEntries] = useState([]) // { key, file, previewUrl }
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const cameraRef = useRef(null)
  const albumRef = useRef(null)
  const fileRef = useRef(null)
  const entriesRef = useRef([])
  entriesRef.current = entries

  useEffect(() => () => {
    entriesRef.current.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl))
  }, [])

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return
    setError('')
    const next = [...entriesRef.current]
    for (const file of incoming) {
      const ext = extOf(file.name)
      if (!ALLOWED_EXT.includes(ext)) {
        setError(`File "${file.name}" không được hỗ trợ (chỉ ảnh, PDF, Word, Excel, PowerPoint, TXT).`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`File "${file.name}" vượt quá giới hạn 20MB.`)
        continue
      }
      if (next.length >= MAX_FILES) {
        setError(`Mỗi lần nộp tối đa ${MAX_FILES} file.`)
        break
      }
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: PREVIEWABLE_EXT.includes(ext) ? URL.createObjectURL(file) : '',
      })
    }
    setEntries(next)
  }

  const removeEntry = (key) => {
    setEntries((prev) => {
      const target = prev.find((entry) => entry.key === key)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((entry) => entry.key !== key)
    })
  }

  const onPick = (e) => {
    addFiles(e.target.files)
    e.target.value = ''
  }

  const submit = async () => {
    if (submitting) return
    if (!entries.length) return setError('Hãy chọn ảnh hoặc file để nộp.')
    setSubmitting(true)
    setError('')
    try {
      await classroomService.submitHomeworkAssignment(assignment.id, entries.map((entry) => entry.file))
      onSubmitted()
    } catch (err) {
      setError(err.message || 'Nộp bài thất bại.')
      setSubmitting(false)
    }
  }

  const resubmitting = Boolean(assignment.my_submission)

  return (
    <div className="hw-composer-overlay" role="presentation" onClick={() => !submitting && onClose()}>
      <div className="hw-composer-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="hw-composer-header">
          <h2>{assignment.title}</h2>
          <button type="button" className="hw-composer-close" onClick={onClose} disabled={submitting} aria-label="Đóng">✕</button>
        </header>
        <div className="hw-composer-body">
          {resubmitting ? (
            <p className="hws-note">Bạn đã nộp bài này. Nộp lại sẽ thay thế bài đã nộp trước đó.</p>
          ) : null}

          <div
            className={`hws-dropzone${dragOver ? ' is-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer?.files) }}
          >
            <p className="hws-dropzone-title">Kéo ảnh / file vào đây</p>
            <p className="hws-dropzone-hint">Tối đa {MAX_FILES} file, mỗi file ≤ 20MB</p>
            <div className="hws-pick-row">
              <button type="button" onClick={() => cameraRef.current?.click()}>📷 Chụp ảnh</button>
              <button type="button" onClick={() => albumRef.current?.click()}>🖼️ Chọn từ album</button>
              <button type="button" onClick={() => fileRef.current?.click()}>📎 Chọn file</button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
            <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
            <input ref={fileRef} type="file" accept={FILE_ACCEPT} multiple hidden onChange={onPick} />
          </div>

          {entries.length ? (
            <ul className="hws-selected">
              {entries.map((entry) => (
                <li key={entry.key} className="hws-selected-item">
                  {entry.previewUrl ? (
                    <img src={entry.previewUrl} alt={entry.file.name} />
                  ) : (
                    <span className="hws-file-icon" aria-hidden="true">📄</span>
                  )}
                  <span className="hws-selected-name">
                    {entry.file.name}
                    <small>{formatSize(entry.file.size)}</small>
                  </span>
                  <button type="button" onClick={() => removeEntry(entry.key)} aria-label={`Bỏ ${entry.file.name}`} disabled={submitting}>×</button>
                </li>
              ))}
            </ul>
          ) : null}

          {error ? <p className="hws-error">{error}</p> : null}
        </div>
        <footer className="hw-composer-footer">
          <button type="button" className="hw-btn-post" onClick={submit} disabled={submitting || !entries.length}>
            {submitting ? 'Đang nộp...' : resubmitting ? 'Nộp lại' : 'Nộp bài'}
          </button>
        </footer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Chi tiết bài nộp của 1 học sinh (Admin / LPHT)                      */
/* ------------------------------------------------------------------ */
function SubmissionDetailModal({ assignmentId, target, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    let cancelled = false
    classroomService.getHomeworkSubmissionDetail(assignmentId, target.userId)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Không tải được bài nộp.') })
    return () => { cancelled = true }
  }, [assignmentId, target.userId])

  const files = data?.submission?.files || []
  const images = files.filter((f) => f.is_image)
  const others = files.filter((f) => !f.is_image)

  return (
    <div className="hw-composer-overlay hws-overlay-top" role="presentation" onClick={onClose}>
      <div className="hw-composer-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="hw-composer-header">
          <h2>{target.name}</h2>
          <button type="button" className="hw-composer-close" onClick={onClose} aria-label="Đóng">✕</button>
        </header>
        <div className="hw-composer-body">
          {!data && !error ? <p className="hws-note">Đang tải bài nộp...</p> : null}
          {error ? <p className="hws-error">{error}</p> : null}
          {data ? (
            <>
              <p className="hws-note">Nộp lúc {formatDateTime(data.submission.submitted_at)}</p>
              {images.length ? (
                <div className="hws-detail-grid">
                  {images.map((f, i) => (
                    <button key={`${f.name}-${i}`} type="button" onClick={() => setZoom(f)}>
                      <img src={f.url} alt={f.name} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}
              {others.length ? (
                <ul className="hws-detail-files">
                  {others.map((f, i) => (
                    <li key={`${f.name}-${i}`}>
                      <a href={f.url} target="_blank" rel="noreferrer">📄 {f.name}</a>
                      <small>{formatSize(f.size)}</small>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {zoom ? (
        <div className="hws-zoom" role="presentation" onClick={(e) => { e.stopPropagation(); setZoom(null) }}>
          <img src={zoom.url} alt={zoom.name} />
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal tình trạng nộp bài                                            */
/* ------------------------------------------------------------------ */
function StatusModal({ assignment, canManage, onClose }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [detailTarget, setDetailTarget] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [statusData, listData] = await Promise.all([
          classroomService.getHomeworkAssignmentStatus(assignment.id),
          classroomService.getClassList(),
        ])
        if (cancelled) return
        const submitted = new Map((statusData?.submissions || []).map((s) => [s.user_id, s]))
        const list = Array.isArray(listData?.items) ? listData.items : []
        const built = list
          // Tên chờ kết nối đã trùng tài khoản thật thì bỏ (tránh hiện 2 dòng)
          .filter((row) => !(row.is_placeholder && (row.match_user_ids || []).length))
          .map((row) => {
            const sub = row.is_placeholder ? null : submitted.get(row.id) || null
            return {
              id: row.id,
              name: row.username || 'Chưa đặt tên',
              userId: row.is_placeholder ? null : row.id,
              submitted: Boolean(sub),
              submittedAt: sub?.submitted_at || null,
            }
          })
        // Ai đã nộp nhưng không nằm trong danh sách lớp thì vẫn hiển thị
        const known = new Set(built.map((r) => r.userId).filter(Boolean))
        for (const sub of statusData?.submissions || []) {
          if (known.has(sub.user_id)) continue
          built.push({
            id: sub.user_id,
            name: sub.user_name || 'Không rõ tên',
            userId: sub.user_id,
            submitted: true,
            submittedAt: sub.submitted_at,
          })
        }
        built.sort((a, b) => compareByGivenName(a.name, b.name))
        setRows(built)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được tình trạng nộp bài.')
      }
    })()
    return () => { cancelled = true }
  }, [assignment.id])

  const doneCount = rows ? rows.filter((r) => r.submitted).length : 0

  return (
    <div className="hw-composer-overlay" role="presentation" onClick={onClose}>
      <div className="hw-composer-modal hws-status-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="hw-composer-header">
          <h2>Tình trạng nộp bài</h2>
          <button type="button" className="hw-composer-close" onClick={onClose} aria-label="Đóng">✕</button>
        </header>
        <div className="hw-composer-body">
          <p className="hws-note">
            <strong>{assignment.title}</strong>
            {rows ? <> · Đã nộp {doneCount}/{rows.length}</> : null}
          </p>
          {!rows && !error ? <p className="hws-note">Đang tải...</p> : null}
          {error ? <p className="hws-error">{error}</p> : null}
          {rows ? (
            <div className="hws-table-wrap">
              <table className="hws-table">
                <thead>
                  <tr>
                    <th className="hws-col-stt">STT</th>
                    <th>Học sinh</th>
                    <th className="hws-col-center">Đã nộp</th>
                    {canManage ? <th className="hws-col-center">Xem chi tiết</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="hws-col-stt">{index + 1}</td>
                      <td>{row.name}</td>
                      <td className="hws-col-center">
                        {row.submitted
                          ? <span className="hws-tick" title={formatDateTime(row.submittedAt)}>✓</span>
                          : <span className="hws-cross">✕</span>}
                      </td>
                      {canManage ? (
                        <td className="hws-col-center">
                          {row.submitted && row.userId ? (
                            <button
                              type="button"
                              className="hws-link-btn"
                              onClick={() => setDetailTarget({ userId: row.userId, name: row.name })}
                            >
                              Xem
                            </button>
                          ) : '—'}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr><td colSpan={canManage ? 4 : 3} className="hws-col-center">Chưa có danh sách lớp.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
      {detailTarget ? (
        <SubmissionDetailModal
          assignmentId={assignment.id}
          target={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Panel chính                                                         */
/* ------------------------------------------------------------------ */
export default function HomeworkSubmissionPanel({ canManage }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [submitTarget, setSubmitTarget] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await classroomService.getHomeworkAssignments()
      setItems(Array.isArray(data?.items) ? data.items : [])
      setError('')
    } catch (err) {
      if (!silent) setError(err.message || 'Không tải được danh sách bài tập.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const tick = () => {
      if (document.visibilityState === 'visible') load(true)
    }
    const interval = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa bài tập "${item.title}"? Toàn bộ bài đã nộp cũng sẽ bị xóa.`)) return
    try {
      await classroomService.deleteHomeworkAssignment(item.id)
      setItems((prev) => prev.filter((x) => x.id !== item.id))
    } catch (err) {
      alert(err.message || 'Xóa thất bại.')
    }
  }

  const submitLabel = (item) => {
    if (item.my_submission && item.allow_resubmit) return 'Nộp lại'
    if (item.my_submission) return 'Đã nộp'
    return 'Nộp bài'
  }

  const submitDisabled = (item) =>
    item.phase !== 'open' || (Boolean(item.my_submission) && !item.allow_resubmit)

  return (
    <div className="hw-board hws-panel">
      {canManage ? (
        <button type="button" className="hws-add-btn" onClick={() => setShowCreate(true)}>
          Thêm bài tập
        </button>
      ) : null}

      {loading ? (
        <div className="hw-state">
          <span className="hw-spinner" aria-hidden="true" />
          <p>Đang tải bài tập...</p>
        </div>
      ) : error ? (
        <div className="hw-state hw-state--error"><p>{error}</p></div>
      ) : items.length === 0 ? (
        <p className="hw-empty">Chưa có bài tập nộp nào.</p>
      ) : (
        <div className="hws-list">
          {items.map((item) => (
            <article key={item.id} className="hws-card">
              <div className="hws-card-head">
                <h3 className="hws-card-title">{item.title}</h3>
                <span className={`hws-phase hws-phase--${item.phase}`}>{PHASE_LABEL[item.phase]}</span>
              </div>
              <p className="hws-card-meta">
                Nộp từ {formatVNDate(item.start_date)} đến {formatVNDate(item.end_date)}
              </p>
              <p className="hws-card-meta">
                {item.allow_resubmit ? 'Cho phép nộp lại' : 'Không cho nộp lại'}
                {item.my_submission ? (
                  <span className="hws-mine"> · ✓ Bạn đã nộp lúc {formatDateTime(item.my_submission.submitted_at)}</span>
                ) : null}
              </p>
              <div className="hws-card-actions">
                <button
                  type="button"
                  className="hws-btn-submit"
                  onClick={() => setSubmitTarget(item)}
                  disabled={submitDisabled(item)}
                  title={item.phase === 'upcoming' ? 'Chưa đến ngày nộp' : item.phase === 'closed' ? 'Đã hết hạn nộp' : ''}
                >
                  {submitLabel(item)} <span aria-hidden="true">→</span>
                </button>
                <button type="button" className="hws-btn-status" onClick={() => setStatusTarget(item)}>
                  Xem tình trạng
                </button>
                {canManage ? (
                  <button type="button" className="hws-btn-delete" onClick={() => handleDelete(item)}>
                    Xóa
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreate ? (
        <CreateAssignmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      ) : null}
      {submitTarget ? (
        <SubmitModal
          assignment={submitTarget}
          onClose={() => setSubmitTarget(null)}
          onSubmitted={() => { setSubmitTarget(null); load() }}
        />
      ) : null}
      {statusTarget ? (
        <StatusModal
          assignment={statusTarget}
          canManage={canManage}
          onClose={() => setStatusTarget(null)}
        />
      ) : null}
    </div>
  )
}
