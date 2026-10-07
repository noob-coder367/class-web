import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useToast } from '../../context/ToastContext.jsx'
import { createQuestion, hasErrors, questionFromApi, toPayload, validateDraft } from '../../lib/questionModel.js'
import { initialDraft, questionListReducer, quizDraftReducer } from '../../lib/quizDraftReducer.js'
import { describeApiError, saveQuiz } from '../../services/quizService.js'
import AIQuestionGenerator from './AIQuestionGenerator.jsx'
import AIQuestionPreview from './AIQuestionPreview.jsx'
import QuestionList from './QuestionList.jsx'
import QuestionTypeSelector from './QuestionTypeSelector.jsx'
import QuizMetaForm from './QuizMetaForm.jsx'

const initDraft = (quiz) => (quiz ? quizDraftReducer(initialDraft, { type: 'load', quiz }) : initialDraft)

/** Điều phối state của trang tạo phòng: metadata, danh sách câu hỏi, AI preview, trạng thái lưu. */
export default function QuizBuilder({ quizId, initialQuiz }) {
  const toast = useToast()
  const [draft, dispatch] = useReducer(quizDraftReducer, initialQuiz, initDraft)
  const [preview, previewDispatch] = useReducer(questionListReducer, [])
  const [previewMeta, setPreviewMeta] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const errors = useMemo(() => validateDraft(draft), [draft])

  useEffect(() => {
    if (!draft.dirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft.dirty])

  const addQuestion = (type) => {
    dispatch({ type: 'add', question: createQuestion(type) })
    setShowAdd(false)
  }

  const handleGenerated = (questions, meta) => {
    previewDispatch({ type: 'replaceAll', questions: questions.map(questionFromApi) })
    setPreviewMeta(meta)
    toast.success(`AI tạo thành công ${questions.length} câu hỏi. Hãy kiểm tra trước khi thêm.`)
  }

  const acceptOne = (question) => {
    dispatch({ type: 'add', question })
    previewDispatch({ type: 'remove', key: question.key })
  }

  const acceptAll = () => {
    dispatch({ type: 'addMany', questions: preview })
    previewDispatch({ type: 'clear' })
    toast.success('Đã thêm câu hỏi vào phòng. Nhớ bấm "Lưu phòng".')
  }

  const save = async () => {
    if (savingRef.current) return // chặn bấm đúp
    setShowErrors(true)
    if (hasErrors(errors)) {
      toast.error(errors.summary || 'Còn thông tin chưa hợp lệ. Hãy kiểm tra các ô báo đỏ.')
      requestAnimationFrame(() => document.querySelector('[data-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      await saveQuiz(quizId, toPayload(draft))
      dispatch({ type: 'saved' })
      toast.success('Đã lưu phòng.')
    } catch (error) {
      toast.error(describeApiError(error, 'Không lưu được phòng. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="qz-builder">
      <QuizMetaForm
        title={draft.title}
        description={draft.description}
        errors={showErrors ? errors : null}
        onChange={(field, value) => dispatch({ type: 'meta', field, value })}
      />

      <div className="qz-toolbar">
        <button type="button" className="qz-btn qz-btn-secondary" aria-expanded={showAdd} onClick={() => setShowAdd((open) => !open)}>
          + Thêm câu hỏi
        </button>
      </div>
      {showAdd && (
        <div className="qz-panel qz-add">
          <span className="qz-label">Chọn loại câu hỏi</span>
          <QuestionTypeSelector value={null} onChange={addQuestion} label="Loại câu hỏi muốn thêm" />
        </div>
      )}

      <AIQuestionGenerator onGenerated={handleGenerated} disabled={saving} />
      <AIQuestionPreview
        questions={preview}
        meta={previewMeta}
        dispatch={previewDispatch}
        onAccept={acceptOne}
        onAcceptAll={acceptAll}
        onDiscard={() => previewDispatch({ type: 'clear' })}
      />

      <section aria-label="Danh sách câu hỏi">
        <h2 className="qz-section-title">Câu hỏi trong phòng <span className="qz-muted">({draft.questions.length})</span></h2>
        {showErrors && errors.summary && <p className="qz-error" role="alert">{errors.summary}</p>}
        <QuestionList questions={draft.questions} errors={showErrors ? errors.questions : null} dispatch={dispatch} />
      </section>

      <div className="qz-savebar">
        <span className="qz-muted">{draft.dirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ'}</span>
        <button type="button" className="qz-btn qz-btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Đang lưu...' : 'Lưu phòng'}
        </button>
      </div>
    </div>
  )
}
