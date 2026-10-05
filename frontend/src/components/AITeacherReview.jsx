import { useCallback, useEffect, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './AITeacherReview.css'

function score(value) { return value === null || value === undefined || value === '' ? '—' : String(value) }
function loader(type, id) { return type === 'exam' ? classroomService.getExamGradingReview(id) : classroomService.getHomeworkGradingReview(id) }
function saver(type, id, payload) { return type === 'exam' ? classroomService.saveExamGradingReview(id, payload) : classroomService.saveHomeworkGradingReview(id, payload) }

export default function AITeacherReview({ type, submissionId }) {
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState([])
  const [loading, setLoading] = useState(Boolean(submissionId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    if (!submissionId) return
    setLoading(true)
    try {
      const next = await loader(type, submissionId)
      setData(next)
      setDraft((next.questions || []).map((question) => ({ question_id: question.question_id, question_number: question.question_number, teacher_score: question.teacher_score, teacher_comment: question.teacher_comment || '' })))
      setError('')
    } catch (err) { setError(err.message || 'Không tải được màn hình duyệt điểm.') } finally { setLoading(false) }
  }, [submissionId, type])
  useEffect(() => { void load() }, [load])
  const update = (index, key, value) => setDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  const save = async () => {
    if (saving || !data) return
    setSaving(true); setMessage(''); setError('')
    try { await saver(type, submissionId, { questions: draft.map((item) => ({ ...item, teacher_score: Number(item.teacher_score) })) }); setMessage('Đã lưu điểm cuối cùng.'); await load() }
    catch (err) { setError(err.message || 'Không lưu được điểm review.') }
    finally { setSaving(false) }
  }
  if (!submissionId) return null
  return <section className="air-teacher-review"><div className="air-review-head"><div><p className="air-label">TEACHER REVIEW</p><h3>Xác nhận điểm cuối cùng</h3></div>{data?.final_score_complete ? <span className="air-review-done">Đã xác nhận</span> : <span className="air-review-needed">Cần review</span>}</div>{loading ? <p className="air-muted">Đang tải bằng chứng và answer key...</p> : null}{error ? <div className="air-error"><p>{error}</p><button type="button" className="air-retry" onClick={() => void load()}>Thử lại</button></div> : null}{data && !loading && !error ? <><p className="air-review-help">Điểm AI được giữ nguyên. Hãy kiểm tra bài làm, answer key và rubric rồi xác nhận hoặc sửa điểm từng câu.</p><div className="air-review-questions">{data.questions.map((question, index) => { const item = draft[index] || {}; return <article className="air-review-question" key={question.question_id || question.question_number}><div className="air-review-qhead"><strong>Câu {question.question_number}</strong><span>AI: {score(question.ai_score)} / {score(question.ai_max_score)} · tin cậy {question.ai_confidence === null ? '—' : `${Math.round(Number(question.ai_confidence) * 100)}%`}</span></div><p className="air-review-question-text">{question.question_text}</p><div className="air-review-evidence"><b>Đáp án chuẩn</b><p>{question.expected_answer || 'Chưa có đáp án chuẩn.'}</p></div><ul className="air-review-rubric">{(question.rubric || []).map((criterion) => <li key={criterion.criterion}><span>{criterion.criterion}</span><small>{criterion.description} · tối đa {criterion.max_score}</small></li>)}</ul><p className="air-review-ai-comment">AI: {question.ai_comment || 'Không có nhận xét.'}</p><div className="air-review-inputs"><label>Điểm cuối<input type="number" min="0" max={question.ai_max_score} step="0.25" value={item.teacher_score ?? ''} onChange={(event) => update(index, 'teacher_score', event.target.value)} /></label><label>Nhận xét giáo viên<textarea rows="2" value={item.teacher_comment || ''} onChange={(event) => update(index, 'teacher_comment', event.target.value)} placeholder="Có thể ghi lý do giữ/sửa điểm..." /></label></div></article> })}</div><div className="air-review-total"><span>Tổng điểm cuối</span><strong>{draft.length ? draft.reduce((sum, item) => sum + (Number(item.teacher_score) || 0), 0) : 0} / {data.final_max_score}</strong></div>{message ? <p className="air-review-success">{message}</p> : null}<button type="button" className="air-review-save" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Xác nhận và lưu điểm cuối'}</button></> : null}</section>
}
