import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import QuizBuilder from '../components/quiz/QuizBuilder.jsx'
import { ROUTES } from '../lib/routes.js'
import { newKey } from '../lib/questionModel.js'
import { signInWithGoogle } from '../services/authService.js'
import { describeApiError, fetchAccess, fetchQuiz } from '../services/quizService.js'
import '../quiz.css'

function Notice({ title, children, actions }) {
  return (
    <div className="qz-panel qz-notice">
      <h2>{title}</h2>
      <p className="qz-muted">{children}</p>
      <div className="qz-notice-actions">{actions}</div>
    </div>
  )
}

function GoogleRequired() {
  const [error, setError] = useState('')
  return (
    <Notice
      title="Tính năng này yêu cầu đăng nhập bằng Google"
      actions={(
        <>
          <button
            type="button"
            className="qz-btn qz-btn-primary"
            onClick={() => signInWithGoogle().catch(() => setError('Không mở được đăng nhập Google. Vui lòng thử lại.'))}
          >
            Tiếp tục với Google
          </button>
          <Link className="qz-btn qz-btn-quiet" to={ROUTES.home}>Về trang chủ</Link>
          {error && <p className="qz-error" role="alert">{error}</p>}
        </>
      )}
    >
      Tài khoản email/mật khẩu vẫn dùng được 10A4-Quizz, nhưng chỉ tài khoản Google mới được tạo phòng.
    </Notice>
  )
}

/** /tao-quiz và /tao-quiz/:quizId. Quyền được backend xác định; trang này chỉ hiển thị kết quả. */
export default function CreateQuizPage() {
  const { quizId: routeQuizId } = useParams()
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [newId] = useState(newKey)
  const quizId = routeQuizId || newId

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const access = await fetchAccess()
        if (cancelled) return
        if (!access.can_create_quiz) return setState({ status: 'forbidden' })
        const quiz = routeQuizId ? await fetchQuiz(routeQuizId) : null
        if (!cancelled) setState({ status: 'ready', quiz })
      } catch (error) {
        if (!cancelled) setState({ status: 'error', message: describeApiError(error) })
      }
    })()
    return () => { cancelled = true }
  }, [routeQuizId, attempt])

  let body
  if (state.status === 'loading') {
    body = <p className="qz-status" role="status"><span className="qz-spinner" aria-hidden="true" />Đang kiểm tra quyền truy cập...</p>
  } else if (state.status === 'forbidden') {
    body = <GoogleRequired />
  } else if (state.status === 'error') {
    body = (
      <Notice
        title="Không tải được trang"
        actions={(
          <>
            <button type="button" className="qz-btn qz-btn-primary" onClick={() => { setState({ status: 'loading' }); setAttempt((n) => n + 1) }}>Thử lại</button>
            <Link className="qz-btn qz-btn-quiet" to={ROUTES.home}>Về trang chủ</Link>
          </>
        )}
      >
        {state.message}
      </Notice>
    )
  } else {
    body = <QuizBuilder key={quizId} quizId={quizId} initialQuiz={state.quiz} />
  }

  return (
    <>
      <SiteHeader />
      <main className="container qz">
        <header className="qz-page-head">
          <h1>Tạo phòng</h1>
          <p className="qz-muted">Tạo bộ câu hỏi cho phòng quiz của bạn.</p>
        </header>
        {body}
      </main>
    </>
  )
}
