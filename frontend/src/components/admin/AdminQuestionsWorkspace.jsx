import { useEffect, useState } from 'react'
import * as service from '../../services/adminContentService.js'

const typeLabels = { multiple_choice: 'Trắc nghiệm', true_false: 'Đúng / Sai', essay: 'Tự luận' }

export default function AdminQuestionsWorkspace({ toast }) {
  const [quizzes, setQuizzes] = useState([])
  const [selected, setSelected] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    service.listQuizzes()
      .then(setQuizzes)
      .catch((error) => toast.error(error.message || 'Không thể tải quiz.'))
      .finally(() => setLoading(false))
  }, [])

  const open = async (quiz) => {
    setSelected(quiz)
    try { setQuestions(await service.listQuestions(quiz.id)) }
    catch (error) { toast.error(error.message || 'Không thể tải câu hỏi.') }
  }

  const changeVisibility = async (quiz, isPublic) => {
    setBusy(`visibility:${quiz.id}`)
    try {
      const updated = await service.updateQuizVisibility(quiz.id, isPublic)
      setQuizzes((rows) => rows.map((row) => row.id === updated.id ? { ...row, ...updated } : row))
      setSelected((current) => current?.id === updated.id ? { ...current, ...updated } : current)
      toast.success(isPublic ? 'Quiz đã được công khai.' : 'Quiz đã chuyển về riêng tư.')
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật trạng thái quiz.')
    } finally { setBusy('') }
  }

  const save = async (event) => {
    event.preventDefault()
    setBusy(editing.id)
    try {
      const question = await service.updateQuestion(editing.id, editing)
      setQuestions((rows) => rows.map((row) => row.id === question.id ? question : row))
      setEditing(null)
      toast.success('Đã cập nhật câu hỏi.')
    } catch (error) { toast.error(error.message || 'Không thể cập nhật câu hỏi.') }
    finally { setBusy('') }
  }

  const remove = async (question) => {
    if (!window.confirm('Bạn có chắc muốn xóa câu hỏi này?')) return
    setBusy(question.id)
    try {
      await service.deleteQuestion(question.id)
      setQuestions((rows) => rows.filter((row) => row.id !== question.id))
      toast.success('Đã xóa câu hỏi.')
    } catch (error) { toast.error(error.message || 'Không thể xóa câu hỏi.') }
    finally { setBusy('') }
  }

  return <>
    <header className="browser-heading">
      <div><p className="browser-eyebrow">Question bank</p><h1>Quản lý các câu hỏi</h1><p>Chọn quiz để xem/sửa câu hỏi và đổi trạng thái công khai.</p></div>
      <span className="browser-stat"><strong>{quizzes.length}</strong><small>Bộ câu hỏi</small></span>
    </header>
    <section className="browser-panel">
      <div className="admin-quiz-grid">
        {loading ? <div className="admin-loading">Đang tải quiz…</div> : quizzes.map((quiz) => (
          <button type="button" className={`admin-quiz-card${selected?.id === quiz.id ? ' active' : ''}`} key={quiz.id} onClick={() => void open(quiz)}>
            <strong>{quiz.title}</strong>
            <span>{quiz.description || 'Không có mô tả'}</span>
            <small>{quiz.is_public ? 'Công khai' : 'Riêng tư'} · {quiz.question_count} câu · {quiz.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</small>
          </button>
        ))}
      </div>
      {selected && <div className="admin-question-list">
        <div className="admin-subheading">
          <h2>{selected.title}</h2>
          <label className="admin-quiz-visibility">
            <input type="checkbox" checked={selected.is_public === true} disabled={busy === `visibility:${selected.id}`} onChange={(event) => void changeVisibility(selected, event.target.checked)} />
            {busy === `visibility:${selected.id}` ? 'Đang lưu…' : 'Công khai cho mọi người sử dụng'}
          </label>
          <span>{questions.length} câu</span>
        </div>
        {questions.map((question, index) => <article className="admin-question-card" key={question.id}>
          <div>
            <span className="qz-badge">{index + 1} · {typeLabels[question.type] || question.type}</span>
            <h3>{question.content}</h3>
            {question.type === 'multiple_choice' && <ol type="A">{(question.options || []).map((option, optionIndex) => <li className={question.correct_option === optionIndex ? 'correct' : ''} key={`${question.id}-${optionIndex}`}>{option}</li>)}</ol>}
            {question.type === 'true_false' && <p>Đáp án: <strong>{question.correct_boolean ? 'Đúng' : 'Sai'}</strong></p>}
            {question.type === 'essay' && question.reference_answer && <p>Đáp án tham khảo: {question.reference_answer}</p>}
            {question.explanation && <p>Giải thích: {question.explanation}</p>}
          </div>
          <div className="account-row-actions"><button className="button button-quiet" type="button" onClick={() => setEditing({ ...question })}>Sửa</button><button className="button button-danger" type="button" onClick={() => void remove(question)} disabled={busy === question.id}>Xóa</button></div>
        </article>)}
        {!questions.length && <div className="account-empty">Quiz chưa có câu hỏi.</div>}
      </div>}
    </section>
    {editing && <div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={(event) => void save(event)}>
      <h2>Sửa câu hỏi</h2>
      <label>Nội dung<textarea value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} /></label>
      <label>Giải thích<textarea value={editing.explanation || ''} onChange={(event) => setEditing({ ...editing, explanation: event.target.value })} /></label>
      {editing.type === 'multiple_choice' && <>
        <label>Đáp án (mỗi dòng một lựa chọn)<textarea value={(editing.options || []).join('\n')} onChange={(event) => setEditing({ ...editing, options: event.target.value.split('\n') })} /></label>
        <label>Đáp án đúng (A=0)<input type="number" min="0" value={editing.correct_option ?? 0} onChange={(event) => setEditing({ ...editing, correct_option: Number(event.target.value) })} /></label>
      </>}
      {editing.type === 'true_false' && <label>Đáp án đúng<select value={String(editing.correct_boolean)} onChange={(event) => setEditing({ ...editing, correct_boolean: event.target.value === 'true' })}><option value="true">Đúng</option><option value="false">Sai</option></select></label>}
      {editing.type === 'essay' && <label>Đáp án tham khảo<textarea value={editing.reference_answer || ''} onChange={(event) => setEditing({ ...editing, reference_answer: event.target.value })} /></label>}
      <div className="admin-modal-actions"><button type="button" className="button button-quiet" onClick={() => setEditing(null)}>Hủy</button><button type="submit" className="button button-primary" disabled={busy === editing.id}>Lưu</button></div>
    </form></div>}
  </>
}
