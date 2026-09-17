import { useEffect, useRef, useState } from 'react'
import QuizArchivePanel from './QuizArchivePanel.jsx'
import './CreateClassPage.css'

const MAX_COVER_BYTES = 10 * 1024 * 1024

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5 L8 12 L15 19" />
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

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="M21 16.5 16 12l-3.2 3.2L10 13l-7 6" />
    </svg>
  )
}

function IconArchive() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="5" rx="1.4" />
      <path d="M5 9v10.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M10 13h4" />
    </svg>
  )
}

const ARCHIVE_TABS = [
  { id: 'quiz', label: 'Trắc nghiệm' },
  { id: 'essay', label: 'Tự luận' },
]

export default function CreateClassPage({ onBack }) {
  const [title, setTitle] = useState('')
  const [coverName, setCoverName] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [coverError, setCoverError] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [password, setPassword] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveTitle, setArchiveTitle] = useState('')
  const [archiveTab, setArchiveTab] = useState('quiz')
  const [quizQuestions, setQuizQuestions] = useState([])
  const fileInputRef = useRef(null)
  const archiveTitleRef = useRef(null)

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  useEffect(() => {
    return () => {
      quizQuestions.forEach((q) => {
        q.answers.forEach((a) => {
          if (a.imagePreview) URL.revokeObjectURL(a.imagePreview)
        })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!archiveOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const id = window.requestAnimationFrame(() => archiveTitleRef.current?.focus())
    return () => {
      document.body.style.overflow = prevOverflow
      window.cancelAnimationFrame(id)
    }
  }, [archiveOpen])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.quiz-settings-overlay')) return
      e.preventDefault()
      e.stopPropagation()
      if (archiveOpen) {
        setArchiveOpen(false)
        return
      }
      onBack?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onBack, archiveOpen])

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCoverError('Vui lòng chọn một tập tin ảnh.')
      return
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError('Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.')
      return
    }
    setCoverError('')
    setCoverName(file.name)
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const clearCover = () => {
    setCoverName('')
    setCoverError('')
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
  }

  const handlePassword = (e) => {
    setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))
  }

  const openArchive = () => {
    setArchiveTab('quiz')
    setArchiveOpen(true)
  }

  return (
    <div className="create-class-page" role="dialog" aria-modal={!archiveOpen} aria-label="Tạo lớp học">
      <button type="button" className="create-class-back" onClick={onBack}>
        <IconBack />
        Quay về
      </button>

      <div className="create-class-sheet" aria-hidden={archiveOpen || undefined}>
        <header className="create-class-heading">
          <p className="create-class-kicker">Lớp học 10A4</p>
          <h1>Tạo lớp học</h1>
        </header>

        <div className="create-class-field">
          <label htmlFor="create-class-title">Tiêu đề lớp học</label>
          <input
            id="create-class-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Ôn tập học kỳ I"
            autoComplete="off"
          />
        </div>

        <div className="create-class-field">
          <span className="create-class-label" id="create-class-cover-label">Ảnh nền</span>
          <input
            ref={fileInputRef}
            id="create-class-cover"
            className="create-class-file"
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            aria-labelledby="create-class-cover-label"
          />
          {coverPreview ? (
            <div className="create-class-cover is-filled">
              <img src={coverPreview} alt="Ảnh nền đã chọn" />
              <div className="create-class-cover-meta">
                <p className="create-class-cover-name">{coverName || 'Ảnh nền'}</p>
                <p className="create-class-hint">Tối đa 1 ảnh, dung lượng ≤ 10MB</p>
                <div className="create-class-cover-actions">
                  <button type="button" className="create-class-ghost" onClick={() => fileInputRef.current?.click()}>
                    Đổi ảnh
                  </button>
                  <button type="button" className="create-class-ghost" onClick={clearCover}>
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="create-class-cover"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="create-class-cover-icon">
                <IconImage />
              </span>
              <span className="create-class-cover-copy">
                <strong>Chọn ảnh nền</strong>
                <span>Tối đa 1 ảnh, dung lượng ≤ 10MB</span>
              </span>
            </button>
          )}
          {coverError ? <p className="create-class-error">{coverError}</p> : null}
        </div>

        <div className="create-class-privacy">
          <div className="create-class-privacy-row">
            <div>
              <p className="create-class-privacy-q">Để lớp học ở chế độ công khai hay riêng tư?</p>
              <p className="create-class-hint">
                {isPublic
                  ? 'Công khai: ai cũng bấm vào được.'
                  : 'Riêng tư: bắt buộc nhập đúng mật khẩu mới được vào lớp.'}
              </p>
            </div>
            <button
              type="button"
              className={`create-class-switch${isPublic ? ' is-on' : ''}`}
              role="switch"
              aria-checked={isPublic}
              aria-label={isPublic ? 'Công khai' : 'Riêng tư'}
              onClick={() => setIsPublic((v) => !v)}
            >
              <span className="create-class-switch-knob" />
            </button>
          </div>
          <p className={`create-class-mode${isPublic ? ' is-public' : ' is-private'}`}>
            {isPublic ? 'Công khai' : 'Riêng tư'}
          </p>

          {!isPublic ? (
            <div className="create-class-field create-class-password">
              <label htmlFor="create-class-pin">Mật khẩu 6 chữ số</label>
              <input
                id="create-class-pin"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={password}
                onChange={handlePassword}
                placeholder="••••••"
                aria-describedby="create-class-pin-hint"
              />
              <p id="create-class-pin-hint" className="create-class-hint">
                {password.length === 6
                  ? 'Mật khẩu đã đủ 6 chữ số.'
                  : 'Chỉ nhập số. Học sinh cần đúng mật khẩu này mới vào được lớp.'}
              </p>
            </div>
          ) : null}
        </div>

        <button type="button" className="create-class-archive-btn" onClick={openArchive}>
          <IconArchive />
          Kho lưu trữ
        </button>
      </div>

      {archiveOpen ? (
        <div
          className="archive-overlay"
          onClick={() => setArchiveOpen(false)}
        >
          <div
            className="archive-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="archive-head">
              <h2 id="archive-heading">Kho lưu trữ</h2>
              <button
                type="button"
                className="archive-close"
                onClick={() => setArchiveOpen(false)}
                aria-label="Đóng kho lưu trữ"
              >
                <IconClose />
              </button>
            </div>

            <div className="archive-title-wrap">
              <label htmlFor="archive-title">Tiêu đề chỉnh sửa</label>
              <input
                ref={archiveTitleRef}
                id="archive-title"
                type="text"
                value={archiveTitle}
                onChange={(e) => setArchiveTitle(e.target.value)}
                placeholder="Đặt tiêu đề cho nội dung chỉnh sửa"
                autoComplete="off"
              />
            </div>

            <div className="archive-chrome">
              <div className="archive-tabstrip" role="tablist" aria-label="Loại câu hỏi">
                {ARCHIVE_TABS.map((tab) => {
                  const selected = archiveTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`archive-tab-${tab.id}`}
                      aria-selected={selected}
                      aria-controls={`archive-panel-${tab.id}`}
                      tabIndex={selected ? 0 : -1}
                      className={`archive-tab${selected ? ' is-active' : ''}`}
                      onClick={() => setArchiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
              {ARCHIVE_TABS.map((tab) => {
                const selected = archiveTab === tab.id
                return (
                  <div
                    key={tab.id}
                    className="archive-panel"
                    role="tabpanel"
                    id={`archive-panel-${tab.id}`}
                    aria-labelledby={`archive-tab-${tab.id}`}
                    hidden={!selected}
                  >
                    {tab.id === 'quiz' ? (
                      <QuizArchivePanel questions={quizQuestions} onQuestionsChange={setQuizQuestions} />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
