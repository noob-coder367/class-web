import { useCallback, useEffect, useMemo, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './AIGradingManagement.css'

const POLL_MS = 7_000

const emptyQueue = { pending: 0, processing: 0, completed: 0, needs_review: 0, failed: 0, rate_limited: 0, not_queued: 0 }

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function statusLabel(data) {
  if (!data?.ai_enabled) return ['error', 'AI grading đang tắt']
  if (data.worker_status === 'processing') return ['processing', 'AI đang chấm']
  if (data.queue?.rate_limited > 0) return ['rate_limited', 'Đang chờ quota / rate limit']
  if (data.queue?.pending > 0) return ['queued', 'Đang chờ xử lý']
  if (data.queue?.failed > 0) return ['error', 'Có lỗi cần xử lý']
  if (data.worker_status === 'unavailable') return ['unavailable', 'Worker AI hiện không hoạt động']
  return ['idle', 'AI đang rảnh']
}

export default function AIGradingManagement({ examId, canManage = false, onViewResults, onReview }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(examId && canManage))
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!examId || !canManage || document.visibilityState !== 'visible') return
    try {
      const next = await classroomService.getExamGradingStatus(examId)
      setData(next)
      setError('')
    } catch (err) {
      setError(err.message || 'Không thể tải trạng thái AI.')
    } finally {
      setLoading(false)
    }
  }, [canManage, examId])

  useEffect(() => {
    if (!examId || !canManage) return undefined
    void load()
    const timer = window.setInterval(() => void load(), POLL_MS)
    const onVisibility = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [canManage, examId, load])

  const queue = { ...emptyQueue, ...data?.queue }
  const total = number(data?.submission_count)
  const completed = number(queue.completed)
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  const [statusTone, statusText] = useMemo(() => statusLabel(data), [data])
  const retryable = queue.failed + queue.rate_limited + queue.needs_review
  const canStart = Boolean(data?.ai_enabled && data?.has_answer_key && total && !starting)

  if (!canManage) return null

  const openStart = (mode) => {
    setMessage('')
    setConfirming(mode)
  }

  const start = async () => {
    if (starting) return
    setStarting(true)
    setError('')
    setMessage('')
    try {
      const result = await classroomService.startExamGrading(examId)
      setMessage(result.message || `Đã đưa ${number(result.enqueued)} bài vào hàng chờ AI.`)
      setConfirming(null)
      await load()
    } catch (err) {
      setError(err.message || 'Không thể bắt đầu AI chấm bài.')
      setConfirming(null)
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className="aigm-card" aria-label="Quản lý AI chấm bài">
      <div className="aigm-head">
        <div>
          <p className="aigm-eyebrow">AI GRADING</p>
          <h4>AI Chấm bài</h4>
        </div>
        <span className={`aigm-status aigm-status--${statusTone}`}><i />{statusText}</span>
      </div>

      {loading ? <p className="aigm-muted">Đang tải trạng thái AI...</p> : null}
      {error ? <p className="aigm-error" role="alert">{error}</p> : null}
      {!loading && !error && data && !total ? <p className="aigm-muted">Chưa có bài nộp để chấm.</p> : null}
      {!loading && data && !data.has_answer_key ? <p className="aigm-warning">Chưa có đáp án/rubric. AI chưa thể chấm.</p> : null}
      {!loading && data?.worker_status === 'unavailable' && data.ai_enabled && total ? <p className="aigm-warning">Worker AI hiện không hoạt động.</p> : null}

      {data ? (
        <>
          <div className="aigm-stats">
            <div><span>Chờ chấm</span><b>{queue.pending + queue.not_queued}</b></div>
            <div><span>Đang chấm</span><b>{queue.processing}</b></div>
            <div><span>Đã chấm</span><b>{queue.completed}</b></div>
            <div><span>Cần xem lại</span><b>{queue.needs_review}</b></div>
            <div><span>Lỗi</span><b>{queue.failed}</b></div>
          </div>
          <div className="aigm-progress-wrap">
            <div className="aigm-progress-label"><span>Tiến độ</span><strong>{completed} / {total}</strong></div>
            <div className="aigm-progress"><span style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="aigm-actions">
            <button type="button" className="aigm-btn aigm-btn--primary" onClick={() => openStart('start')} disabled={!canStart || queue.not_queued === 0}>Bắt đầu chấm</button>
            <button type="button" className="aigm-btn" onClick={onViewResults} disabled={!onViewResults}>Xem kết quả</button>
            <button type="button" className="aigm-btn" onClick={onReview} disabled={!onReview || queue.needs_review === 0}>Cần xem lại</button>
            <button type="button" className="aigm-btn aigm-btn--soft" onClick={() => openStart('retry')} disabled={!canStart || retryable === 0}>Chấm lại</button>
          </div>
          <div className="aigm-usage"><span>AI Usage hôm nay</span><small>{data.usage?.available ? 'Có dữ liệu usage' : 'Usage chưa khả dụng'}</small><div><span /></div></div>
        </>
      ) : null}

      {message ? <p className="aigm-success">{message}</p> : null}

      {confirming ? (
        <div className="aigm-modal-backdrop" role="presentation" onClick={() => !starting && setConfirming(null)}>
          <div className="aigm-modal" role="dialog" aria-modal="true" aria-labelledby="aigm-confirm-title" onClick={(event) => event.stopPropagation()}>
            <h5 id="aigm-confirm-title">{confirming === 'retry' ? 'Chấm lại bài bằng AI?' : 'Bắt đầu AI chấm bài?'}</h5>
            <p>Bạn sắp {confirming === 'retry' ? 'đưa các bài lỗi/cần review vào hàng chờ chấm lại' : `bắt đầu AI chấm bài cho ${total} bài nộp`}.</p>
            <div className="aigm-confirm-stats"><span>Tổng <b>{total}</b></span><span>Chưa chấm <b>{queue.not_queued}</b></span><span>Đang chấm <b>{queue.processing}</b></span><span>Đã chấm <b>{queue.completed}</b></span><span>Cần review <b>{queue.needs_review}</b></span></div>
            <div className="aigm-modal-actions"><button type="button" className="aigm-btn" onClick={() => setConfirming(null)} disabled={starting}>Hủy</button><button type="button" className="aigm-btn aigm-btn--primary" onClick={() => void start()} disabled={starting}>{starting ? 'Đang đưa vào hàng chờ...' : 'Bắt đầu chấm'}</button></div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
