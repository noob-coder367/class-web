import QuestionCard from './QuestionCard.jsx'

/** Bản xem trước kết quả AI: người dùng chỉnh sửa rồi mới thêm vào phòng (AI chưa ghi gì vào DB). */
export default function AIQuestionPreview({ questions, meta, dispatch, onAccept, onAcceptAll, onDiscard }) {
  if (questions.length === 0) return null
  return (
    <section className="qz-panel qz-preview" aria-label="Câu hỏi do AI tạo">
      <header className="qz-preview-head">
        <div>
          <h2>AI đã tạo {meta?.returned ?? questions.length} câu hỏi</h2>
          <p className="qz-muted">
            Hãy kiểm tra và chỉnh sửa trước khi thêm vào phòng.
            {meta?.truncated ? ' Tài liệu dài nên chỉ phần đầu được dùng.' : ''}
            {meta && meta.returned < meta.requested ? ` Bạn yêu cầu ${meta.requested} câu, AI chỉ tạo ${meta.returned} câu để tránh bịa thông tin.` : ''}
          </p>
        </div>
        <div className="qz-preview-actions">
          <button type="button" className="qz-btn qz-btn-primary" onClick={onAcceptAll}>Thêm tất cả vào phòng</button>
          <button type="button" className="qz-btn qz-btn-quiet" onClick={onDiscard}>Bỏ kết quả</button>
        </div>
      </header>
      <div className="qz-list">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.key}
            question={question}
            index={index}
            total={questions.length}
            dispatch={dispatch}
            variant="preview"
            onAccept={onAccept}
          />
        ))}
      </div>
    </section>
  )
}
