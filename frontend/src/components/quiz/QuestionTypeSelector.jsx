import { QUESTION_TYPES, TYPE_LABELS } from '../../lib/questionModel.js'

/** Nhóm nút chọn loại câu hỏi (dùng khi thêm câu mới và khi đổi loại). */
export default function QuestionTypeSelector({ value, onChange, label = 'Loại câu hỏi', disabled = false }) {
  return (
    <div className="qz-segment" role="radiogroup" aria-label={label}>
      {QUESTION_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={value === type}
          className={`qz-segment-item${value === type ? ' is-active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(type)}
        >
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  )
}
