import { useEffect, useRef, useState } from 'react'
import { answerColorOf, formatCountdown } from './QuizArchivePanel.jsx'
import { statementLabel } from './TrueFalseArchivePanel.jsx'
import { normalizePlayBackdrop } from '../lib/playBackdrops.js'
import { essayKeys, gradeClassPlay, normalizeAnswer } from '../lib/classPlayScore.js'
import * as classroomService from '../services/classroomService.js'
import { useAuth } from '../context/AuthContext.jsx'
import './ClassPlayView.css'
import './PlayBackdrop.css'
import './ClassPlayFx.css'

function badgeLabel(kind) {
  if (kind === 'quiz') return 'Trắc nghiệm'
  if (kind === 'truefalse') return 'Đúng/Sai'
  return 'Tự luận'
}

function questionHeading(kind, question) {
  if (kind === 'quiz') return question?.title || 'Câu hỏi trắc nghiệm'
  if (kind === 'truefalse') return question?.questionTitle || question?.title || 'Câu hỏi đúng/sai'
  return question?.questionTitle || question?.title || 'Câu hỏi tự luận'
}

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

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M4.5 15a8 8 0 0 0 13.9 3.2L20 20" />
      <path d="M19.5 9a8 8 0 0 0-13.9-3.2L4 4" />
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

// Sau khi chọn đáp án trắc nghiệm, đợi 1 chút để người học thấy đúng/sai rồi mới tự chuyển câu.
const AUTO_ADVANCE_DELAY_MS = 900
// Khi hiện bảng "Đã hoàn thành", tự đóng phòng sau 3 giây.
const AUTO_CLOSE_DELAY_MS = 3000

function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5.5A2.5 2.5 0 0 0 8 9.5" />
      <path d="M16 6h2.5A2.5 2.5 0 0 1 16 9.5" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 17h4v3h-4z" />
    </svg>
  )
}

function medalFor(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

function initialOf(name) {
  const text = String(name || '').trim()
  if (!text) return '?'
  const parts = text.split(/\s+/)
  return parts[parts.length - 1].slice(0, 1).toUpperCase()
}

function formatDurationVN(durationMs) {
  if (durationMs == null || !Number.isFinite(durationMs)) return '—'
  const totalSeconds = Math.round(durationMs / 1000)
  if (totalSeconds < 60) return `${totalSeconds} giây`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds ? `${minutes} phút ${seconds} giây` : `${minutes} phút`
}

function shuffleArray(arr) {
  const next = [...arr]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

// Âm thanh phản hồi khi chọn đáp án — tổng hợp bằng Web Audio API nên không cần file mp3.
let audioCtx = null

function getAudioCtx() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) {
    try {
      audioCtx = new Ctx()
    } catch {
      return null
    }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

function playTone(ctx, { type, freq, freqEnd, start, duration, gain, lowpass }) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  let last = osc
  if (lowpass) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = lowpass
    osc.connect(filter)
    last = filter
  }
  last.connect(amp)
  amp.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

// 'correct' = "Ting" (chuông ngắn, cao); 'wrong' = "Ét è" (hai tiếng buzzer trầm, hạ giọng).
function playAnswerSound(kind) {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const t = ctx.currentTime + 0.01
    if (kind === 'correct') {
      playTone(ctx, { type: 'sine', freq: 1760, start: t, duration: 0.75, gain: 0.22 })
      playTone(ctx, { type: 'sine', freq: 3520, start: t, duration: 0.4, gain: 0.07 })
      playTone(ctx, { type: 'sine', freq: 2637, start: t, duration: 0.55, gain: 0.05 })
      return
    }
    playTone(ctx, { type: 'sawtooth', freq: 260, freqEnd: 210, start: t, duration: 0.16, gain: 0.16, lowpass: 900 })
    playTone(ctx, { type: 'sawtooth', freq: 200, freqEnd: 130, start: t + 0.2, duration: 0.3, gain: 0.16, lowpass: 800 })
  } catch {
    // Trình duyệt chặn/không hỗ trợ âm thanh: bỏ qua, không ảnh hưởng làm bài.
  }
}

function playStyle(answer, settings, { selected, revealed, wrongTried, showCorrect }) {
  const color = answerColorOf(answer, settings)
  if (showCorrect || (revealed && answer.isCorrect)) {
    return { background: '#16a34a', color: '#f8fafc', borderColor: '#15803d' }
  }
  if (wrongTried || (revealed && selected && !answer.isCorrect)) {
    return { background: '#dc2626', color: '#f8fafc', borderColor: '#b91c1c' }
  }
  if (revealed) {
    return {
      background: color.bg === 'transparent' ? '#f8fafc' : color.bg,
      color: color.fg,
      opacity: 0.55,
    }
  }
  if (selected) {
    return { background: '#f5c400', color: '#0f172a', borderColor: '#e0b000' }
  }
  return {
    background: color.bg === 'transparent' ? undefined : color.bg,
    color: color.fg,
  }
}

export default function ClassPlayView({ classData, onClose }) {
  const { profile } = useAuth()
  const questions = classData?.questions || []

  const [order] = useState(() => {
    const base = questions.map((_, i) => i)
    return classData?.shuffle ? shuffleArray(base) : base
  })
  const [index, setIndex] = useState(0)
  const [selections, setSelections] = useState({})
  const [quizTried, setQuizTried] = useState({})
  const [essayDrafts, setEssayDrafts] = useState({})
  const [essayResults, setEssayResults] = useState({})
  const [tfSelections, setTfSelections] = useState({})
  const [timeLeft, setTimeLeft] = useState(null)
  const [done, setDone] = useState(questions.length === 0)
  const [rankOpen, setRankOpen] = useState(false)
  // Hiệu ứng đáp án vừa chọn: { key, type: 'correct' | 'wrong' }. Chỉ áp cho đúng nút vừa bấm.
  const [answerFx, setAnswerFx] = useState(null)
  const [leaderboard, setLeaderboard] = useState(() =>
    Array.isArray(classData?.leaderboard) ? classData.leaderboard : []
  )
  const submittedRef = useRef(false)

  // Ghi mốc bắt đầu làm bài ở SERVER (không dùng đồng hồ client) để tính thời
  // gian làm bài một cách đáng tin cậy cho BXH. Gọi lại mỗi khi bấm "Làm lại".
  const markAttemptStart = () => {
    const roomId = classData?.id
    if (!roomId) return
    classroomService.startClassSpaceAttempt(roomId).catch(() => {})
  }

  useEffect(() => {
    if (questions.length === 0) return
    markAttemptStart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = order.length
  const current = total ? questions[order[index]] : null
  const kind = current?.kind
  const isQuiz = kind === 'quiz'
  const isEssay = kind === 'essay'
  const isTrueFalse = kind === 'truefalse'
  const q = current?.question
  const allowRetry = classData?.allowRetry !== false
  const allowMultiTry = classData?.allowMultiTry === true
  const autoAdvanceMultiTry = classData?.autoAdvanceMultiTry === true
  const enableLeaderboard = classData?.enableLeaderboard === true

  const score = gradeClassPlay(questions, {
    selections,
    quizTried,
    essayDrafts,
    tfSelections,
    allowMultiTry,
  })

  const triggerAnswerFx = (key, isCorrect) => {
    setAnswerFx({ key, type: isCorrect ? 'correct' : 'wrong' })
    playAnswerSound(isCorrect ? 'correct' : 'wrong')
  }

  const fxClassOf = (key) => (answerFx?.key === key ? ` fx-${answerFx.type}` : '')

  // Sang câu khác thì bỏ hiệu ứng cũ, tránh chạy lại khi quay về câu trước.
  useEffect(() => {
    setAnswerFx(null)
  }, [index])

  const handleRetry = () => {
    submittedRef.current = false
    setAnswerFx(null)
    setIndex(0)
    setSelections({})
    setQuizTried({})
    setEssayDrafts({})
    setEssayResults({})
    setTfSelections({})
    setDone(false)
    markAttemptStart()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (rankOpen) {
        setRankOpen(false)
        return
      }
      onClose?.()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, rankOpen])

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

  const gradeEssayAndMaybeAdvance = (value, autoAdvance, { skipIfWrong = false } = {}) => {
    if (!current || !isEssay) return
    const keys = essayKeys(q)
    if (!keys.length) {
      if (autoAdvance) goNext()
      return
    }
    const ok = keys.includes(normalizeAnswer(value))
    setEssayResults((prev) => ({ ...prev, [current.id]: ok ? 'correct' : 'wrong' }))
    triggerAnswerFx(`essay:${current.id}`, ok)
    if (autoAdvance) {
      if (allowMultiTry && !ok && !skipIfWrong) return
      if (skipIfWrong) {
        goNext()
        return
      }
      window.setTimeout(() => goNext(), AUTO_ADVANCE_DELAY_MS)
    }
  }

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

  // Trắc nghiệm: mặc định sau khi chọn đáp án (đúng hay sai) thì tự chuyển câu.
  // Khi bật "thử nhiều đáp án", chỉ tự chuyển nếu công tắc tự động được bật;
  // nếu tắt thì người làm bài ở lại cho tới khi tự bấm nút chuyển câu.
  useEffect(() => {
    if (done || !isQuiz || !current) return
    const chosenId = selections[current.id]
    if (!chosenId) return
    if (allowMultiTry) {
      if (!autoAdvanceMultiTry) return
      const answers = q?.answers || []
      const hasKey = answers.some((a) => a.isCorrect)
      if (hasKey) {
        const tried = quizTried[current.id] || []
        const pickedCorrect = answers.some((a) => a.isCorrect && tried.includes(a.id))
        const wrongCount = tried.filter((id) => !answers.find((a) => a.id === id)?.isCorrect).length
        const exhausted = answers.length >= 2 && wrongCount >= answers.length - 1
        if (!pickedCorrect && !exhausted) return
      }
    }
    const timer = setTimeout(() => {
      goNext()
    }, AUTO_ADVANCE_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections[current?.id], quizTried[current?.id], index, done, autoAdvanceMultiTry])

  // Đúng/Sai: khi đã chọn hết các ý thì hiện màu rồi tự chuyển câu.
  useEffect(() => {
    if (done || !isTrueFalse || !current) return
    const statements = (q?.statements || []).filter((s) => s.content?.trim())
    if (!statements.length) return
    const chosen = tfSelections[current.id] || {}
    const allAnswered = statements.every((s) => typeof chosen[s.id] === 'boolean')
    if (!allAnswered) return
    const timer = setTimeout(() => {
      goNext()
    }, AUTO_ADVANCE_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tfSelections[current?.id], index, done])

  useEffect(() => {
    if (!done || questions.length === 0) return
    if (submittedRef.current) return
    submittedRef.current = true
    const roomId = classData?.id
    if (!roomId) return
    classroomService
      .submitClassSpaceResult(roomId, { correct: score.correct, total: score.total })
      .then((data) => {
        if (Array.isArray(data?.leaderboard)) setLeaderboard(data.leaderboard)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  useEffect(() => {
    if (!done || rankOpen) return
    const timer = setTimeout(() => {
      onClose?.()
    }, AUTO_CLOSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [done, onClose, rankOpen])

  const answerLayoutClass = isQuiz && q?.settings?.layout === 'quiz' ? 'quiz-answers--tiles' : 'quiz-answers--exam'

  if (!classData) return null

  const backdrop = normalizePlayBackdrop(classData)
  const hasTheme = backdrop.backdropType === 'theme'
  const hasImage = backdrop.backdropType === 'image'
  const hasBackdrop = hasTheme || hasImage
  const playClassName = [
    'class-play-view',
    hasBackdrop ? 'has-backdrop' : '',
    hasImage ? 'has-backdrop-image' : '',
    hasTheme ? `play-backdrop--${backdrop.backdropTheme}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const playStyleBg = hasImage
    ? { backgroundImage: `url(${JSON.stringify(backdrop.backdropImage)})` }
    : undefined

  const pickTf = (statementId, value) => {
    setTfSelections((prev) => {
      const currentMap = prev[current.id] || {}
      if (typeof currentMap[statementId] === 'boolean') return prev
      return { ...prev, [current.id]: { ...currentMap, [statementId]: value } }
    })
  }

  const openLeaderboard = () => {
    setRankOpen(true)
    const roomId = classData?.id
    if (!roomId) return
    classroomService
      .getClassSpaceLeaderboard(roomId)
      .then((data) => {
        if (Array.isArray(data?.leaderboard)) setLeaderboard(data.leaderboard)
      })
      .catch(() => {})
  }

  // Gần real-time: khi bảng BXH đang mở, poll lại mỗi 2 giây để thấy người khác
  // vừa hoàn thành mà không cần F5 hay đóng/mở lại bảng. Chỉ 1 interval tại 1
  // thời điểm, luôn clear khi đóng bảng hoặc rời khỏi phòng (unmount).
  useEffect(() => {
    if (!rankOpen) return
    const roomId = classData?.id
    if (!roomId) return
    let cancelled = false
    const poll = () => {
      if (document.visibilityState !== 'visible') return
      classroomService
        .getClassSpaceLeaderboard(roomId)
        .then((data) => {
          if (!cancelled && Array.isArray(data?.leaderboard)) setLeaderboard(data.leaderboard)
        })
        .catch(() => {
          // Lỗi tạm thời: giữ nguyên dữ liệu BXH hiện tại, lần poll sau thử lại.
        })
    }
    const interval = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [rankOpen, classData?.id])

  return (
    <div
      className={playClassName}
      style={playStyleBg}
      role="dialog"
      aria-modal="true"
      aria-label={`Làm bài: ${classData.title}`}
    >
      <header className="class-play-topbar">
        {enableLeaderboard ? (
          <button type="button" className="class-play-bxh-btn" onClick={openLeaderboard} aria-label="Bảng xếp hạng">
            <IconTrophy />
            BXH
          </button>
        ) : (
          <span className="class-play-bxh-off">Không có BXH</span>
        )}
        <div className="class-play-heading">
          <p className="class-play-kicker">Phòng</p>
          <h2>{classData.title}</h2>
        </div>
        <button type="button" className="class-play-close" onClick={onClose} aria-label="Đóng">
          <IconClose />
        </button>
      </header>

      {total === 0 ? (
        <div className="class-play-empty">
          <p>Phòng này chưa có câu hỏi nào.</p>
          <button type="button" className="quiz-primary-btn" onClick={onClose}>
            Quay lại
          </button>
        </div>
      ) : done ? (
        <div className="class-play-empty">
          <p>Bạn đã hoàn thành phòng này. 🎉</p>
          <p className="class-play-score">
            Điểm đạt được: <strong>{score.correct}/{score.total}</strong>
          </p>
          <p className="class-play-autoclose-hint">Tự động về lớp sau vài giây...</p>
          <div className="class-play-done-actions">
            {allowRetry ? (
              <button type="button" className="class-play-retry-btn" onClick={handleRetry}>
                <IconRefresh />
                Làm lại
              </button>
            ) : null}
            <button type="button" className="quiz-primary-btn" onClick={onClose}>
              Về lớp
            </button>
          </div>
        </div>
      ) : (
        <div className="class-play-body">
          <div className="class-play-progress">
            <span>
              Câu {index + 1}/{total}
            </span>
            {timeLeft !== null ? <span className="class-play-timer">⏱ {formatCountdown(timeLeft)}</span> : null}
          </div>

          <article className="quiz-card class-play-card class-play-exam">
            <p className="quiz-card-kicker">{badgeLabel(kind)}</p>
            <h3 className="class-play-exam-title">
              <span className="class-play-exam-qnum">Câu {index + 1}:</span>{' '}
              {questionHeading(kind, q)}
            </h3>
            {q?.content || q?.imagePreview ? (
              (() => {
                const pos = q?.imagePosition || 'top'
                const stemText = q?.content ? <p className="class-play-exam-stem">{q.content}</p> : null
                if (!q?.imagePreview) return stemText
                const media = (
                  <div className="class-play-exam-stem-media">
                    <img src={q.imagePreview} alt={q.imageName || 'Ảnh minh hoạ câu hỏi'} />
                  </div>
                )
                if (pos === 'left' || pos === 'right') {
                  return (
                    <div className={`class-play-exam-stem-split class-play-exam-stem-split--${pos}`}>
                      {pos === 'left' ? media : null}
                      <div className="class-play-exam-stem-text">{stemText}</div>
                      {pos === 'right' ? media : null}
                    </div>
                  )
                }
                return (
                  <div className="class-play-exam-stem-stack">
                    {pos === 'top' ? media : null}
                    {stemText}
                    {pos === 'bottom' ? media : null}
                  </div>
                )
              })()
            ) : null}

            {isQuiz ? (
              <>
                <p className="class-play-exam-instruction">
                  {allowMultiTry
                    ? autoAdvanceMultiTry
                      ? 'Chọn đáp án đúng. Đúng hoặc thử hết đáp án sai sẽ tự qua câu.'
                      : 'Chọn đáp án đúng. Nếu sai, bạn có thể thử tiếp và tự bấm để qua câu.'
                    : 'Chọn một đáp án đúng'}
                </p>
                <div className={`quiz-answers ${answerLayoutClass}`}>
                  {(() => {
                    const answers = q?.answers || []
                    const hasKey = answers.some((a) => a.isCorrect)
                    const chosenId = selections[current.id]
                    const tried = quizTried[current.id] || (chosenId ? [chosenId] : [])
                    const pickedCorrect = hasKey && answers.some((a) => a.isCorrect && tried.includes(a.id))
                    const wrongCount = tried.filter((id) => !answers.find((a) => a.id === id)?.isCorrect).length
                    const exhausted =
                      allowMultiTry && hasKey && answers.length >= 2 && wrongCount >= answers.length - 1
                    const revealed = hasKey && (allowMultiTry ? pickedCorrect || exhausted : !!chosenId)
                    const locked = allowMultiTry ? pickedCorrect || exhausted : !!chosenId
                    return answers.map((answer) => {
                      const selected = chosenId === answer.id
                      const wrongTried = tried.includes(answer.id) && !answer.isCorrect
                      const showCorrect = revealed && answer.isCorrect
                      let resultClass = ''
                      if (showCorrect) resultClass = ' is-correct-answer'
                      else if (wrongTried) resultClass = ' is-wrong-answer'
                      const alreadyTried = tried.includes(answer.id)
                      return (
                        <button
                          key={answer.id}
                          type="button"
                          disabled={locked || (allowMultiTry && alreadyTried)}
                          className={`class-play-answer class-play-exam-choice${answerLayoutClass === 'quiz-answers--tiles' ? ' is-tile' : ''}${selected ? ' is-selected' : ''}${resultClass}${fxClassOf(`quiz:${answer.id}`)}`}
                          onClick={() => {
                            if (allowMultiTry) {
                              setQuizTried((prev) => {
                                const prevTried = prev[current.id] || []
                                if (prevTried.includes(answer.id)) return prev
                                return { ...prev, [current.id]: [...prevTried, answer.id] }
                              })
                            }
                            setSelections((prev) => ({ ...prev, [current.id]: answer.id }))
                            if (hasKey) triggerAnswerFx(`quiz:${answer.id}`, answer.isCorrect === true)
                          }}
                          style={playStyle(answer, q?.settings, {
                            selected,
                            revealed,
                            wrongTried,
                            showCorrect,
                          })}
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
                {allowMultiTry
                  ? (() => {
                      const answers = q?.answers || []
                      const hasKey = answers.some((a) => a.isCorrect)
                      const tried = quizTried[current.id] || []
                      const pickedCorrect = hasKey && answers.some((a) => a.isCorrect && tried.includes(a.id))
                      const wrongCount = tried.filter((id) => !answers.find((a) => a.id === id)?.isCorrect).length
                      const exhausted = hasKey && answers.length >= 2 && wrongCount >= answers.length - 1
                      const skipLabel = index >= total - 1 ? 'Hoàn thành' : 'Câu tiếp theo'
                      if (exhausted && !pickedCorrect) {
                        return (
                          <p className="class-play-retry-hint">
                            Đã hiện đáp án đúng. Bấm {skipLabel} để đi tiếp.
                          </p>
                        )
                      }
                      if (wrongCount > 0 && !pickedCorrect) {
                        return (
                          <p className="class-play-retry-hint">
                            Đáp án vừa chọn chưa đúng. Hãy thử đáp án khác, hoặc bấm {skipLabel} để đi luôn.
                          </p>
                        )
                      }
                      return null
                    })()
                  : null}
              </>
            ) : null}

            {isTrueFalse ? (
              <>
                <p className="class-play-exam-instruction">Chọn đúng hoặc sai</p>
                <div className="class-play-tf">
                  {(q?.statements || [])
                    .filter((s) => s.content?.trim())
                    .map((statement, i) => {
                      const chosen = tfSelections[current.id] || {}
                      const picked = chosen[statement.id]
                      const revealed = typeof picked === 'boolean'
                      const correctVal = statement.isTrue === true
                      return (
                        <div key={statement.id} className="class-play-tf-item">
                          <p className="class-play-tf-text">
                            {statementLabel(i)}) {statement.content}
                          </p>
                          <div className="class-play-tf-btns">
                            {[
                              { value: true, label: 'Đúng' },
                              { value: false, label: 'Sai' },
                            ].map((opt) => {
                              const selected = picked === opt.value
                              let resultClass = ''
                              if (revealed) {
                                if (opt.value === correctVal) resultClass = ' is-correct-answer'
                                else if (selected) resultClass = ' is-wrong-answer'
                              } else if (selected) {
                                resultClass = ' is-selected'
                              }
                              return (
                                <button
                                  key={String(opt.value)}
                                  type="button"
                                  disabled={revealed}
                                  className={`class-play-tf-btn${resultClass}${fxClassOf(`tf:${statement.id}:${String(opt.value)}`)}`}
                                  onClick={() => {
                                    pickTf(statement.id, opt.value)
                                    triggerAnswerFx(`tf:${statement.id}:${String(opt.value)}`, opt.value === correctVal)
                                  }}
                                >
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </>
            ) : null}

            {isEssay ? (
              <div className="class-play-essay">
                <label className="quiz-field">
                  <span>Đáp án của bạn</span>
                  <input
                    className={`class-play-exam-input${essayResults[current.id] === 'correct' ? ' is-correct-answer' : ''}${essayResults[current.id] === 'wrong' ? ' is-wrong-answer' : ''}${fxClassOf(`essay:${current.id}`)}`}
                    type="text"
                    value={essayDrafts[current.id] || ''}
                    disabled={
                      allowMultiTry
                        ? essayResults[current.id] === 'correct'
                        : !!essayResults[current.id]
                    }
                    onChange={(e) =>
                      setEssayDrafts((prev) => ({ ...prev, [current.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      gradeEssayAndMaybeAdvance(essayDrafts[current.id] || '', true)
                    }}
                    placeholder="Nhập đáp án"
                    autoComplete="off"
                  />
                </label>
                {!essayResults[current.id] ||
                (allowMultiTry && essayResults[current.id] === 'wrong') ? (
                  <button
                    type="button"
                    className="quiz-secondary-btn class-play-essay-submit"
                    onClick={() => gradeEssayAndMaybeAdvance(essayDrafts[current.id] || '', true)}
                  >
                    Kiểm tra đáp án
                  </button>
                ) : null}
                {allowMultiTry && essayResults[current.id] === 'wrong' ? (
                  <p className="class-play-retry-hint">
                    Chưa đúng. Hãy thử lại, hoặc bấm {index >= total - 1 ? 'Hoàn thành' : 'Câu tiếp theo'} để đi luôn.
                  </p>
                ) : null}
                {classData.showEssayHints !== false && (q?.answers || []).some((a) => a.content.trim()) ? (
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
            ) : null}
          </article>

          <footer className="class-play-nav">
            <button type="button" className="class-play-nav-btn" onClick={goPrev} disabled={index === 0}>
              <IconChevronLeft />
              Câu trước
            </button>
            <button
              type="button"
              className="quiz-primary-btn class-play-next"
              onClick={() => {
                if (isEssay && essayKeys(q).length) {
                  if (!essayResults[current.id]) {
                    gradeEssayAndMaybeAdvance(essayDrafts[current.id] || '', true, {
                      skipIfWrong: allowMultiTry,
                    })
                    return
                  }
                  if (allowMultiTry && essayResults[current.id] === 'wrong') {
                    goNext()
                    return
                  }
                }
                goNext()
              }}
            >
              {index >= total - 1 ? 'Hoàn thành' : 'Câu tiếp theo'}
              {index < total - 1 ? <IconChevronRight /> : null}
            </button>
          </footer>
        </div>
      )}

      {rankOpen ? (
        <div className="play-rank-overlay" onClick={() => setRankOpen(false)}>
          <div
            className="play-rank-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="play-rank-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="play-rank-head">
              <div>
                <p className="play-rank-kicker">Phòng · Điểm</p>
                <h3 id="play-rank-title">Bảng xếp hạng</h3>
              </div>
              <button
                type="button"
                className="class-play-close"
                onClick={() => setRankOpen(false)}
                aria-label="Đóng bảng xếp hạng"
              >
                <IconClose />
              </button>
            </header>
            {leaderboard.length ? (
              <div className="play-rank-table-wrap">
                <table className="play-rank-table">
                  <thead>
                    <tr>
                      <th>Top</th>
                      <th>Họ và tên</th>
                      <th>Điểm</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row) => {
                      const medal = medalFor(row.rank)
                      const isMe = profile?.id && row.userId === profile.id
                      return (
                        <tr key={row.userId} className={isMe ? 'is-me' : ''}>
                          <td>
                            <span className={`play-rank-badge is-top-${Math.min(row.rank, 4)}`}>
                              {medal ? <span aria-hidden="true">{medal}</span> : null}
                              {row.rank}
                            </span>
                          </td>
                          <td>
                            <div className="play-rank-name">
                              <span className="play-rank-avatar" aria-hidden="true">
                                {initialOf(row.userName)}
                              </span>
                              <strong>
                                {row.userName}
                                {isMe ? <em className="play-rank-you">Bạn</em> : null}
                              </strong>
                            </div>
                          </td>
                          <td>
                            <b>
                              {row.correct}/{row.total}
                            </b>
                          </td>
                          <td className="play-rank-duration">{formatDurationVN(row.durationMs)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="play-rank-empty">Chưa có ai hoàn thành phòng này.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
