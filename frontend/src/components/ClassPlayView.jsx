import { useEffect, useMemo, useRef, useState } from 'react'
import { QuestionCard, SettingsModal, emptyQuestion } from './QuizArchivePanel.jsx'
import { EssayQuestionFields, emptyEssayDraft } from './EssayArchivePanel.jsx'

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
]

function badgeLabel(kind) {
  return kind === 'quiz' ? 'Trắc nghiệm' : 'Tự luận'
}

// "Tự chỉnh sửa" — full editor giống hệt Trắc nghiệm/Tự luận trong Kho lưu trữ,
// nhưng kết quả CHỈ được thêm vào lớp học hiện tại, không lưu vào Kho lưu trữ.
function CustomEditorModal({ onClose, onSave }) {
  const [tab, setTab] = useState('quiz')
  const [quizDraft, setQuizDraft] = useState(() => emptyQuestion())
  const [essayDraft, setEssayDraft] = useState(() => emptyEssayDraft())
  const [showQuizSettings, setShowQuizSettings] = useState(false)
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
    if (tab === 'quiz') {
      onSave({ id: uid(), kind: 'quiz', source: 'custom', question: quizDraft })
    } else {
      onSave({ id: uid(), kind: 'essay', source: 'custom', question: essayDraft })
    }
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
              <p className="quiz-card-kicker">Thêm câu hỏi</p>
              <h3 id={titleId}>Tự chỉnh sửa</h3>
            </div>
            <button type="button" className="archive-close" onClick={onClose} aria-label="Đóng">
              <IconClose />
            </button>
          </header>

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
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="quiz-settings-body">
            <p className="create-class-hint custom-editor-hint">
              Nội dung này chỉ dùng cho phòng hiện tại và sẽ không được lưu vào Kho lưu trữ.
            </p>
            {tab === 'quiz' ? (
              <QuestionCard
                index={0}
                question={quizDraft}
                onChange={setQuizDraft}
                onRemove={() => setQuizDraft(emptyQuestion())}
                onOpenSettings={() => setShowQuizSettings(true)}
              />
            ) : (
              <EssayQuestionFields draft={essayDraft} onChange={setEssayDraft} />
            )}
          </div>

          <footer className="quiz-settings-foot">
            <button type="button" className="quiz-ghost-btn" onClick={onClose}>
              Hủy
            </button>
            <button type="button" className="quiz-primary-btn" onClick={handleSave}>
              Lưu vào phòng
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

// "Chọn từ kho" — chọn 1 bản chỉnh sửa đã lưu, xem trước nội dung, có thể
// "Cài đặt lại" (chỉ áp dụng cục bộ, không tính vào Kho lưu trữ).
function ArchivePickerModal({ quizArchive, essayArchive, onClose, onConfirm }) {
  const [selected, setSelected] = useState(null)
  const [localQuestion, setLocalQuestion] = useState(null)
  const [showQuizSettings, setShowQuizSettings] = useState(false)
  const [showEssayReset, setShowEssayReset] = useState(false)
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
    ],
    [quizArchive, essayArchive]
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
    setShowEssayReset(false)
  }

  const back = () => {
    setSelected(null)
    setLocalQuestion(null)
    setShowEssayReset(false)
  }

  const isQuiz = selected?.kind === 'quiz'

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
                      <h4 className="essay-card-title">
                        {isQuiz
                          ? localQuestion.title || 'Câu hỏi trắc nghiệm'
                          : localQuestion.questionTitle || 'Câu hỏi tự luận'}
                      </h4>
                    </div>
                  </header>
                  {localQuestion.content ? <p className="essay-card-content">{localQuestion.content}</p> : null}

                  {!isQuiz ? (
                    <ul className="essay-preview-answers">
                      {localQuestion.answers
                        .filter((a) => a.content.trim())
                        .map((a) => (
                          <li key={a.id}>{a.content}</li>
                        ))}
                    </ul>
                  ) : null}

                  <div className="essay-card-meta">
                    {isQuiz ? (
                      <span>{localQuestion.answers.length} đáp án</span>
                    ) : (
                      <span>{localQuestion.answers.filter((a) => a.content.trim()).length} đáp án</span>
                    )}
                    <span>
                      {(isQuiz ? localQuestion.settings.countdownSeconds : localQuestion.countdownSeconds) > 0
                        ? `${isQuiz ? localQuestion.settings.countdownSeconds : localQuestion.countdownSeconds}s đếm ngược`
                        : 'Không đếm ngược'}
                    </span>
                  </div>

                  {!isQuiz && showEssayReset ? (
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
                    onClick={() => (isQuiz ? setShowQuizSettings(true) : setShowEssayReset((v) => !v))}
                  >
                    <IconGear />
                    Cài đặt lại
                  </button>
                  <button
                    type="button"
                    className="quiz-primary-btn"
                    onClick={() => onConfirm({ id: selected.id, kind: selected.kind, question: localQuestion })}
                  >
                    Thêm vào phòng
                  </button>
                </div>
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

export default function AddQuestionPanel({ quizArchive, essayArchive, questions, onQuestionsChange }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
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
    onQuestionsChange((prev) => [...prev, entry])
    setCustomOpen(false)
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
          {questions.map((q, idx) => (
            <div key={q.id} className="class-question-card">
              <div className="class-question-info">
                <span className={`archive-picker-badge is-${q.kind}`}>{badgeLabel(q.kind)}</span>
                <span className="class-question-title">
                  {idx + 1}.{' '}
                  {q.kind === 'quiz'
                    ? q.question.title || 'Câu hỏi trắc nghiệm'
                    : q.question.questionTitle || q.question.title || 'Câu hỏi tự luận'}
                </span>
                <span className="class-question-source">{q.source === 'archive' ? 'Từ kho' : 'Tự chỉnh sửa'}</span>
              </div>
              <button
                type="button"
                className="quiz-icon-btn"
                onClick={() => removeQuestion(q.id)}
                aria-label="Xóa câu hỏi khỏi phòng"
              >
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {customOpen ? <CustomEditorModal onClose={() => setCustomOpen(false)} onSave={addFromCustom} /> : null}
      {pickerOpen ? (
        <ArchivePickerModal
          quizArchive={quizArchive}
          essayArchive={essayArchive}
          onClose={() => setPickerOpen(false)}
          onConfirm={addFromArchive}
        />
      ) : null}
    </div>
  )
}
