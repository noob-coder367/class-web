import { useId } from 'react'
import { LIMITS, optionLetter } from '../../lib/questionModel.js'

function MultipleChoiceFields({ question, dispatch, groupId }) {
  const { key, options, correct_option: correct } = question
  return (
    <fieldset className="qz-fieldset">
      <legend>Các đáp án · chọn 1 đáp án đúng</legend>
      <div className="qz-options">
        {options.map((option, index) => (
          <div key={index} className={`qz-option${correct === index ? ' is-correct' : ''}`}>
            <input
              type="radio"
              name={groupId}
              checked={correct === index}
              onChange={() => dispatch({ type: 'update', key, patch: { correct_option: index } })}
              aria-label={`Chọn đáp án ${optionLetter(index)} là đáp án đúng`}
            />
            <span className="qz-option-letter" aria-hidden="true">{optionLetter(index)}</span>
            <input
              className="qz-input"
              type="text"
              value={option}
              maxLength={LIMITS.OPTION_MAX}
              placeholder={`Đáp án ${optionLetter(index)}`}
              aria-label={`Nội dung đáp án ${optionLetter(index)}`}
              onChange={(event) => dispatch({ type: 'setOption', key, index, value: event.target.value })}
            />
            <button
              type="button"
              className="qz-icon-btn"
              disabled={options.length <= LIMITS.OPTIONS_MIN}
              onClick={() => dispatch({ type: 'removeOption', key, index })}
              aria-label={`Xóa đáp án ${optionLetter(index)}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {options.length < LIMITS.OPTIONS_MAX && (
        <button type="button" className="qz-btn qz-btn-quiet" onClick={() => dispatch({ type: 'addOption', key })}>
          + Thêm đáp án
        </button>
      )}
    </fieldset>
  )
}

function TrueFalseFields({ question, dispatch, groupId }) {
  const choices = [{ value: true, label: 'Đúng' }, { value: false, label: 'Sai' }]
  return (
    <fieldset className="qz-fieldset">
      <legend>Đáp án đúng</legend>
      <div className="qz-tf">
        {choices.map((choice) => (
          <label key={choice.label} className={`qz-tf-item${question.correct_boolean === choice.value ? ' is-active' : ''}`}>
            <input
              type="radio"
              name={groupId}
              checked={question.correct_boolean === choice.value}
              onChange={() => dispatch({ type: 'update', key: question.key, patch: { correct_boolean: choice.value } })}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Editor của 1 câu hỏi: phần thân thay đổi theo `question.type`. */
export default function QuestionEditor({ question, dispatch }) {
  const id = useId()
  const patch = (field) => (event) => dispatch({ type: 'update', key: question.key, patch: { [field]: event.target.value } })

  return (
    <div className="qz-editor">
      <div className="qz-field">
        <label htmlFor={`${id}-content`}>Nội dung câu hỏi</label>
        <textarea
          id={`${id}-content`}
          className="qz-input qz-textarea"
          rows={3}
          maxLength={LIMITS.CONTENT_MAX}
          value={question.content}
          placeholder="Nhập nội dung câu hỏi..."
          onChange={patch('content')}
        />
      </div>

      {question.type === 'multiple_choice' && <MultipleChoiceFields question={question} dispatch={dispatch} groupId={`${id}-mc`} />}
      {question.type === 'true_false' && <TrueFalseFields question={question} dispatch={dispatch} groupId={`${id}-tf`} />}
      {question.type === 'essay' && (
        <div className="qz-field">
          <label htmlFor={`${id}-answer`}>Đáp án tham khảo <span className="qz-muted">(không bắt buộc)</span></label>
          <textarea
            id={`${id}-answer`}
            className="qz-input qz-textarea"
            rows={3}
            maxLength={LIMITS.ANSWER_MAX}
            value={question.reference_answer}
            placeholder="Gợi ý đáp án hoặc ý chính cần có..."
            onChange={patch('reference_answer')}
          />
        </div>
      )}

      <details className="qz-details" open={Boolean(question.explanation)}>
        <summary>Giải thích <span className="qz-muted">(không bắt buộc)</span></summary>
        <textarea
          className="qz-input qz-textarea"
          rows={2}
          maxLength={LIMITS.EXPLANATION_MAX}
          value={question.explanation}
          placeholder="Vì sao đây là đáp án đúng?"
          aria-label="Giải thích"
          onChange={patch('explanation')}
        />
      </details>
    </div>
  )
}
