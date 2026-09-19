import { useEffect, useMemo, useRef, useState } from 'react'
import { QuestionCard, SettingsModal, emptyQuestion } from './QuizArchivePanel.jsx'
import { EssayQuestionFields, emptyEssayDraft } from './EssayArchivePanel.jsx'
import {
  TrueFalseQuestionFields,
  emptyTrueFalseDraft,
  statementLabel,
} from './TrueFalseArchivePanel.jsx'

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `cq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function IconChevron({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 13h10l1-13" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5 L8 12 L15 19" />
    </svg>
  )
}

const CUSTOM_TABS = [
  { id: 'quiz', label: 'Trắc nghiệm' },
  { id: 'essay', label: 'Tự luận' },
  { id: 'truefalse', label: 'Đúng/Sai' },
]

export function badgeLabel(kind) {
  if (kind === 'quiz') return 'Trắc nghiệm'
  if (kind === 'truefalse') return 'Đúng/Sai'
  return 'Tự luận'
}

export function questionHeading(kind, question) {
  if (kind === 'quiz') return question?.title || 'Câu hỏi trắc nghiệm'
  if (kind === 'truefalse') return question?.questionTitle || question?.title || 'Câu hỏi đúng/sai'
  return question?.questionTitle || question?.title || 'Câu hỏi tự luận'
}

function countdownOf(kind, question) {
  if (kind === 'quiz') return question?.settings?.countdownSeconds || 0
  return question?.countdownSeconds || 0
}

function answerHasContent(answer) {
  return !!(String(answer?.content || '').trim() || answer?.imagePreview)
}

/** Lỗi nếu câu hỏi chưa có đáp án đúng (không rỗng). Chuỗi rỗng = hợp lệ. */
export function classQuestionKeyError(kind, question) {
  if (kind === 'quiz') {
    const answers = question?.answers || []
    if (answers.some((a) => a.isCorrect && answerHasContent(a))) return ''
    if (answers.some((a) => a.isCorrect)) return 'Đáp án đúng không được để trống.'
    if (!answers.some(answerHasContent)) return 'Phải có ít nhất 1 đáp án, không được để trống.'
    return 'Phải đánh dấu ít nhất 1 đáp án đúng.'
  }
  if (kind === 'essay') {
    const answers = question?.answers || []
    if (answers.some((a) => a.isCorrect && String(a.content || '').trim())) return ''
    if (answers.some((a) => a.isCorrect)) return 'Đáp án đúng không được để trống.'
    if (!answers.some((a) => String(a.content || '').trim())) {
      return 'Phải có ít nhất 1 đáp án, không được để trống.'
    }
    return 'Phải đánh dấu ít nhất 1 đáp án đúng.'
  }
  if (kind === 'truefalse') {
    const filled = (question?.statements || []).filter((s) => String(s.content || '').trim())
    if (!filled.length) return 'Phải có ít nhất 1 ý, không được để trống.'
    return ''
  }
  return ''
}

export function classQuestionsKeyError(questions) {
  const problems = []
  ;(questions || []).forEach((entry, i) => {
    const err = classQuestionKeyError(entry?.kind, entry?.question)
    if (err) problems.push(`Câu ${i + 1} (${badgeLabel(entry?.kind)}): ${err}`)
  })
  return problems.join(' ')
}

function CustomEditorModal({ onClose, onSave, editEntry }) {
  const isEditing = !!editEntry
  const [tab, setTab] = useState(editEntry?.kind || 'quiz')
  const [quizDraft, setQuizDraft] = useState(() =>
    editEntry?.kind === 'quiz' ? editEntry.question : emptyQuestion()
  )
  const [essayDraft, setEssayDraft] = useState(() =>
    editEntry?.kind === 'essay' ? editEntry.question : emptyEssayDraft()
  )
  const [trueFalseDraft, setTrueFalseDraft] = useState(() =>
    editEntry?.kind === 'truefalse' ? editEntry.question : emptyTrueFalseDraft()
  )
  const [showQuizSettings, setShowQuizSettings] = useState(false)
  const [saveError, setSaveError] = useState('')
  const titleId = 'custom-editor-title'

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.quiz-settings-overlay')) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const handleSave = () => {
    const kind = tab === 'quiz' ? 'quiz' : tab === 'truefalse' ? 'truefalse' : 'essay'
    const draft = kind === 'quiz' ? quizDraft : kind === 'truefalse' ? trueFalseDraft : essayDraft
    const err = classQuestionKeyError(kind, draft)
    if (err) {
      setSaveError(err)
      return
    }
    setSaveError('')
    const id = editEntry?.id || uid()
    const source = editEntry?.source || 'custom'
    const archiveId = editEntry?.archiveId
    onSave({ id, kind, source, ...(archiveId ? { archiveId } : {}), question: draft })
  }

  return (
    <>
      <div
        className="custom-editor-overlay"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <div
          className="custom-editor-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="quiz-settings-head">
            <div>
              <p className="quiz-card-kicker">{isEditing ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</p>
              <h3 id={titleId}>{isEditing ? 'Chỉnh sửa' : 'Tự chỉnh sửa'}</h3>
            </div>
            <button type="button" className="archive-close" onClick={onClose} aria-label="Đóng">
              <IconClose />
            </button>
          </header>

          {!isEditing ? (
            <div className="archive-tabstrip custom-editor-tabstrip" role="tablist" aria-label="Loại câu hỏi">
              {CUSTOM_TABS.map((t) => {
                const selected = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    className={`archive-tab${selected ? ' is-active' : ''}`}
                    onClick={() => {
                      setTab(t.id)
                      setSaveError('')
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          ) : null}

          <div className="quiz-settings-body">
            <p className="create-class-hint custom-editor-hint">
              {isEditing
                ? 'Chỉnh sửa nội dung câu hỏi này. Thay đổi chỉ áp dụng cho phòng hiện tại.'
                : 'Nội dung này chỉ dùng cho phòng hiện tại và sẽ không được lưu vào Kho lưu trữ.'}
            </p>
            {tab === 'quiz' ? (
              <QuestionCard
                index={0}
                question={quizDraft}
                onChange={setQuizDraft}
                onRemove={() => setQuizDraft(emptyQuestion())}
                onOpenSettings={() => setShowQuizSettings(true)}
              />
            ) : null}
            {tab === 'essay' ? <EssayQuestionFields draft={essayDraft} onChange={setEssayDraft} /> : null}
            {tab === 'truefalse' ? (
              <TrueFalseQuestionFields draft={trueFalseDraft} onChange={setTrueFalseDraft} />
            ) : null}
            {saveError ? <p className="create-class-error">{saveError}</p> : null}
          </div>

          <footer className="quiz-settings-foot">
            <button type="button" className="quiz-ghost-btn" onClick={onClose}>
              Hủy
            </button>
            <button type="button" className="quiz-primary-btn" onClick={handleSave}>
              {isEditing ? 'Lưu thay đổi' : 'Lưu vào phòng'}
            </button>
          </footer>
        </div>
      </div>

      {showQuizSettings ? (
        <SettingsModal
          question={quizDraft}
          onClose={() => setShowQuizSettings(false)}
          onSave={(settings) => {
            setQuizDraft((q) => ({ ...q, settings }))
            setShowQuizSettings(false)
          }}
        />
      ) : null}
    </>
  )
}

function ArchivePickerModal({ quizArchive, essayArchive, trueFalseArchive, onClose, onConfirm }) {
  const [selected, setSelected] = useState(null)
  const [localQuestion, setLocalQuestion] = useState(null)
  const [showQuizSettings, setShowQuizSettings] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [saveError, setSaveError] = useState('')
  const titleId = 'archive-picker-title'

  const items = useMemo(
    () => [
      ...quizArchive.map((q) => ({
        id: q.id,
        kind: 'quiz',
        title: q.title || 'Câu hỏi trắc nghiệm',
        subtitle: q.content || 'Chưa có nội dung',
        question: q,
      })),
      ...essayArchive.map((q) => ({
        id: q.id,
        kind: 'essay',
        title: q.title || 'Bản chỉnh sửa tự luận',
        subtitle: q.questionTitle || q.content || 'Chưa có nội dung',
        question: q,
      })),
      ...(trueFalseArchive || []).map((q) => ({
        id: q.id,
        kind: 'truefalse',
        title: q.title || 'Bản chỉnh sửa đúng/sai',
        subtitle: q.questionTitle || q.content || 'Chưa có nội dung',
        question: q,
      })),
    ],
    [quizArchive, essayArchive, trueFalseArchive]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.quiz-settings-overlay')) return
      e.preventDefault()
      e.stopPropagation()
      if (selected) {
        setSelected(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, selected])

  const pick = (item) => {
    setSelected(item)
    setLocalQuestion(item.question)
    setShowReset(false)
    setSaveError('')
  }

  const back = () => {
    setSelected(null)
    setLocalQuestion(null)
    setShowReset(false)
    setSaveError('')
  }

  const isQuiz = selected?.kind === 'quiz'
  const isTrueFalse = selected?.kind === 'truefalse'

  return (
    <>
      <div
        className="archive-picker-overlay"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <div
          className="archive-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="quiz-settings-head">
            <div>
              <p className="quiz-card-kicker">Thêm câu hỏi</p>
              <h3 id={titleId}>Chọn từ kho</h3>
            </div>
            <button type="button" className="archive-close" onClick={onClose} aria-label="Đóng">
              <IconClose />
            </button>
          </header>

          <div className="quiz-settings-body">
            {!selected ? (
              <div className="archive-picker-list">
                {items.length === 0 ? (
                  <p className="quiz-empty-hint">
                    Kho lưu trữ chưa có bản chỉnh sửa nào. Hãy thêm ở tab “Kho lưu trữ” trước.
                  </p>
                ) : (
                  items.map((item) => (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      className="archive-picker-item"
                      onClick={() => pick(item)}
                    >
                      <span className={`archive-picker-badge is-${item.kind}`}>{badgeLabel(item.kind)}</span>
                      <span className="archive-picker-item-title">{item.title}</span>
                      <span className="archive-picker-item-sub">{item.subtitle}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="archive-picker-preview">
                <button type="button" className="quiz-ghost-btn archive-picker-back" onClick={back}>
                  <IconBack />
                  Quay lại danh sách
                </button>

                <article className="quiz-card essay-card">
                  <header className="quiz-card-head">
                    <div className="essay-card-heading">
                      <p className="quiz-card-kicker">{badgeLabel(selected.kind)}</p>
                      <h4 className="essay-card-title">{questionHeading(selected.kind, localQuestion)}</h4>
                    </div>
                  </header>
                  {localQuestion.content ? <p className="essay-card-content">{localQuestion.content}</p> : null}

                  {selected.kind === 'essay' ? (
                    <ul className="essay-preview-answers">
                      {(localQuestion.answers || [])
                        .filter((a) => a.content.trim())
                        .map((a) => (
                          <li key={a.id}>{a.content}</li>
                        ))}
                    </ul>
                  ) : null}

                  {isTrueFalse ? (
                    <ul className="essay-preview-answers">
                      {(localQuestion.statements || [])
                        .filter((s) => s.content.trim())
                        .map((s, i) => (
                          <li key={s.id}>
                            {statementLabel(i)}) {s.content}
                          </li>
                        ))}
                    </ul>
                  ) : null}

                  <div className="essay-card-meta">
                    {isQuiz ? (
                      <span>{(localQuestion.answers || []).length} đáp án</span>
                    ) : isTrueFalse ? (
                      <span>
                        {(localQuestion.statements || []).filter((s) => s.content.trim()).length} ý
                      </span>
                    ) : (
                      <span>{(localQuestion.answers || []).filter((a) => a.content.trim()).length} đáp án</span>
                    )}
                    <span>
                      {countdownOf(selected.kind, localQuestion) > 0
                        ? `${countdownOf(selected.kind, localQuestion)}s đếm ngược`
                        : 'Không đếm ngược'}
                    </span>
                  </div>

                  {!isQuiz && showReset ? (
                    <label className="quiz-field archive-picker-inline-setting">
                      <span>Thời gian đếm ngược (giây)</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={localQuestion.countdownSeconds}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          setLocalQuestion((q) => ({
                            ...q,
                            countdownSeconds: Number.isFinite(n) ? Math.max(0, Math.min(3600, Math.round(n))) : 0,
                          }))
                        }}
                      />
                      <p className="create-class-hint">Thay đổi này chỉ áp dụng cho phòng hiện tại, không lưu vào kho.</p>
                    </label>
                  ) : null}
                </article>

                <div className="archive-picker-actions">
                  <button
                    type="button"
                    className="quiz-settings-btn"
                    onClick={() => (isQuiz ? setShowQuizSettings(true) : setShowReset((v) => !v))}
                  >
                    <IconGear />
                    Cài đặt lại
                  </button>
                  <button
                    type="button"
                    className="quiz-primary-btn"
                    onClick={() => {
                      const err = classQuestionKeyError(selected.kind, localQuestion)
                      if (err) {
                        setSaveError(err)
                        return
                      }
                      setSaveError('')
                      onConfirm({ id: selected.id, kind: selected.kind, question: localQuestion })
                    }}
                  >
                    Thêm vào phòng
                  </button>
                </div>
                {saveError ? <p className="create-class-error">{saveError}</p> : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {isQuiz && showQuizSettings ? (
        <SettingsModal
          question={localQuestion}
          onClose={() => setShowQuizSettings(false)}
          onSave={(settings) => {
            setLocalQuestion((q) => ({ ...q, settings }))
            setShowQuizSettings(false)
          }}
        />
      ) : null}
    </>
  )
}

export default function AddQuestionPanel({
  quizArchive,
  essayArchive,
  trueFalseArchive,
  questions,
  onQuestionsChange,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!customOpen && !pickerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [customOpen, pickerOpen])

  const addFromCustom = (entry) => {
    if (editingEntry) {
      onQuestionsChange((prev) => prev.map((q) => (q.id === entry.id ? entry : q)))
    } else {
      onQuestionsChange((prev) => [...prev, entry])
    }
    setCustomOpen(false)
    setEditingEntry(null)
  }

  const addFromArchive = (entry) => {
    onQuestionsChange((prev) => [
      ...prev,
      { id: uid(), kind: entry.kind, source: 'archive', archiveId: entry.id, question: entry.question },
    ])
    setPickerOpen(false)
  }

  const removeQuestion = (id) => {
    onQuestionsChange((prev) => prev.filter((q) => q.id !== id))
  }

  const editQuestion = (entry) => {
    setEditingEntry(entry)
    setCustomOpen(true)
  }

  const closeCustomEditor = () => {
    setCustomOpen(false)
    setEditingEntry(null)
  }

  return (
    <div className="add-question-wrap" ref={wrapRef}>
      <button
        type="button"
        className="create-class-archive-btn add-question-btn"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <IconPlus />
        Thêm câu hỏi
        <IconChevron className={`add-question-chevron${menuOpen ? ' is-open' : ''}`} />
      </button>

      {menuOpen ? (
        <div className="add-question-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="add-question-menu-item"
            onClick={() => {
              setCustomOpen(true)
              setMenuOpen(false)
            }}
          >
            <span className="add-question-menu-title">Tự chỉnh sửa</span>
            <span className="add-question-menu-desc">Soạn câu hỏi mới, không lưu vào kho</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="add-question-menu-item"
            onClick={() => {
              setPickerOpen(true)
              setMenuOpen(false)
            }}
          >
            <span className="add-question-menu-title">Chọn từ kho</span>
            <span className="add-question-menu-desc">Dùng lại bản chỉnh sửa đã lưu</span>
          </button>
        </div>
      ) : null}

      {questions.length > 0 ? (
        <div className="class-questions-list">
          {questions.map((q, idx) => {
            const keyErr = classQuestionKeyError(q.kind, q.question)
            return (
            <div key={q.id} className={`class-question-card${keyErr ? ' is-invalid' : ''}`}>
              <div className="class-question-info">
                <span className={`archive-picker-badge is-${q.kind}`}>{badgeLabel(q.kind)}</span>
                <span className="class-question-title">
                  {idx + 1}. {questionHeading(q.kind, q.question)}
                </span>
                <span className="class-question-source">{q.source === 'archive' ? 'Từ kho' : 'Tự chỉnh sửa'}</span>
                {keyErr ? <span className="class-question-error">{keyErr}</span> : null}
              </div>
              <div className="class-question-actions">
                <button
                  type="button"
                  className="quiz-icon-btn"
                  onClick={() => editQuestion(q)}
                  aria-label="Sửa câu hỏi"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="quiz-icon-btn"
                  onClick={() => removeQuestion(q.id)}
                  aria-label="Xóa câu hỏi khỏi phòng"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
            )
          })}
        </div>
      ) : null}

      {customOpen ? (
        <CustomEditorModal onClose={closeCustomEditor} onSave={addFromCustom} editEntry={editingEntry} />
      ) : null}
      {pickerOpen ? (
        <ArchivePickerModal
          quizArchive={quizArchive}
          essayArchive={essayArchive}
          trueFalseArchive={trueFalseArchive}
          onClose={() => setPickerOpen(false)}
          onConfirm={addFromArchive}
        />
      ) : null}
    </div>
  )
}
