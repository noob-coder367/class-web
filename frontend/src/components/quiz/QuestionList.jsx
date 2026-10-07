import QuestionCard from './QuestionCard.jsx'

export default function QuestionList({ questions, errors, dispatch }) {
  if (questions.length === 0) {
    return (
      <div className="qz-empty">
        <strong>Chưa có câu hỏi nào</strong>
        <span>Thêm câu hỏi thủ công hoặc để AI tạo giúp bạn.</span>
      </div>
    )
  }
  return (
    <div className="qz-list">
      {questions.map((question, index) => (
        <QuestionCard
          key={question.key}
          question={question}
          index={index}
          total={questions.length}
          error={errors?.[question.key]}
          dispatch={dispatch}
        />
      ))}
    </div>
  )
}
