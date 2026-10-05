import { useEffect, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import { compareByGivenName, formatFull, formatSize } from '../lib/examUtils.js'
import './ExamBoard.css'

/** Chi tiết bài nộp 1 học sinh (chỉ người quản lý). */
export function ExamSubmissionDetailModal({ examId, target, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    let cancelled = false
    classroomService.getExamSubmissionDetail(examId, target.userId)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Không tải được bài nộp.') })
    return () => { cancelled = true }
  }, [examId, target.userId])

  const files = data?.submission?.files || []
  return (
    <div className="ex-overlay" role="presentation" onClick={onClose}>
      <div className="ex-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="ex-modal-head">
          <h3>{target.name}</h3>
          <button type="button" className="ex-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </header>
        <div className="ex-modal-body">
          {!data && !error ? <p className="ex-muted">Đang tải bài nộp...</p> : null}
          {error ? <p className="ex-error">{error}</p> : null}
          {data ? <p className="ex-muted">Nộp lúc {formatFull(data.submission.submitted_at)} · {files.length} file</p> : null}
          <div className="ex-detail-grid">
            {files.map((f, i) => f.is_image ? (
              <button key={`${f.name}-${i}`} type="button" className="ex-thumb" onClick={() => setZoom(f)}>
                <img src={f.url} alt={f.name} loading="lazy" />
              </button>
            ) : (
              <a key={`${f.name}-${i}`} className="ex-file-link" href={f.url} target="_blank" rel="noreferrer">
                📄 {f.name} <small>{formatSize(f.size)}</small>
              </a>
            ))}
          </div>
        </div>
      </div>
      {zoom ? (
        <div className="ex-zoom" role="presentation" onClick={(e) => { e.stopPropagation(); setZoom(null) }}>
          <img src={zoom.url} alt={zoom.name} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * "Tình hình nộp bài của lớp": lấy từ Danh sách lớp của quản lý admin
 * + trạng thái Đã nộp / Chưa nộp. Người quản lý có thêm nút Xem bài.
 */
export default function ExamStatusTable({ examId, canManage = false, pollMs = 20000 }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [statusData, listData] = await Promise.all([
          classroomService.getExamStatus(examId),
          classroomService.getClassList(),
        ])
        if (cancelled) return
        const submitted = new Map((statusData?.submissions || []).map((s) => [s.user_id, s]))
        const list = Array.isArray(listData?.items) ? listData.items : []
        const built = list
          .filter((row) => !(row.is_placeholder && (row.match_user_ids || []).length)) // tên chờ kết nối đã trùng tài khoản thật
          .map((row) => {
            const sub = row.is_placeholder ? null : submitted.get(row.id) || null
            return { id: row.id, name: row.username || 'Chưa đặt tên', userId: row.is_placeholder ? null : row.id, submitted: Boolean(sub) }
          })
        const known = new Set(built.map((r) => r.userId).filter(Boolean))
        for (const sub of statusData?.submissions || []) {
          if (known.has(sub.user_id)) continue
          built.push({ id: sub.user_id, name: sub.user_name || 'Không rõ tên', userId: sub.user_id, submitted: true })
        }
        built.sort((a, b) => compareByGivenName(a.name, b.name))
        setRows(built)
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được thống kê.')
      }
    }
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, pollMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [examId, pollMs])

  const done = rows ? rows.filter((r) => r.submitted).length : 0
  return (
    <section className="ex-card ex-stats">
      <h3 className="ex-card-title">Tình hình nộp bài của lớp{rows ? <span className="ex-stats-count"> · {done}/{rows.length}</span> : null}</h3>
      {!rows && !error ? <p className="ex-muted">Đang tải...</p> : null}
      {error ? <p className="ex-error">{error}</p> : null}
      {rows ? (
        <ol className="ex-stat-list">
          {rows.map((row, i) => (
            <li key={row.id} className="ex-stat-row">
              <span className="ex-stat-no">{i + 1}.</span>
              <span className="ex-stat-name">{row.name}</span>
              {canManage && row.submitted && row.userId ? (
                <button type="button" className="ex-link-btn" onClick={() => setDetail({ userId: row.userId, name: row.name })}>Xem</button>
              ) : null}
              <span className={`ex-pill ${row.submitted ? 'ex-pill--done' : 'ex-pill--todo'}`}>{row.submitted ? 'Đã nộp' : 'Chưa nộp'}</span>
            </li>
          ))}
          {!rows.length ? <li className="ex-muted">Chưa có danh sách lớp.</li> : null}
        </ol>
      ) : null}
      {detail ? <ExamSubmissionDetailModal examId={examId} target={detail} onClose={() => setDetail(null)} /> : null}
    </section>
  )
}
