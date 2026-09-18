import { useEffect, useRef, useState } from 'react'
import QuizArchivePanel from './QuizArchivePanel.jsx'
import EssayArchivePanel from './EssayArchivePanel.jsx'
import AddQuestionPanel from './AddQuestionPanel.jsx'
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

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

const ARCHIVE_TABS = [
  { id: 'quiz', label: 'Trắc nghiệm' },
  { id: 'essay', label: 'Tự luận' },
]

export default function CreateClassPage({ onBack, editingClass, ownerId, ownerName, onSaved }) {
  const isEditing = !!editingClass
  const [title, setTitle] = useState(editingClass?.title || '')
  const [coverName, setCoverName] = useState('')
  const [coverPreview, setCoverPreview] = useState(editingClass?.cover || '')
  const [coverError, setCoverError] = useState('')
  const [isPublic, setIsPublic] = useState(editingClass ? editingClass.isPublic !== false : true)
  const [password, setPassword] = useState(editingClass?.password || '')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveTitle, setArchiveTitle] = useState('')
  const [archiveTab, setArchiveTab] = useState('quiz')
  const [quizQuestions, setQuizQuestions] = useState([])
  const [essayQuestions, setEssayQuestions] = useState([])
  const [classQuestions, setClassQuestions] = useState(editingClass?.questions || [])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shuffleQuestions, setShuffleQuestions] = useState(!!editingClass?.shuffle)
  const [submitError, setSubmitError] = useState('')
  const fileInputRef = useRef(null)
  const archiveTitleRef = useRef(null)

  // Lưu ý: KHÔNG tự thu hồi (revokeObjectURL) ảnh nền khi component này unmount.
  // Ảnh nền dùng chung một blob url với ô lớp học hiển thị ở danh sách "Lớp học"
  // sau khi tạo/lưu — thu hồi ở đây sẽ làm ảnh trong ô đó biến mất ngay khi đóng
  // trang tạo/chỉnh sửa. Việc thu hồi khi đổi/xóa ảnh vẫn diễn ra bình thường ở
  // handleCoverChange/clearCover bên dưới.

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
      if (document.querySelector('.quiz-settings-overlay, .custom-editor-overlay, .archive-picker-overlay')) return
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

  // "Cài đặt lớp học" dùng chung class .quiz-settings-overlay nên ESC ở effect
  // phía trên đã tự bỏ qua khi bảng này đang mở (không đóng nhầm cả trang).

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

  const handleCreateClass = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setSubmitError('Vui lòng nhập tiêu đề lớp học.')
      return
    }
    if (!isPublic && password.length !== 6) {
      setSubmitError('Lớp riêng tư cần đặt mật khẩu đủ 6 chữ số.')
      return
    }
    setSubmitError('')

    const payload = {
      title: trimmedTitle,
      cover: coverPreview,
      isPublic,
      password,
      shuffle: shuffleQuestions,
      questions: classQuestions,
    }

    if (isEditing) {
      onSaved?.({ mode: 'update', id: editingClass.id, patch: payload })
    } else {
      onSaved?.({ mode: 'create', payload: { ...payload, ownerId, ownerName } })
    }
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
          <h1>{isEditing ? 'Chỉnh sửa lớp học' : 'Tạo lớp học'}</h1>
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

        <AddQuestionPanel
          quizArchive={quizQuestions}
          essayArchive={essayQuestions}
          questions={classQuestions}
          onQuestionsChange={setClassQuestions}
        />

        <div className="create-class-settings">
          <button
            type="button"
            className="create-class-archive-btn create-class-settings-btn"
            onClick={() => setSettingsOpen(true)}
          >
            <IconGear />
            Cài đặt lớp học
          </button>

          {submitError ? <p className="create-class-error">{submitError}</p> : null}

          <button type="button" className="create-class-submit-btn" onClick={handleCreateClass}>
            {isEditing ? 'Lưu thay đổi' : 'Tạo lớp học'}
          </button>
        </div>
      </div>

      {settingsOpen ? (
        <div
          className="quiz-settings-overlay"
          onClick={(e) => {
            e.stopPropagation()
            setSettingsOpen(false)
          }}
        >
          <div
            className="quiz-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="quiz-settings-head">
              <div>
                <p className="quiz-card-kicker">Lớp học</p>
                <h3 id="class-settings-title">Cài đặt lớp học</h3>
              </div>
              <button
                type="button"
                className="archive-close"
                onClick={() => setSettingsOpen(false)}
                aria-label="Đóng cài đặt lớp học"
              >
                <IconClose />
              </button>
            </header>

            <div className="quiz-settings-body">
              <div className="create-class-privacy-row">
                <div>
                  <p className="create-class-privacy-q">Xáo trộn các câu hỏi</p>
                  <p className="create-class-hint">
                    {shuffleQuestions
                      ? 'Bật: mỗi lần vào lớp học, câu hỏi hiển thị không theo thứ tự ban đầu.'
                      : 'Tắt: câu hỏi hiển thị đúng theo thứ tự đã sắp xếp ở trên.'}
                  </p>
                </div>
                <button
                  type="button"
                  className={`create-class-switch${shuffleQuestions ? ' is-on' : ''}`}
                  role="switch"
                  aria-checked={shuffleQuestions}
                  aria-label="Xáo trộn các câu hỏi"
                  onClick={() => setShuffleQuestions((v) => !v)}
                >
                  <span className="create-class-switch-knob" />
                </button>
              </div>
            </div>

            <footer className="quiz-settings-foot">
              <button type="button" className="quiz-primary-btn" onClick={() => setSettingsOpen(false)}>
                Xong
              </button>
            </footer>
          </div>
        </div>
      ) : null}

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
                    {tab.id === 'essay' ? (
                      <EssayArchivePanel questions={essayQuestions} onQuestionsChange={setEssayQuestions} />
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
