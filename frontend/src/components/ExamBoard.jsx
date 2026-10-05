import { useCallback, useEffect, useRef, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import { useServerClock } from '../lib/useServerClock.js'
import ExamStatusTable from './ExamStatusTable.jsx'
import {
  EXAM_FILE_ACCEPT, EXAM_MAX_FILES, EXAM_MAX_TOTAL, EXAM_PREVIEW_EXT,
  PHASE_LABEL, extOf, formatCountdown, formatFull, formatShort, formatSize, phaseOf, validateSubmitFile,
} from '../lib/examUtils.js'
import './ExamBoard.css'

const POLL_MS = 20_000
const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
const IconBack = () => <svg {...svg}><path d="M19 12H5m0 0 6-6m-6 6 6 6" /></svg>
const IconAlarm = () => <svg {...svg}><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 1.5M4 5.5 7 3M20 5.5 17 3" /></svg>
const IconPlay = () => <svg {...svg}><path d="M7 4.5v15l12-7.5-12-7.5Z" /></svg>
const IconTimerOff = () => <svg {...svg}><path d="M10 2h4M12 14l2-2M8.5 4.8A8 8 0 0 1 19.2 15.5M4 4l16 16M6.3 6.3a8 8 0 0 0 11.4 11.4" /></svg>
const IconLock = () => <svg {...svg}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
const IconDoc = () => <svg {...svg}><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5V8h4M8 12h8M8 16h6" /></svg>
const IconUpload = () => <svg {...svg}><path d="M12 15V3m0 0L8 7m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
const IconChart = () => <svg {...svg}><path d="M4 20V10M10 20V4M16 20v-8M21 20H3" /></svg>
const IconCheck = () => <svg {...svg}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></svg>
const IconCircle = () => <svg {...svg}><circle cx="12" cy="12" r="9" /></svg>

/* ------------------------------------------------------------------ */
/* Tab "Nộp bài"                                                       */
/* ------------------------------------------------------------------ */
function SubmitPanel({ examId, submission, expired, onSubmitted }) {
  const [entries, setEntries] = useState([]) // { key, file, previewUrl }
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const cameraRef = useRef(null)
  const albumRef = useRef(null)
  const fileRef = useRef(null)
  const entriesRef = useRef([])
  entriesRef.current = entries

  useEffect(() => () => entriesRef.current.forEach((e) => e.previewUrl && URL.revokeObjectURL(e.previewUrl)), [])

  const total = entries.reduce((n, e) => n + e.file.size, 0)

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return
    setError(''); setOkMsg('')
    const next = [...entriesRef.current]
    let sum = next.reduce((n, e) => n + e.file.size, 0)
    for (const file of incoming) {
      const problem = validateSubmitFile(file)
      if (problem) { setError(problem); continue }
      if (next.length >= EXAM_MAX_FILES) { setError(`Tối đa ${EXAM_MAX_FILES} file.`); break }
      if (sum + file.size > EXAM_MAX_TOTAL) { setError('Tổng dung lượng vượt quá 50MB.'); continue }
      sum += file.size
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: EXAM_PREVIEW_EXT.includes(extOf(file.name)) ? URL.createObjectURL(file) : '',
      })
    }
    setEntries(next)
  }
  const removeEntry = (key) => setEntries((prev) => {
    const t = prev.find((e) => e.key === key)
    if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl)
    return prev.filter((e) => e.key !== key)
  })
  const onPick = (e) => { addFiles(e.target.files); e.target.value = '' }

  const submit = async () => {
    if (busy || !entries.length) return
    setBusy(true); setError(''); setOkMsg(''); setProgress('')
    try {
      await classroomService.submitExam(examId, entries.map((e) => e.file), (done, all) => setProgress(`Đang tải ${done}/${all} file...`))
      entries.forEach((e) => e.previewUrl && URL.revokeObjectURL(e.previewUrl))
      setEntries([])
      setOkMsg('Đã nộp bài thành công. Bạn có thể chọn file mới để nộp lại khi còn thời gian.')
      await onSubmitted()
    } catch (err) {
      setError(err.message || 'Nộp bài thất bại.')
    } finally {
      setBusy(false); setProgress('')
    }
  }

  if (expired) {
    return (
      <section className="ex-card ex-locked">
        <span className="ex-locked-icon"><IconLock /></span>
        <p className="ex-locked-title">Đã hết thời gian làm bài.</p>
        <p className="ex-locked-sub">{submission ? 'Bài của bạn đã được ghi nhận.' : 'Bạn chưa nộp bài.'}</p>
        {submission ? <p className="ex-muted">Nộp lúc {formatFull(submission.submitted_at)} · {submission.files.length} file</p> : null}
      </section>
    )
  }

  return (
    <section className="ex-card">
      {submission ? (
        <div className="ex-note ex-note--ok">
          <strong>Bạn đã nộp lúc {formatFull(submission.submitted_at)}</strong> ({submission.files.length} file).
          {' '}Chọn file mới rồi bấm <b>Nộp lại</b> sẽ thay thế toàn bộ bài đã nộp.
        </div>
      ) : null}

      <div
        className={`ex-dropzone${dragOver ? ' is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer?.files) }}
      >
        <p className="ex-dropzone-title">Kéo ảnh / PDF vào đây</p>
        <p className="ex-muted">Ảnh ≤ 10MB/ảnh · PDF ≤ 30MB · Tổng ≤ 50MB</p>
        <div className="ex-pick-row">
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy}>📷 Chụp ảnh</button>
          <button type="button" onClick={() => albumRef.current?.click()} disabled={busy}>🖼️ Chọn từ album</button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>📎 Chọn file</button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
        <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
        <input ref={fileRef} type="file" accept={EXAM_FILE_ACCEPT} multiple hidden onChange={onPick} />
      </div>

      {entries.length ? (
        <>
          <ul className="ex-selected">
            {entries.map((e) => (
              <li key={e.key}>
                {e.previewUrl ? <img src={e.previewUrl} alt={e.file.name} /> : <span className="ex-selected-ico">📄</span>}
                <span className="ex-selected-name">{e.file.name}<small>{formatSize(e.file.size)}</small></span>
                <button type="button" onClick={() => removeEntry(e.key)} disabled={busy} aria-label={`Bỏ ${e.file.name}`}>×</button>
              </li>
            ))}
          </ul>
          <p className="ex-muted ex-total">Tổng: {formatSize(total)} / 50 MB</p>
        </>
      ) : null}

      {error ? <p className="ex-error">{error}</p> : null}
      {okMsg ? <p className="ex-success">{okMsg}</p> : null}
      {progress ? <p className="ex-muted">{progress}</p> : null}

      <button type="button" className="ex-btn-primary ex-btn-block" onClick={submit} disabled={busy || !entries.length}>
        {busy ? 'Đang nộp...' : submission ? 'Nộp lại' : 'Nộp bài'}
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Tab "Đề bài"                                                        */
/* ------------------------------------------------------------------ */
function ExamPaper({ exam }) {
  const [zoom, setZoom] = useState(null)
  const images = exam.images || []
  return (
    <section className="ex-card">
      {exam.content ? <p className="ex-content">{exam.content}</p> : null}
      {images.length ? (
        <div className="ex-paper-images">
          {images.map((img, i) => (
            <button key={`${img.name}-${i}`} type="button" className="ex-paper-img" onClick={() => setZoom(img)}>
              <img src={img.url} alt={`Ảnh đề ${i + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      {!exam.content && !images.length ? <p className="ex-muted">Đề chưa có nội dung.</p> : null}
      {zoom ? (
        <div className="ex-zoom" role="presentation" onClick={() => setZoom(null)}><img src={zoom.url} alt={zoom.name} /></div>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Màn hình 1 bài kiểm tra                                             */
/* ------------------------------------------------------------------ */
function ExamDetail({ examId, canManage, clock, onBack, onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [tab, setTab] = useState('paper')
  const [preview, setPreview] = useState(false)
  const expiredReloaded = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await classroomService.getExam(examId)
      clock.sync(res.server_now)
      setData(res)
      setError('')
    } catch (err) {
      setError(err.message || 'Không tải được bài kiểm tra.')
    }
  }, [examId, clock])

  useEffect(() => { load() }, [load])

  const exam = data?.exam
  const attempt = data?.attempt || null
  const nowMs = clock.now()
  const phase = exam ? phaseOf(exam, nowMs) : 'open'
  const deadlineMs = attempt ? Date.parse(attempt.deadline_at) : 0
  const remaining = attempt ? deadlineMs - nowMs : 0
  const expired = Boolean(attempt) && remaining <= 0

  // Hết giờ → tải lại 1 lần để đồng bộ trạng thái với server
  useEffect(() => {
    if (expired && !expiredReloaded.current) { expiredReloaded.current = true; load(); onChanged?.() }
  }, [expired, load, onChanged])

  const start = async () => {
    if (starting) return
    if (!window.confirm(`Bắt đầu làm bài? Đồng hồ ${exam.duration_minutes} phút sẽ chạy ngay và không tạm dừng được.`)) return
    setStarting(true)
    try {
      const res = await classroomService.startExam(examId)
      clock.sync(res.server_now)
      await load()
      onChanged?.()
      setTab('paper')
    } catch (err) {
      alert(err.message || 'Không bắt đầu được bài kiểm tra.')
      await load()
    } finally {
      setStarting(false)
    }
  }

  const header = exam ? (
    <>
      <button type="button" className="ex-back" onClick={onBack}><IconBack /> Danh sách bài kiểm tra</button>
      <h2 className="ex-title">{exam.title}</h2>
      <p className="ex-meta">
        {formatShort(exam.open_at)} → {formatShort(exam.close_at)}
        <span className="ex-dot">·</span>
        Làm bài {exam.duration_minutes} phút
        <span className={`ex-badge ex-badge--${phase}`}>{PHASE_LABEL[phase]}</span>
      </p>
    </>
  ) : <button type="button" className="ex-back" onClick={onBack}><IconBack /> Danh sách bài kiểm tra</button>

  if (error && !data) return <div className="ex-root">{header}<p className="ex-error">{error}</p></div>
  if (!exam) return <div className="ex-root">{header}<p className="ex-muted">Đang tải...</p></div>

  /* Chưa bắt đầu */
  if (!attempt && !preview) {
    const canStart = phase === 'open'
    return (
      <div className="ex-root">
        {header}
        <section className="ex-card ex-start">
          <span className="ex-start-icon"><IconAlarm /></span>
          <p className="ex-start-title">Bài kiểm tra kéo dài <b>{exam.duration_minutes} phút</b></p>
          <p className="ex-start-text">Đồng hồ chạy ngay khi bấm Bắt đầu, <b>không tạm dừng được</b>. Hết giờ, nút nộp bài sẽ tự động đóng.</p>
          <p className="ex-start-deadline">Hạn chót nộp: {formatShort(exam.close_at)}</p>
          {phase === 'upcoming' ? <p className="ex-muted">Đề sẽ mở lúc {formatShort(exam.open_at)}.</p> : null}
          {phase === 'closed' ? <p className="ex-muted">Bài kiểm tra đã kết thúc, bạn không còn bắt đầu được.</p> : null}
          <button type="button" className="ex-btn-primary" onClick={start} disabled={!canStart || starting}>
            <IconPlay /> {starting ? 'Đang bắt đầu...' : 'Bắt đầu làm bài'}
          </button>
          {canManage ? (
            <button type="button" className="ex-btn-ghost" onClick={() => { setPreview(true); setTab('paper') }}>Xem đề (quản trị, không tính giờ)</button>
          ) : null}
        </section>
      </div>
    )
  }

  /* Đang làm / đã hết giờ / xem trước */
  const submitted = Boolean(data.my_submission)
  const tabs = [
    { id: 'paper', label: 'Đề bài', icon: <IconDoc /> },
    ...(attempt ? [{ id: 'submit', label: 'Nộp bài', icon: <IconUpload />, dot: submitted }] : []),
    { id: 'stats', label: 'Thống kê', icon: <IconChart /> },
  ]
  return (
    <div className="ex-root">
      {header}
      {expired ? (
        <div className="ex-banner ex-banner--danger"><IconTimerOff /> Đã hết thời gian làm bài.</div>
      ) : attempt ? (
        <div className="ex-banner ex-banner--timer" role="timer" aria-live="off">
          <IconAlarm /> Thời gian còn lại <strong>{formatCountdown(remaining)}</strong>
        </div>
      ) : (
        <div className="ex-banner ex-banner--info">Chế độ xem đề của quản trị — chưa tính giờ, không nộp bài.</div>
      )}

      <div className="ex-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            className={`ex-tab${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon}<span>{t.label}</span>{t.dot ? <i className="ex-tab-dot" /> : null}
          </button>
        ))}
      </div>

      {tab === 'paper' ? <ExamPaper exam={exam} /> : null}
      {tab === 'submit' && attempt ? (
        <SubmitPanel examId={examId} submission={data.my_submission} expired={expired}
          onSubmitted={async () => { await load(); onChanged?.() }} />
      ) : null}
      {tab === 'stats' ? <ExamStatusTable examId={examId} canManage={canManage} /> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Danh sách bài kiểm tra                                              */
/* ------------------------------------------------------------------ */
export default function ExamBoard({ canManage = false }) {
  const clock = useServerClock(1000)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await classroomService.getExams()
      clock.sync(res.server_now)
      setItems(Array.isArray(res?.items) ? res.items : [])
      setError('')
    } catch (err) {
      if (!silent) setError(err.message || 'Không tải được danh sách bài kiểm tra.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [clock])

  useEffect(() => {
    load()
    const tick = () => { if (document.visibilityState === 'visible') load(true) }
    const id = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('classweb-class-refresh', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('classweb-class-refresh', tick)
    }
  }, [load])

  if (selectedId) {
    return (
      <ExamDetail examId={selectedId} canManage={canManage} clock={clock}
        onBack={() => { setSelectedId(null); load(true) }} onChanged={() => load(true)} />
    )
  }

  const nowMs = clock.now()
  return (
    <div className="ex-root">
      {loading ? (
        <p className="ex-muted ex-center">Đang tải...</p>
      ) : error ? (
        <p className="ex-error">{error}</p>
      ) : items.length === 0 ? (
        <p className="ex-empty">Không có gì</p>
      ) : (
        <div className="ex-list">
          {items.map((item) => {
            const phase = phaseOf(item, nowMs)
            const submitted = Boolean(item.my_submission)
            return (
              <button key={item.id} type="button" className={`ex-item${phase === 'open' ? ' is-open' : ''}`} onClick={() => setSelectedId(item.id)}>
                <span className="ex-item-title">{item.title}</span>
                <span className="ex-item-meta">
                  {formatShort(item.open_at)} → {formatShort(item.close_at)}
                  <span className="ex-dot">·</span>Làm bài {item.duration_minutes} phút
                </span>
                <span className="ex-item-status">
                  <span className={`ex-submit-state${submitted ? ' is-done' : ''}`}>
                    {submitted ? <IconCheck /> : <IconCircle />} {submitted ? 'Đã nộp' : 'Chưa nộp'}
                  </span>
                  <span className={`ex-badge ex-badge--${phase}`}>{PHASE_LABEL[phase]}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
