import { useEffect, useState } from 'react'
import { colorOf } from './QuizArchivePanel.jsx'
import './ClassPlayView.css'

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 5 L8 12 L14.5 19" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 5 L16 12 L9.5 19" />
    </svg>
  )
}

// Xáo trộn kiểu Fisher–Yates, không đổi mảng gốc.
function shuffleArray(arr) {
  const next = [...arr]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export default function ClassPlayView({ classData, onClose }) {
  const questions = classData?.questions || []

  // Chỉ xáo trộn 1 lần khi mở lớp học (mỗi lần vào lại sẽ xáo trộn lại).
  const [order] = useState(() => {
    const base = questions.map((_, i) => i)
    return classData?.shuffle ? shuffleArray(base) : base
  })
  const [index, setIndex] = useState(0)
  const [selections, setSelections] = useState({})
  const [essayDrafts, setEssayDrafts] = useState({})
  const [timeLeft, setTimeLeft] = useState(null)
  const [done, setDone] = useState(questions.length === 0)

  const total = order.length
  const current = total ? questions[order[index]] : null
  const isQuiz = current?.kind === 'quiz'
  const q = current?.question

  // Chấm điểm trắc nghiệm dựa trên đáp án đã đánh dấu "Đáp án đúng" khi soạn câu hỏi.
  const gradedQuizTotal = questions.filter(
    (entry) => entry.kind === 'quiz' && (entry.question?.answers || []).some((a) => a.isCorrect)
  ).length
  const gradedQuizCorrect = questions.filter((entry) => {
    if (entry.kind !== 'quiz') return false
    const answers = entry.question?.answers || []
    if (!answers.some((a) => a.isCorrect)) return false
    const chosenId = selections[entry.id]
    if (!chosenId) return false
    return !!answers.find((a) => a.id === chosenId)?.isCorrect
  }).length

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const goNext = () => {
    if (index >= total - 1) {
      setDone(true)
      return
    }
    setIndex((i) => i + 1)
  }

  const goPrev = () => {
    if (index <= 0) return
    setIndex((i) => i - 1)
  }

  // Đếm ngược riêng cho từng câu (nếu người tạo có đặt trong Cài đặt chỉnh sửa).
  useEffect(() => {
    if (!current || done) {
      setTimeLeft(null)
      return
    }
    const seconds = isQuiz ? q?.settings?.countdownSeconds : q?.countdownSeconds
    if (!seconds || seconds <= 0) {
      setTimeLeft(null)
      return
    }
    setTimeLeft(seconds)
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null
        if (t <= 1) {
          clearInterval(timer)
          goNext()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, done])

  const answerLayoutClass = isQuiz && q?.settings?.layout === 'quiz' ? 'quiz-answers--tiles' : 'quiz-answers--row'

  if (!classData) return null

  return (
    <div className="class-play-view" role="dialog" aria-modal="true" aria-label={`Làm bài: ${classData.title}`}>
      <header className="class-play-topbar">
        <div className="class-play-heading">
          <p className="class-play-kicker">Lớp học</p>
          <h2>{classData.title}</h2>
        </div>
        <button type="button" className="class-play-close" onClick={onClose} aria-label="Đóng">
          <IconClose />
        </button>
      </header>

      {total === 0 ? (
        <div className="class-play-empty">
          <p>Lớp học này chưa có câu hỏi nào.</p>
          <button type="button" className="quiz-primary-btn" onClick={onClose}>
            Quay lại
          </button>
        </div>
      ) : done ? (
        <div className="class-play-empty">
          <p>Bạn đã hoàn thành {total} câu hỏi của lớp học này. 🎉</p>
          {gradedQuizTotal > 0 ? (
            <p className="class-play-score">
              Trắc nghiệm đã chấm điểm: <strong>{gradedQuizCorrect}/{gradedQuizTotal}</strong> câu đúng
            </p>
          ) : null}
          <div className="class-play-done-actions">
            <button
              type="button"
              className="quiz-ghost-btn"
              onClick={() => {
                setIndex(0)
                setDone(false)
              }}
            >
              Làm lại
            </button>
            <button type="button" className="quiz-primary-btn" onClick={onClose}>
              Xong
            </button>
          </div>
        </div>
      ) : (
        <div className="class-play-body">
          <div className="class-play-progress">
            <span>
              Câu {index + 1}/{total}
            </span>
            {timeLeft !== null ? <span className="class-play-timer">⏱ {timeLeft}s</span> : null}
          </div>

          <article className="quiz-card class-play-card">
            <p className="quiz-card-kicker">{isQuiz ? 'Trắc nghiệm' : 'Tự luận'}</p>
            <h3 className="essay-card-title">
              {isQuiz ? q?.title || 'Câu hỏi trắc nghiệm' : q?.questionTitle || q?.title || 'Câu hỏi tự luận'}
            </h3>
            {q?.content ? <p className="essay-card-content">{q.content}</p> : null}

            {isQuiz ? (
              <div className={`quiz-answers ${answerLayoutClass}`}>
                {(() => {
                  const color = colorOf(q?.settings?.answerColor)
                  const answers = q?.answers || []
                  const hasKey = answers.some((a) => a.isCorrect)
                  const chosenId = selections[current.id]
                  const revealed = hasKey && !!chosenId
                  return answers.map((answer) => {
                    const selected = chosenId === answer.id
                    let resultClass = ''
                    if (revealed) {
                      if (answer.isCorrect) resultClass = ' is-correct-answer'
                      else if (selected) resultClass = ' is-wrong-answer'
                    }
                    return (
                      <button
                        key={answer.id}
                        type="button"
                        className={`class-play-answer${answerLayoutClass === 'quiz-answers--tiles' ? ' is-tile' : ''}${selected ? ' is-selected' : ''}${resultClass}`}
                        onClick={() => setSelections((prev) => ({ ...prev, [current.id]: answer.id }))}
                        style={{
                          background: color.bg === 'transparent' ? undefined : color.bg,
                          color: color.fg,
                        }}
                      >
                        {answer.imagePreview ? (
                          <img src={answer.imagePreview} alt={answer.imageName || 'Ảnh đáp án'} />
                        ) : null}
                        <span className="class-play-answer-label">{answer.label}</span>
                        <span className="class-play-answer-content">{answer.content}</span>
                      </button>
                    )
                  })
                })()}
              </div>
            ) : (
              <div className="class-play-essay">
                <label className="quiz-field">
                  <span>Câu trả lời của bạn</span>
                  <textarea
                    rows={5}
                    value={essayDrafts[current.id] || ''}
                    onChange={(e) => setEssayDrafts((prev) => ({ ...prev, [current.id]: e.target.value }))}
                    placeholder="Nhập câu trả lời để tự ôn tập..."
                  />
                </label>
                {(q?.answers || []).some((a) => a.content.trim()) ? (
                  <details className="class-play-essay-key">
                    <summary>Xem gợi ý đáp án</summary>
                    <ul className="essay-preview-answers">
                      {(q?.answers || [])
                        .filter((a) => a.content.trim())
                        .map((a) => (
                          <li key={a.id}>
                            {a.content}
                            {a.isCorrect ? <span className="class-play-correct-tag"> · đáp án đúng</span> : null}
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            )}
          </article>

          <footer className="class-play-nav">
            <button type="button" className="class-play-nav-btn" onClick={goPrev} disabled={index === 0}>
              <IconChevronLeft />
              Câu trước
            </button>
            <button type="button" className="quiz-primary-btn class-play-next" onClick={goNext}>
              {index >= total - 1 ? 'Hoàn thành' : 'Câu tiếp theo'}
              {index < total - 1 ? <IconChevronRight /> : null}
            </button>
          </footer>
        </div>
      )}
    </div>
  )
}
