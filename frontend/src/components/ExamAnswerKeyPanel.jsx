import { useEffect, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './ExamAnswerKeyPanel.css'

const makeId = () => globalThis.crypto?.randomUUID?.() || `question-${Date.now()}-${Math.random().toString(36).slice(2)}`

function newRubric() {
  return { criterion: '', max_score: '1', description: '' }
}

function newQuestion(number) {
  return {
    id: makeId(),
    question_number: number,
    question_text: '',
    max_score: '2',
    expected_answer: '',
    rubric: [newRubric()],
  }
}

function cloneQuestions(value) {
  return (Array.isArray(value) ? value : []).map((question, index) => ({
    id: question.id || question.question_id || makeId(),
    question_number: Number(question.question_number) || index + 1,
    question_text: question.question_text || '',
    max_score: question.max_score ?? '',
    expected_answer: question.expected_answer || '',
    rubric: (Array.isArray(question.rubric) ? question.rubric : []).map((item) => ({
      criterion: item.criterion || '',
      max_score: item.max_score ?? '',
      description: item.description || '',
    })),
  }))
}

function validateQuestions(questions) {
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index]
    if (!question.question_text.trim()) return `Câu ${index + 1}: Vui lòng nhập nội dung câu hỏi.`
    const maxScore = Number(question.max_score)
    if (!Number.isFinite(maxScore) || maxScore <= 0) return `Câu ${index + 1}: Điểm tối đa phải lớn hơn 0.`
    if (!question.expected_answer.trim()) return `Câu ${index + 1}: Vui lòng nhập đáp án đúng.`
    if (!question.rubric.length) return `Câu ${index + 1}: Cần ít nhất một tiêu chí rubric.`
    let rubricTotal = 0
    for (let rubricIndex = 0; rubricIndex < question.rubric.length; rubricIndex += 1) {
      const item = question.rubric[rubricIndex]
      const score = Number(item.max_score)
      if (!item.criterion.trim()) return `Câu ${index + 1}, tiêu chí ${rubricIndex + 1}: Vui lòng nhập tiêu chí.`
      if (!Number.isFinite(score) || score <= 0) return `Câu ${index + 1}, tiêu chí ${rubricIndex + 1}: Điểm phải lớn hơn 0.`
      if (!item.description.trim()) return `Câu ${index + 1}, tiêu chí ${rubricIndex + 1}: Vui lòng nhập mô tả.`
      rubricTotal += score
    }
    if (rubricTotal > maxScore + 1e-9) return `Câu ${index + 1}: Tổng điểm rubric không được vượt quá điểm tối đa.`
  }
  return ''
}

function serializeQuestions(questions) {
  return questions.map((question, index) => ({
    id: question.id,
    question_number: index + 1,
    question_text: question.question_text.trim(),
    max_score: Number(question.max_score),
    expected_answer: question.expected_answer.trim(),
    rubric: question.rubric.map((item) => ({
      criterion: item.criterion.trim(),
      max_score: Number(item.max_score),
      description: item.description.trim(),
    })),
  }))
}

export default function ExamAnswerKeyPanel({ examId = null, initialQuestions, onChange, onSaved, onClose }) {
  const [questions, setQuestions] = useState(() => cloneQuestions(initialQuestions))
  const [loading, setLoading] = useState(Boolean(examId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    if (!examId) {
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    classroomService.getExamAnswerKey(examId)
      .then((result) => {
        if (active) setQuestions(cloneQuestions(result.questions))
      })
      .catch((err) => {
        if (active) setError(err.message || 'Không tải được đáp án và rubric.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [examId])

  const updateQuestions = (next) => {
    setQuestions(next)
    onChange?.(next)
    setError('')
    setMessage('')
  }

  const updateQuestion = (index, field, value) => {
    const next = questions.map((question, questionIndex) => questionIndex === index ? { ...question, [field]: value } : question)
    updateQuestions(next)
  }

  const updateRubric = (questionIndex, rubricIndex, field, value) => {
    const next = questions.map((question, index) => index !== questionIndex ? question : {
      ...question,
      rubric: question.rubric.map((item, itemIndex) => itemIndex === rubricIndex ? { ...item, [field]: value } : item),
    })
    updateQuestions(next)
  }

  const addQuestion = () => updateQuestions([...questions, newQuestion(questions.length + 1)])
  const removeQuestion = (index) => updateQuestions(questions.filter((_, questionIndex) => questionIndex !== index).map((question, questionIndex) => ({ ...question, question_number: questionIndex + 1 })))
  const addRubric = (questionIndex) => updateQuestions(questions.map((question, index) => index === questionIndex ? { ...question, rubric: [...question.rubric, newRubric()] } : question))
  const removeRubric = (questionIndex, rubricIndex) => updateQuestions(questions.map((question, index) => index === questionIndex ? { ...question, rubric: question.rubric.filter((_, itemIndex) => itemIndex !== rubricIndex) } : question))

  const save = async () => {
    const validationError = validateQuestions(questions)
    if (validationError) return setError(validationError)
    if (!examId) {
      onChange?.(serializeQuestions(questions))
      onClose?.()
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await classroomService.saveExamAnswerKey(examId, serializeQuestions(questions))
      setQuestions(cloneQuestions(result.questions))
      setMessage('Đã lưu đáp án và rubric.')
      onSaved?.(result)
    } catch (err) {
      setError(err.message || 'Không lưu được đáp án và rubric.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="answer-key-panel" aria-label="Đáp án và rubric">
      <header className="answer-key-head">
        <div>
          <h3>Đáp án &amp; Rubric</h3>
          <p>Thiết lập đáp án chuẩn để AI có thể chấm bài theo từng tiêu chí.</p>
        </div>
        {onClose ? <button type="button" className="answer-key-close" onClick={onClose} disabled={saving} aria-label="Đóng">✕</button> : null}
      </header>
      {loading ? <p className="answer-key-muted">Đang tải đáp án…</p> : null}
      {!loading ? <>
        <div className="answer-key-toolbar">
          <button type="button" className="answer-key-soft-btn" onClick={addQuestion}>＋ Thêm câu hỏi</button>
          {!questions.length ? <span className="answer-key-muted">Chưa có câu hỏi. Có thể lưu rỗng và bổ sung sau.</span> : null}
        </div>
        <div className="answer-key-list">
          {questions.map((question, questionIndex) => (
            <article className="answer-key-card" key={question.id}>
              <div className="answer-key-card-head"><strong>Câu {questionIndex + 1}</strong><button type="button" className="answer-key-delete" onClick={() => removeQuestion(questionIndex)}>Xóa</button></div>
              <label>Nội dung câu hỏi *<textarea value={question.question_text} onChange={(event) => updateQuestion(questionIndex, 'question_text', event.target.value)} placeholder="Nhập nội dung câu hỏi…" /></label>
              <div className="answer-key-grid">
                <label>Điểm tối đa *<input type="number" min="0.01" step="0.25" value={question.max_score} onChange={(event) => updateQuestion(questionIndex, 'max_score', event.target.value)} /></label>
                <label>Đáp án đúng *<textarea value={question.expected_answer} onChange={(event) => updateQuestion(questionIndex, 'expected_answer', event.target.value)} placeholder="Nhập đáp án / ý chính…" /></label>
              </div>
              <div className="answer-key-rubric-head"><strong>Rubric</strong><button type="button" className="answer-key-soft-btn" onClick={() => addRubric(questionIndex)}>＋ Thêm tiêu chí</button></div>
              {question.rubric.map((item, rubricIndex) => (
                <div className="answer-key-rubric" key={`${question.id}-${rubricIndex}`}>
                  <label>Tiêu chí *<input value={item.criterion} onChange={(event) => updateRubric(questionIndex, rubricIndex, 'criterion', event.target.value)} placeholder="Ví dụ: Kết quả đúng" /></label>
                  <label>Điểm *<input type="number" min="0.01" step="0.25" value={item.max_score} onChange={(event) => updateRubric(questionIndex, rubricIndex, 'max_score', event.target.value)} /></label>
                  <label className="answer-key-rubric-description">Mô tả *<textarea value={item.description} onChange={(event) => updateRubric(questionIndex, rubricIndex, 'description', event.target.value)} placeholder="Mô tả điều kiện đạt tiêu chí…" /></label>
                  <button type="button" className="answer-key-remove-rubric" onClick={() => removeRubric(questionIndex, rubricIndex)} aria-label="Xóa tiêu chí">×</button>
                </div>
              ))}
            </article>
          ))}
        </div>
        {error ? <p className="answer-key-error">{error}</p> : null}
        {message ? <p className="answer-key-success">{message}</p> : null}
        <footer className="answer-key-actions">
          {onClose ? <button type="button" className="answer-key-cancel" onClick={onClose} disabled={saving}>Hủy</button> : null}
          <button type="button" className="answer-key-save" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu đáp án'}</button>
        </footer>
      </> : null}
    </section>
  )
}
