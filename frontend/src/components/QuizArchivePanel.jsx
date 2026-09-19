import { useEffect, useMemo, useRef, useState } from 'react'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const ANSWER_COLORS = [
  { id: 'transparent', label: 'Trong suốt', bg: 'transparent', fg: '#14324a' },
  { id: 'navy', label: 'Xanh đậm', bg: '#14324a', fg: '#f8fafc' },
  { id: 'ocean', label: 'Xanh biển', bg: '#1a6b8a', fg: '#f8fafc' },
  { id: 'sky', label: 'Xanh trời', bg: '#38bdf8', fg: '#0f172a' },
  { id: 'cyan', label: 'Xanh ngọc', bg: '#06b6d4', fg: '#0f172a' },
  { id: 'indigo', label: 'Chàm', bg: '#4f46e5', fg: '#f8fafc' },
  { id: 'violet', label: 'Tím', bg: '#7c3aed', fg: '#f8fafc' },
  { id: 'pink', label: 'Hồng', bg: '#ec4899', fg: '#f8fafc' },
  { id: 'yellow', label: 'Vàng', bg: '#eab308', fg: '#0f172a' },
  { id: 'orange', label: 'Cam', bg: '#f59e0b', fg: '#0f172a' },
  { id: 'brown', label: 'Nâu', bg: '#92400e', fg: '#f8fafc' },
  { id: 'slate', label: 'Xám', bg: '#64748b', fg: '#f8fafc' },
  { id: 'white', label: 'Trắng', bg: '#ffffff', fg: '#14324a' },
  { id: 'ink', label: 'Đen', bg: '#0f172a', fg: '#f8fafc' },
]

export { ANSWER_COLORS }

export const DEFAULT_SETTINGS = {
  layout: 'row',
  allowAnswerImages: false,
  countdownSeconds: 0,
  answerColor: 'transparent',
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function answerLabel(index) {
  let n = index + 1
  let label = ''
  while (n > 0) {
    n -= 1
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26)
  }
  return label
}

export function colorOf(id) {
  return ANSWER_COLORS.find((c) => c.id === id) || ANSWER_COLORS[0]
}

// Dữ liệu cũ lưu 1 màu dùng chung cho cả câu (question.settings.answerColor).
// Nếu đáp án chưa có màu riêng, lấy tạm màu chung cũ đó để không bị mất màu.
export function answerColorOf(answer, settings) {
  return colorOf(answer?.color || settings?.answerColor)
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

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
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

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="M21 16.5 16 12l-3.2 3.2L10 13l-7 6" />
    </svg>
  )
}

export function emptyQuestion() {
  return {
    id: uid(),
    title: '',
    content: '',
    imageName: '',
    imagePreview: '',
    imagePosition: 'top',
    answers: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

function emptyAnswer(index) {
  return {
    id: uid(),
    label: answerLabel(index),
    content: '',
    imageName: '',
    imagePreview: '',
    isCorrect: false,
    color: 'transparent',
  }
}

function revokePreview(url) {
  // Ảnh đáp án giờ lưu dạng base64 (data URL), không còn là blob URL nữa nên
  // revokeObjectURL ở đây thực chất là no-op an toàn — giữ lại hàm để các nơi
  // gọi cũ (removeAnswer, removeQuestion...) không phải sửa thêm.
  if (url) URL.revokeObjectURL(url)
}

function readImageFile(file) {
  if (!file) return { error: 'Không tìm thấy tập tin.' }
  if (!file.type.startsWith('image/')) return { error: 'Vui lòng chọn một tập tin ảnh.' }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.' }
  return { file }
}

// Đọc file ảnh thành base64 để lưu bền qua localStorage (xem giải thích tương
// tự ở CreateClassPage.jsx — blob URL sẽ mất ảnh sau khi tải lại trang thật).
function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Không đọc được ảnh.'))
    reader.readAsDataURL(file)
  })
}

function AnswerImageDrop({ answer, onPick, onClear }) {
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
    <div className="quiz-drop">
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
      {answer.imagePreview ? (
        <div className="quiz-drop-preview">
          <img src={answer.imagePreview} alt={answer.imageName || 'Ảnh đáp án'} />
          <div className="quiz-drop-preview-meta">
            <p>{answer.imageName || 'Ảnh đáp án'}</p>
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
          <span>Kéo thả ảnh vào đây hoặc bấm để chọn</span>
        </button>
      )}
      {error ? <p className="create-class-error">{error}</p> : null}
    </div>
  )
}

// Giống AnswerImageDrop nhưng dành cho ảnh minh hoạ của NỘI DUNG CÂU HỎI
// (không phải ảnh đáp án) — ảnh này là tùy chọn.
function QuestionImageDrop({ question, onPick, onClear }) {
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
      {question.imagePreview ? (
        <div className="quiz-drop-preview">
          <img src={question.imagePreview} alt={question.imageName || 'Ảnh minh hoạ câu hỏi'} />
          <div className="quiz-drop-preview-meta">
            <p>{question.imageName || 'Ảnh minh hoạ câu hỏi'}</p>
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

export function QuestionCard({ index, question, onChange, onRemove, onOpenSettings }) {
  const isQuiz = question.settings.layout === 'quiz'
  const showImages = isQuiz && question.settings.allowAnswerImages
  const layoutClass = isQuiz ? 'quiz-answers--tiles' : 'quiz-answers--row'

  const patchAnswer = (answerId, patch) => {
    onChange({
      ...question,
      answers: question.answers.map((a) => (a.id === answerId ? { ...a, ...patch } : a)),
    })
  }

  const addAnswer = () => {
    onChange({
      ...question,
      answers: [...question.answers, emptyAnswer(question.answers.length)],
    })
  }

  const removeAnswer = (answer) => {
    revokePreview(answer.imagePreview)
    onChange({
      ...question,
      answers: question.answers.filter((a) => a.id !== answer.id),
    })
  }

  const setAnswerImage = async (answer, file) => {
    try {
      const dataUrl = await readImageAsDataUrl(file)
      patchAnswer(answer.id, { imagePreview: dataUrl, imageName: file.name })
    } catch {
      // Người dùng có thể bấm chọn lại ảnh nếu đọc file thất bại.
    }
  }

  const clearAnswerImage = (answer) => {
    revokePreview(answer.imagePreview)
    patchAnswer(answer.id, { imagePreview: '', imageName: '' })
  }

  const setQuestionImage = async (file) => {
    try {
      const dataUrl = await readImageAsDataUrl(file)
      onChange({ ...question, imagePreview: dataUrl, imageName: file.name })
    } catch {
      // Người dùng có thể bấm chọn lại ảnh nếu đọc file thất bại.
    }
  }

  const clearQuestionImage = () => {
    revokePreview(question.imagePreview)
    onChange({ ...question, imagePreview: '', imageName: '' })
  }

  return (
    <article className="quiz-card" aria-label={`Câu hỏi ${index + 1}`}>
      <header className="quiz-card-head">
        <p className="quiz-card-kicker">Câu hỏi {index + 1}</p>
        <button type="button" className="quiz-icon-btn" onClick={onRemove} aria-label={`Xóa câu hỏi ${index + 1}`}>
          <IconTrash />
        </button>
      </header>

      <label className="quiz-field">
        <span>Tiêu đề câu hỏi</span>
        <input
          type="text"
          value={question.title}
          onChange={(e) => onChange({ ...question, title: e.target.value })}
          placeholder="Ví dụ: Câu 1 — Địa lý"
          autoComplete="off"
        />
      </label>

      <label className="quiz-field">
        <span>Nội dung câu hỏi</span>
        <textarea
          rows={3}
          value={question.content}
          onChange={(e) => onChange({ ...question, content: e.target.value })}
          placeholder="Nhập nội dung câu hỏi trắc nghiệm"
        />
      </label>

      <div className="quiz-field quiz-question-image-field">
        <span>Ảnh minh hoạ cho câu hỏi (tùy chọn)</span>
        <QuestionImageDrop question={question} onPick={setQuestionImage} onClear={clearQuestionImage} />
      </div>

      {question.imagePreview ? (
        <label className="quiz-field">
          <span>Vị trí ảnh</span>
          <select
            value={question.imagePosition || 'top'}
            onChange={(e) => onChange({ ...question, imagePosition: e.target.value })}
          >
            <option value="top">Trên</option>
            <option value="bottom">Dưới</option>
            <option value="left">Bên trái</option>
            <option value="right">Bên phải</option>
          </select>
          <p className="create-class-hint">
            {question.imagePosition === 'left' || question.imagePosition === 'right'
              ? 'Ảnh và nội dung câu hỏi chia đôi, nằm cạnh nhau.'
              : 'Ảnh nằm phía trên hoặc dưới nội dung câu hỏi.'}
          </p>
        </label>
      ) : null}

      <div className={`quiz-answers ${layoutClass}`}>
        {question.answers.length === 0 ? (
          <p className="quiz-empty-hint">Chưa có đáp án. Bấm “Thêm đáp án” để tạo A, B, C…</p>
        ) : (
          question.answers.map((answer) => {
            const color = answerColorOf(answer, question.settings)
            return (
            <div
              key={answer.id}
              className={`quiz-answer${isQuiz ? ' is-tile' : ''}${answer.isCorrect ? ' is-marked-correct' : ''}`}
              style={{
                background: color.bg === 'transparent' ? undefined : color.bg,
                color: color.fg,
                borderColor: color.bg === 'transparent' ? undefined : 'transparent',
              }}
            >
              <div className="quiz-answer-row">
                <input
                  className="quiz-answer-label"
                  type="text"
                  value={answer.label}
                  onChange={(e) => patchAnswer(answer.id, { label: e.target.value.slice(0, 4) })}
                  aria-label="Tiêu đề đáp án"
                  placeholder="A"
                  autoComplete="off"
                />
                <input
                  className="quiz-answer-content"
                  type="text"
                  value={answer.content}
                  onChange={(e) => patchAnswer(answer.id, { content: e.target.value })}
                  aria-label="Nội dung đáp án"
                  placeholder="Nội dung đáp án"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="quiz-icon-btn"
                  onClick={() => removeAnswer(answer)}
                  aria-label={`Xóa đáp án ${answer.label || ''}`.trim()}
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
              <div className="quiz-answer-color">
                <span className="quiz-answer-color-label">Màu nền: {color.label}</span>
                <div className="quiz-swatches quiz-swatches--sm" role="radiogroup" aria-label={`Màu nền đáp án ${answer.label || ''}`.trim()}>
                  {ANSWER_COLORS.map((c) => {
                    const selected = (answer.color || 'transparent') === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`quiz-swatch quiz-swatch--sm${selected ? ' is-active' : ''}${c.id === 'transparent' ? ' is-clear' : ''}`}
                        style={c.id === 'transparent' ? undefined : { background: c.bg }}
                        onClick={() => patchAnswer(answer.id, { color: c.id })}
                        title={c.label}
                        aria-label={c.label}
                      />
                    )
                  })}
                </div>
              </div>
              {showImages ? (
                <AnswerImageDrop
                  answer={answer}
                  onPick={(file) => setAnswerImage(answer, file)}
                  onClear={() => clearAnswerImage(answer)}
                />
              ) : null}
            </div>
            )
          })
        )}
      </div>

      <div className="quiz-card-actions">
        <button type="button" className="quiz-secondary-btn" onClick={addAnswer}>
          <IconPlus />
          Thêm đáp án
        </button>
        <button type="button" className="quiz-settings-btn" onClick={onOpenSettings}>
          <IconGear />
          Cài đặt chỉnh sửa
        </button>
      </div>
    </article>
  )
}

export function SettingsModal({ question, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_SETTINGS, ...question.settings }))
  const titleId = `quiz-settings-title-${question.id}`

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

  const setLayout = (layout) => {
    setDraft((prev) => ({
      ...prev,
      layout,
      allowAnswerImages: layout === 'quiz' ? prev.allowAnswerImages : false,
    }))
  }

  return (
    <div
      className="quiz-settings-overlay"
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
            <p className="quiz-card-kicker">Câu hỏi</p>
            <h3 id={titleId}>Cài đặt chỉnh sửa</h3>
          </div>
          <button type="button" className="archive-close" onClick={onClose} aria-label="Thoát cài đặt">
            <IconClose />
          </button>
        </header>

        <div className="quiz-settings-body">
          <fieldset className="quiz-fieldset">
            <legend>Kiểu trình bày đáp án</legend>
            <div className="quiz-layout-options">
              <button
                type="button"
                className={`quiz-layout-card${draft.layout === 'row' ? ' is-active' : ''}`}
                onClick={() => setLayout('row')}
                aria-pressed={draft.layout === 'row'}
              >
                <span className="quiz-layout-preview quiz-layout-preview--row" aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
                <strong>Dạng hàng ngang</strong>
                <span>Các đáp án nằm trên một hàng.</span>
              </button>
              <button
                type="button"
                className={`quiz-layout-card${draft.layout === 'quiz' ? ' is-active' : ''}`}
                onClick={() => setLayout('quiz')}
                aria-pressed={draft.layout === 'quiz'}
              >
                <span className="quiz-layout-preview quiz-layout-preview--quiz" aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
                <strong>Dạng ô hình chữ nhật</strong>
                <span>Kiểu ô lớn giống Quiz / Kahoot.</span>
              </button>
            </div>
          </fieldset>

          {draft.layout === 'quiz' ? (
            <label className="quiz-check">
              <input
                type="checkbox"
                checked={draft.allowAnswerImages}
                onChange={(e) => setDraft((prev) => ({ ...prev, allowAnswerImages: e.target.checked }))}
              />
              <span>Cho phép kéo thả ảnh dưới mỗi nội dung đáp án</span>
            </label>
          ) : null}

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
                setDraft((prev) => ({
                  ...prev,
                  countdownSeconds: Number.isFinite(n) ? Math.max(0, Math.min(3600, Math.round(n))) : 0,
                }))
              }}
            />
            <p className="create-class-hint">
              {draft.countdownSeconds > 0
                ? `Tự chuyển sang câu tiếp theo sau ${draft.countdownSeconds} giây.`
                : 'Để 0 nếu không tự chuyển câu.'}
            </p>
          </label>
        </div>

        <footer className="quiz-settings-foot">
          <button type="button" className="quiz-ghost-btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="quiz-primary-btn" onClick={() => onSave(draft)}>
            Lưu bản chỉnh sửa câu hỏi này
          </button>
        </footer>
      </div>
    </div>
  )
}

export default function QuizArchivePanel({ questions, onQuestionsChange }) {
  const [settingsId, setSettingsId] = useState(null)
  const listRef = useRef(null)
  const items = questions
  const setItems = onQuestionsChange

  const editing = useMemo(
    () => items.find((q) => q.id === settingsId) || null,
    [items, settingsId]
  )

  const addQuestion = () => {
    const next = emptyQuestion()
    setItems((prev) => [...prev, next])
    window.requestAnimationFrame(() => {
      const node = listRef.current?.querySelector(`[data-qid="${next.id}"]`)
      node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  const updateQuestion = (id, next) => {
    setItems((prev) => prev.map((q) => (q.id === id ? next : q)))
  }

  const removeQuestion = (question) => {
    question.answers.forEach((a) => revokePreview(a.imagePreview))
    setItems((prev) => prev.filter((q) => q.id !== question.id))
    setSettingsId((id) => (id === question.id ? null : id))
  }

  return (
    <div className="quiz-panel">
      <div className="quiz-list" ref={listRef}>
        {items.map((question, index) => (
          <div key={question.id} data-qid={question.id}>
            <QuestionCard
              index={index}
              question={question}
              onChange={(next) => updateQuestion(question.id, next)}
              onRemove={() => removeQuestion(question)}
              onOpenSettings={() => setSettingsId(question.id)}
            />
          </div>
        ))}
      </div>

      <button type="button" className="quiz-add-revision" onClick={addQuestion}>
        <IconPlus />
        Thêm bản chỉnh sửa
      </button>

      {editing ? (
        <SettingsModal
          question={editing}
          onClose={() => setSettingsId(null)}
          onSave={(settings) => {
            updateQuestion(editing.id, { ...editing, settings })
            setSettingsId(null)
          }}
        />
      ) : null}
    </div>
  )
}
