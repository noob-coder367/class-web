import { useEffect, useId, useRef, useState } from 'react'
import { generateQuestions } from '../../services/aiService.js'
import { describeApiError } from '../../services/quizService.js'
import { QUESTION_TYPES, TYPE_LABELS } from '../../lib/questionModel.js'
import FileDropzone from './FileDropzone.jsx'

const MAX_TEXT = 30000
const DIFFICULTIES = [
  { value: 'auto', label: 'Tự động' },
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
]

/** Khu vực "Tạo câu hỏi bằng AI". Chỉ trả kết quả cho cha qua onGenerated; không lưu gì. */
export default function AIQuestionGenerator({ onGenerated, disabled = false }) {
  const id = useId()
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [count, setCount] = useState(10)
  const [typeMode, setTypeMode] = useState('auto')
  const [types, setTypes] = useState([...QUESTION_TYPES])
  const [difficulty, setDifficulty] = useState('auto')
  const [phase, setPhase] = useState('idle') // idle | reading | generating
  const [error, setError] = useState('')
  const timer = useRef(null)
  const busy = phase !== 'idle'

  useEffect(() => () => clearTimeout(timer.current), [])

  const toggleType = (type) => setTypes((current) => (
    current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
  ))

  const sourceReady = mode === 'text' ? text.trim().length > 0 : Boolean(file)
  const typesReady = typeMode === 'auto' || types.length > 0
  const countValid = Number.isInteger(count) && count >= 1 && count <= 30

  const submit = async () => {
    if (busy || !sourceReady || !typesReady || !countValid) return
    setError('')
    setPhase(mode === 'file' ? 'reading' : 'generating')
    if (mode === 'file') timer.current = setTimeout(() => setPhase('generating'), 2500)
    try {
      const result = await generateQuestions({
        mode,
        text,
        file,
        count,
        types: typeMode === 'custom' ? types : null,
        difficulty,
      })
      onGenerated(result.questions, result.meta)
    } catch (err) {
      setError(describeApiError(err, 'AI provider unavailable: dịch vụ AI tạm thời không khả dụng.'))
    } finally {
      clearTimeout(timer.current)
      setPhase('idle')
    }
  }

  return (
    <section className="qz-panel qz-ai" aria-label="Tạo câu hỏi bằng AI">
      <h2>Tạo câu hỏi bằng AI</h2>

      <div className="qz-segment" role="radiogroup" aria-label="Nguồn nội dung">
        {[['text', 'Nhập text'], ['file', 'Tải file lên']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            className={`qz-segment-item${mode === value ? ' is-active' : ''}`}
            disabled={busy}
            onClick={() => { setMode(value); setError('') }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'text' ? (
        <div className="qz-field">
          <label className="qz-visually-hidden" htmlFor={`${id}-text`}>Nội dung nguồn</label>
          <textarea
            id={`${id}-text`}
            className="qz-input qz-textarea"
            rows={5}
            maxLength={MAX_TEXT}
            value={text}
            disabled={busy}
            placeholder="Nhập nội dung, chủ đề hoặc tài liệu muốn tạo câu hỏi..."
            onChange={(event) => setText(event.target.value)}
          />
          <span className="qz-muted qz-counter">{text.length.toLocaleString('vi-VN')} / {MAX_TEXT.toLocaleString('vi-VN')}</span>
        </div>
      ) : (
        <FileDropzone file={file} onFile={setFile} onReject={setError} disabled={busy} />
      )}

      <div className="qz-ai-options">
        <div className="qz-field">
          <label htmlFor={`${id}-count`}>Số câu</label>
          <input
            id={`${id}-count`}
            className="qz-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={Number.isNaN(count) ? '' : count}
            disabled={busy}
            onChange={(event) => setCount(event.target.value === '' ? Number.NaN : Number(event.target.value))}
          />
        </div>
        <div className="qz-field">
          <label htmlFor={`${id}-difficulty`}>Độ khó</label>
          <select id={`${id}-difficulty`} className="qz-input" value={difficulty} disabled={busy} onChange={(event) => setDifficulty(event.target.value)}>
            {DIFFICULTIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <div className="qz-field">
        <span className="qz-label">Loại câu hỏi</span>
        <div className="qz-segment" role="radiogroup" aria-label="Cách chọn loại câu hỏi">
          {[['auto', 'Tự động phân loại'], ['custom', 'Tự chọn']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={typeMode === value}
              className={`qz-segment-item${typeMode === value ? ' is-active' : ''}`}
              disabled={busy}
              onClick={() => setTypeMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {typeMode === 'custom' && (
          <div className="qz-checks">
            {QUESTION_TYPES.map((type) => (
              <label key={type} className="qz-check">
                <input type="checkbox" checked={types.includes(type)} disabled={busy} onChange={() => toggleType(type)} />
                <span>{TYPE_LABELS[type]}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {busy && (
        <p className="qz-status" role="status">
          <span className="qz-spinner" aria-hidden="true" />
          {phase === 'reading' ? 'AI đang đọc tài liệu...' : 'AI đang tạo câu hỏi...'}
        </p>
      )}
      {error && <p className="qz-error" role="alert">{error}</p>}

      <button
        type="button"
        className="qz-btn qz-btn-primary qz-btn-block"
        disabled={disabled || busy || !sourceReady || !typesReady || !countValid}
        onClick={() => void submit()}
      >
        {busy ? 'Đang xử lý...' : 'Tạo câu hỏi'}
      </button>
    </section>
  )
}
