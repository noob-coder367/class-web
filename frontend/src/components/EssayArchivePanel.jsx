import { useEffect, useRef, useState } from 'react'

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
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

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 13h10l1-13" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="M21 16.5 16 12l-3.2 3.2L10 13l-7 6" />
    </svg>
  )
}

function readImageFile(file) {
  if (!file) return { error: 'Không tìm thấy tập tin.' }
  if (!file.type.startsWith('image/')) return { error: 'Vui lòng chọn một tập tin ảnh.' }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.' }
  return { file }
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Không đọc được ảnh.'))
    reader.readAsDataURL(file)
  })
}

// Ảnh minh hoạ (tùy chọn) cho NỘI DUNG câu hỏi tự luận — không phải ảnh đáp án.
function QuestionImageDrop({ image, name, onPick, onClear }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const applyFile = (file) => {
    const result = readImageFile(file)
    if (result.error) {
      setError(result.error)
      return
    }
    setError('')
    onPick(result.file)
  }

  return (
    <div className="quiz-drop quiz-drop--question">
      <input
        ref={inputRef}
        className="create-class-file"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) applyFile(file)
        }}
      />
      {image ? (
        <div className="quiz-drop-preview">
          <img src={image} alt={name || 'Ảnh minh hoạ câu hỏi'} />
          <div className="quiz-drop-preview-meta">
            <p>{name || 'Ảnh minh hoạ câu hỏi'}</p>
            <div className="create-class-cover-actions">
              <button type="button" className="create-class-ghost" onClick={() => inputRef.current?.click()}>
                Đổi ảnh
              </button>
              <button type="button" className="create-class-ghost" onClick={onClear}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`quiz-drop-zone${dragOver ? ' is-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) applyFile(file)
          }}
        >
          <IconImage />
          <span>Kéo thả ảnh vào đây hoặc bấm để chọn (tùy chọn)</span>
        </button>
      )}
      {error ? <p className="create-class-error">{error}</p> : null}
    </div>
  )
}

export function emptyEssayAnswer() {
  return { id: uid(), content: '', isCorrect: false }
}

export function emptyEssayDraft() {
  return {
    id: uid(),
    title: '',
    questionTitle: '',
    content: '',
    imageName: '',
    imagePreview: '',
    imagePosition: 'top',
    answers: [emptyEssayAnswer()],
    countdownSeconds: 0,
  }
}

// Shared body fields, reused both by the archive's own editor modal and by
// the "Tự chỉnh sửa" flow outside the archive.
export function EssayQuestionFields({ draft, onChange, titleInputRef }) {
  const patchAnswer = (id, patch) => {
    onChange({ ...draft, answers: draft.answers.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  }

  const addAnswer = () => {
    onChange({ ...draft, answers: [...draft.answers, emptyEssayAnswer()] })
  }

  const removeAnswer = (id) => {
    if (draft.answers.length <= 1) return
    onChange({ ...draft, answers: draft.answers.filter((a) => a.id !== id) })
  }

  return (
    <>
      <label className="quiz-field">
        <span>Tiêu đề bản chỉnh sửa</span>
        <input
          ref={titleInputRef}
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Ví dụ: Đề tự luận số 1"
          autoComplete="off"
        />
      </label>

      <label className="quiz-field">
        <span>Tiêu đề câu hỏi</span>
        <input
          type="text"
          value={draft.questionTitle}
          onChange={(e) => onChange({ ...draft, questionTitle: e.target.value })}
          placeholder="Ví dụ: Câu 1 — Nghị luận xã hội"
          autoComplete="off"
        />
      </label>

      <label className="quiz-field">
        <span>Nội dung câu hỏi</span>
        <textarea
          rows={4}
          value={draft.content}
          onChange={(e) => onChange({ ...draft, content: e.target.value })}
          placeholder="Nhập nội dung câu hỏi tự luận"
        />
      </label>

      <div className="quiz-field quiz-question-image-field">
        <span>Ảnh minh hoạ cho câu hỏi (tùy chọn)</span>
        <QuestionImageDrop
          image={draft.imagePreview}
          name={draft.imageName}
          onPick={async (file) => {
            try {
              const dataUrl = await readImageAsDataUrl(file)
              onChange({ ...draft, imagePreview: dataUrl, imageName: file.name })
            } catch {
              // Người dùng có thể bấm chọn lại ảnh nếu đọc file thất bại.
            }
          }}
          onClear={() => onChange({ ...draft, imagePreview: '', imageName: '' })}
        />
      </div>

      {draft.imagePreview ? (
        <label className="quiz-field">
          <span>Vị trí ảnh</span>
          <select
            value={draft.imagePosition || 'top'}
            onChange={(e) => onChange({ ...draft, imagePosition: e.target.value })}
          >
            <option value="top">Trên</option>
            <option value="bottom">Dưới</option>
            <option value="left">Bên trái</option>
            <option value="right">Bên phải</option>
          </select>
          <p className="create-class-hint">
            {draft.imagePosition === 'left' || draft.imagePosition === 'right'
              ? 'Ảnh và nội dung câu hỏi chia đôi, nằm cạnh nhau.'
              : 'Ảnh nằm phía trên hoặc dưới nội dung câu hỏi.'}
          </p>
        </label>
      ) : null}

      <fieldset className="quiz-fieldset">
        <legend>Đáp án</legend>
        <div className="essay-answers">
          {draft.answers.map((answer, idx) => (
            <div key={answer.id} className="essay-answer-item">
              <div className="quiz-answer-row essay-answer-row">
                <input
                  className="quiz-answer-content"
                  type="text"
                  value={answer.content}
                  onChange={(e) => patchAnswer(answer.id, { content: e.target.value })}
                  placeholder={`Đáp án ${idx + 1}`}
                  aria-label={`Đáp án ${idx + 1}`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="quiz-icon-btn"
                  onClick={() => removeAnswer(answer.id)}
                  disabled={draft.answers.length <= 1}
                  aria-label={`Xóa đáp án ${idx + 1}`}
                >
                  <IconTrash />
                </button>
              </div>
              <label className="quiz-answer-correct">
                <input
                  type="checkbox"
                  checked={!!answer.isCorrect}
                  onChange={(e) => patchAnswer(answer.id, { isCorrect: e.target.checked })}
                />
                <span>Đáp án đúng</span>
              </label>
            </div>
          ))}
        </div>
        <button type="button" className="quiz-secondary-btn essay-add-answer" onClick={addAnswer}>
          <IconPlus />
          Thêm đáp án
        </button>
      </fieldset>

      <label className="quiz-field">
        <span>Thời gian đếm ngược (giây)</span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={draft.countdownSeconds}
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange({
              ...draft,
              countdownSeconds: Number.isFinite(n) ? Math.max(0, Math.min(3600, Math.round(n))) : 0,
            })
          }}
        />
        <p className="create-class-hint">
          {draft.countdownSeconds > 0
            ? `Tự chuyển sang câu tiếp theo sau ${draft.countdownSeconds} giây.`
            : 'Để 0 nếu không tự chuyển câu.'}
        </p>
      </label>
    </>
  )
}

function EssayEditorModal({ initial, onClose, onSave }) {
  const [draft, setDraft] = useState(() =>
    initial
      ? { ...initial, answers: initial.answers.map((a) => ({ ...a })) }
      : emptyEssayDraft()
  )
  const titleRef = useRef(null)
  const titleId = `essay-editor-title-${draft.id}`

  useEffect(() => {
    const id = window.requestAnimationFrame(() => titleRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const canSave = draft.title.trim().length > 0

  return (
    <div
      className="quiz-settings-overlay essay-editor-overlay"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="quiz-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="quiz-settings-head">
          <div>
            <p className="quiz-card-kicker">Tự luận</p>
            <h3 id={titleId}>{initial ? 'Sửa bản chỉnh sửa' : 'Thêm bản chỉnh sửa'}</h3>
          </div>
          <button type="button" className="archive-close" onClick={onClose} aria-label="Đóng">
            <IconClose />
          </button>
        </header>

        <div className="quiz-settings-body">
          <EssayQuestionFields draft={draft} onChange={setDraft} titleInputRef={titleRef} />
        </div>

        <footer className="quiz-settings-foot">
          <button type="button" className="quiz-ghost-btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="quiz-primary-btn" disabled={!canSave} onClick={() => onSave(draft)}>
            Lưu chỉnh sửa
          </button>
        </footer>
      </div>
    </div>
  )
}

export default function EssayArchivePanel({ questions, onQuestionsChange }) {
  const [editing, setEditing] = useState(null) // null | 'new' | question
  const items = questions
  const setItems = onQuestionsChange

  const saveDraft = (draft) => {
    setItems((prev) => {
      const exists = prev.some((q) => q.id === draft.id)
      return exists ? prev.map((q) => (q.id === draft.id ? draft : q)) : [...prev, draft]
    })
    setEditing(null)
  }

  const removeItem = (id) => {
    setItems((prev) => prev.filter((q) => q.id !== id))
  }

  return (
    <div className="quiz-panel essay-panel">
      <div className="essay-list">
        {items.length === 0 ? (
          <p className="quiz-empty-hint">Chưa có bản chỉnh sửa tự luận nào. Bấm “Thêm bản chỉnh sửa” để tạo mới.</p>
        ) : (
          items.map((q) => {
            const answerCount = q.answers.filter((a) => a.content.trim()).length
            return (
              <article key={q.id} className="quiz-card essay-card">
                <header className="quiz-card-head">
                  <div className="essay-card-heading">
                    <p className="quiz-card-kicker">{q.title || 'Chưa đặt tiêu đề'}</p>
                    <h4 className="essay-card-title">{q.questionTitle || 'Câu hỏi tự luận'}</h4>
                  </div>
                  <div className="essay-card-actions">
                    <button type="button" className="quiz-icon-btn" onClick={() => setEditing(q)} aria-label="Sửa bản chỉnh sửa">
                      <IconPencil />
                    </button>
                    <button type="button" className="quiz-icon-btn" onClick={() => removeItem(q.id)} aria-label="Xóa bản chỉnh sửa">
                      <IconTrash />
                    </button>
                  </div>
                </header>
                {q.content ? <p className="essay-card-content">{q.content}</p> : null}
                <div className="essay-card-meta">
                  <span>{answerCount > 0 ? `${answerCount} đáp án` : 'Chưa có đáp án'}</span>
                  <span>{q.countdownSeconds > 0 ? `${q.countdownSeconds}s đếm ngược` : 'Không đếm ngược'}</span>
                </div>
              </article>
            )
          })
        )}
      </div>

      <button type="button" className="quiz-add-revision" onClick={() => setEditing('new')}>
        <IconPlus />
        Thêm bản chỉnh sửa
      </button>

      {editing ? (
        <EssayEditorModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={saveDraft}
        />
      ) : null}
    </div>
  )
}
