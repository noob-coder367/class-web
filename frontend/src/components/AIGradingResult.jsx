import { useCallback, useEffect, useRef, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './AIGradingResult.css'

const POLL_MS = 8_000
const MAX_POLLS = 45

const STATUS_LABEL = {
  pending: 'Đang chờ AI xử lý',
  processing: 'Đang chấm...',
  completed: 'Đã chấm',
  graded: 'Đã chấm',
  needs_review: 'Cần giáo viên xem lại',
  unreadable: 'Không đọc rõ — cần xem lại',
  failed: 'Chấm thất bại',
  rate_limited: 'Đang chờ hệ thống AI',
  not_queued: 'Chưa có kết quả chấm AI',
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : '—'
}

function statusOf(result) {
  if (!result) return 'not_queued'
  if (result.grading_status === 'needs_review' || result.status === 'needs_review') return 'needs_review'
  if (result.status === 'pending') return 'pending'
  if (result.status === 'processing') return 'processing'
  if (result.status === 'rate_limited') return 'rate_limited'
  if (result.status === 'failed') return 'failed'
  if (result.grading_status === 'graded' || result.status === 'completed') return 'graded'
  return result.status || 'not_queued'
}

function resultLoader(type, submissionId) {
  return type === 'exam'
    ? classroomService.getExamGradingResult(submissionId)
    : classroomService.getHomeworkGradingResult(submissionId)
}

function RubricItems({ items }) {
  if (!Array.isArray(items) || !items.length) return null
  return (
    <div className="air-rubric">
      <p className="air-label">Tiêu chí</p>
      <ul className="air-rubric-list">
        {items.map((item, index) => (
          <li key={`${item.criterion || 'criterion'}-${index}`} className="air-rubric-item">
            <span className="air-rubric-name">{item.criterion || 'Tiêu chí'}</span>
            <strong>{formatScore(item.score)} / {formatScore(item.max_score)}</strong>
            {item.comment ? <span className="air-rubric-comment">{item.comment}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SolutionSteps({ question }) {
  if (!Array.isArray(question.steps) || !question.steps.length) return null
  return (
    <div className="air-steps">
      <p className="air-label">Các bước AI đọc được</p>
      <ol className="air-step-list">
        {question.steps.map((step, index) => (
          <li key={`${step.step_number || index + 1}-${index}`} className="air-step">
            <strong>Bước {step.step_number || index + 1}</strong>
            {step.content ? <span>{step.content}</span> : null}
            {step.math_expression ? <code>{step.math_expression}</code> : null}
            {step.intermediate_result ? <small>Kết quả trung gian: {step.intermediate_result}</small> : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function AIGradingResult({ type, submissionId, title = 'Kết quả chấm AI' }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(Boolean(submissionId))
  const [error, setError] = useState('')
  const pollCount = useRef(0)
  const [pollTick, setPollTick] = useState(0)

  const load = useCallback(async () => {
    if (!submissionId) return
    try {
      const next = await resultLoader(type, submissionId)
      setResult(next)
      setError('')
    } catch (err) {
      setError(err.message || 'Không tải được kết quả chấm AI.')
    } finally {
      setLoading(false)
      setPollTick((tick) => tick + 1)
    }
  }, [submissionId, type])

  useEffect(() => {
    setResult(null)
    setError('')
    setLoading(Boolean(submissionId))
    pollCount.current = 0
    setPollTick(0)
    if (submissionId) void load()
  }, [load, submissionId])

  const status = statusOf(result)
  useEffect(() => {
    if (!['pending', 'processing', 'rate_limited'].includes(status) || pollCount.current >= MAX_POLLS) return undefined
    const timer = window.setTimeout(() => {
      pollCount.current += 1
      void load()
    }, POLL_MS)
    return () => window.clearTimeout(timer)
  }, [load, status, pollTick])

  if (!submissionId) return null

  return (
    <section className={`air-card air-card--${status}`} aria-live={status === 'processing' ? 'polite' : undefined}>
      <div className="air-head">
        <div>
          <p className="air-eyebrow">AI GRADING</p>
          <h3 className="air-title">{title}</h3>
        </div>
        <span className={`air-status air-status--${status}`}>{STATUS_LABEL[status] || status}</span>
      </div>

      {loading ? <p className="air-muted">Đang tải kết quả chấm...</p> : null}
      {error ? (
        <div className="air-error" role="alert">
          <p>{error}</p>
          <button type="button" className="air-retry" onClick={() => { setLoading(true); void load() }}>Thử lại</button>
        </div>
      ) : null}
      {!loading && !error && status === 'not_queued' ? <p className="air-muted">Bài nộp chưa được đưa vào hàng chờ chấm.</p> : null}
      {!loading && !error && ['pending', 'processing'].includes(status) ? <p className="air-muted">AI đang chấm bài...</p> : null}
      {!loading && !error && status === 'rate_limited' ? <p className="air-muted">Hệ thống AI đang quá tải; bài sẽ được xử lý lại tự động.</p> : null}
      {!loading && !error && ['pending', 'processing', 'rate_limited'].includes(status) && pollCount.current >= MAX_POLLS ? <p className="air-muted">Đã tạm dừng tự động cập nhật. Bấm thử lại để kiểm tra trạng thái mới.</p> : null}
      {!loading && !error && status === 'failed' ? <p className="air-error">Hệ thống không thể hoàn tất việc chấm bài. Vui lòng thử lại sau.</p> : null}

      {!loading && !error && status === 'needs_review' ? (
        <div className="air-review-banner">
          <strong>AI chưa thể chấm chắc chắn — đang chờ giáo viên kiểm tra.</strong>
          <span>{result.reason || 'Không đủ thông tin để AI chấm chính xác toàn bộ bài.'}</span>
        </div>
      ) : null}

      {!loading && !error && result ? (
        <>
          {result.total_score !== null && result.total_max_score !== null ? (
            <div className="air-total">
              <span>Điểm AI</span>
              <strong>{formatScore(result.total_score)} <small>/ {formatScore(result.total_max_score)}</small></strong>
              {result.total_score_complete === false ? <em>Chưa hoàn tất</em> : null}
            </div>
          ) : null}
          {result.final_score_complete && result.final_score !== null && result.final_max_score !== null ? (
            <div className="air-total air-total--final">
              <span>Điểm cuối cùng</span>
              <strong>{formatScore(result.final_score)} <small>/ {formatScore(result.final_max_score)}</small></strong>
            </div>
          ) : null}
          {Array.isArray(result.questions) && result.questions.length ? (
            <div className="air-questions">
              {result.questions.map((question, index) => {
                const questionNeedsReview = ['needs_review', 'unreadable'].includes(question.status) || question.readability === 'unreadable'
                const hasFinalScore = question.final_score !== null && question.final_score !== undefined
                return (
                  <article key={`${question.question_id || question.question_number || 'question'}-${index}`} className={`air-question${questionNeedsReview ? ' is-review' : ''}`}>
                    <div className="air-question-head">
                      <h4>Câu {question.question_number || index + 1}</h4>
                      <strong>{formatScore(hasFinalScore ? question.final_score : question.score)} <span>/ {formatScore(question.max_score)}</span></strong>
                    </div>
                    {hasFinalScore ? <p className="air-final-question">Điểm cuối · AI ban đầu: {formatScore(question.score)} / {formatScore(question.max_score)}</p> : null}
                    {question.status && question.status !== 'graded' ? <p className="air-question-status">{STATUS_LABEL[question.status] || question.status}</p> : null}
                    {question.comment ? <p className="air-comment">{question.comment}</p> : null}
                    {question.final_answer ? <p className="air-final-answer"><b>Đáp án cuối đọc được:</b> {question.final_answer}</p> : null}
                    <SolutionSteps question={question} />
                    <RubricItems items={question.rubric_items} />
                    {question.confidence !== null && question.confidence !== undefined ? (
                      <p className="air-confidence">Độ tin cậy: {Math.round(Number(question.confidence) * 100)}%</p>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
