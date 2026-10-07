import { describeTypeChange, TYPE_LABELS } from '../../lib/questionModel.js'
import QuestionEditor from './QuestionEditor.jsx'
import QuestionTypeSelector from './QuestionTypeSelector.jsx'

/**
 * variant 'draft': thẻ trong phòng (lên/xuống, nhân đôi, xóa).
 * variant 'preview': thẻ trong bản xem trước AI (thêm vào phòng / xóa).
 */
export default function QuestionCard({ question, index, total, error, dispatch, variant = 'draft', onAccept }) {
  const changeType = (nextType) => {
    const warning = describeTypeChange(question, nextType)
    if (warning && !window.confirm(`${warning}\n(Dữ liệu cũ vẫn được giữ nếu bạn đổi lại.)\n\nĐổi sang "${TYPE_LABELS[nextType]}"?`)) return
    dispatch({ type: 'changeType', key: question.key, questionType: nextType })
  }

  return (
    <article className={`qz-card${error ? ' has-error' : ''}`} data-invalid={error ? 'true' : undefined}>
      <header className="qz-card-head">
        <h3>Câu {index + 1}</h3>
        <span className="qz-badge">{TYPE_LABELS[question.type]}</span>
      </header>

      <QuestionTypeSelector value={question.type} onChange={changeType} label={`Loại của câu ${index + 1}`} />
      <QuestionEditor question={question} dispatch={dispatch} />
      {error && <p className="qz-error" role="alert">{error}</p>}

      <footer className="qz-card-actions">
        {variant === 'draft' ? (
          <>
            <button type="button" className="qz-btn qz-btn-quiet" disabled={index === 0} onClick={() => dispatch({ type: 'move', key: question.key, delta: -1 })} aria-label={`Đưa câu ${index + 1} lên`}>↑ Lên</button>
            <button type="button" className="qz-btn qz-btn-quiet" disabled={index === total - 1} onClick={() => dispatch({ type: 'move', key: question.key, delta: 1 })} aria-label={`Đưa câu ${index + 1} xuống`}>↓ Xuống</button>
            <button type="button" className="qz-btn qz-btn-quiet" onClick={() => dispatch({ type: 'duplicate', key: question.key })}>Nhân đôi</button>
          </>
        ) : (
          <button type="button" className="qz-btn qz-btn-primary" onClick={() => onAccept(question)}>Thêm vào phòng</button>
        )}
        <button type="button" className="qz-btn qz-btn-danger" onClick={() => dispatch({ type: 'remove', key: question.key })}>Xóa</button>
      </footer>
    </article>
  )
}
