import { useCallback, useEffect, useMemo, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './HomeworkBoard.css'

const SUBJECT_OPTIONS = [
  'Ngữ văn',
  'Toán',
  'CĐ Toán',
  'Tiếng Anh',
  'Tiếng Anh NN',
  'Hóa học',
  'CĐ Hóa học',
  'Vật lí',
  'CĐ Vật lí',
  'Sinh học',
  'Lịch sử',
  'Địa lí',
  'GD địa phương',
  'GDQP và AN',
  'GD thể',
  'Công nghệ',
  'Tin học',
  'Tin học Quốc tế',
  'STEM',
  'Trí tuệ nhân tạo',
  'HĐTN 1',
  'HĐTN 2',
  'HĐTN 3',
  'Tự học',
  'Câu lạc bộ',
  'Sinh hoạt lớp',
]

const SUBJECT_OTHER = '__other__'

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatVNDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function defaultTitle(isoDate) {
  return `Báo bài ngày ${formatVNDate(isoDate) || '…'}`
}

export default function HomeworkBoard({ isAdmin }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showComposer, setShowComposer] = useState(false)
  const [posting, setPosting] = useState(false)

  const [reportDate, setReportDate] = useState(todayISO())
  const [title, setTitle] = useState(defaultTitle(todayISO()))
  const [editingTitle, setEditingTitle] = useState(false)
  const [hasExam, setHasExam] = useState(false)
  const [examDate, setExamDate] = useState('')
  const [examSubjectSelect, setExamSubjectSelect] = useState('')
  const [examSubjectOther, setExamSubjectOther] = useState('')
  const [examContent, setExamContent] = useState('')
  const [experimentContent, setExperimentContent] = useState('')
  const [homeworkContent, setHomeworkContent] = useState('')

  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterTypes, setFilterTypes] = useState({
    exam: true,
    experiment: true,
    homework: true,
  })

  const fetchPosts = useCallback(async () => {
    try {
      const data = await classroomService.getHomework()
      setPosts(Array.isArray(data?.items) ? data.items : [])
      setError('')
    } catch (err) {
      setError(err.message || 'Không tải được báo bài.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
    const interval = setInterval(fetchPosts, 60000)
    return () => clearInterval(interval)
  }, [fetchPosts])

  useEffect(() => {
    if (!editingTitle) {
      setTitle(defaultTitle(reportDate))
    }
  }, [reportDate, editingTitle])

  const resolvedSubject = () => {
    if (examSubjectSelect === SUBJECT_OTHER) return examSubjectOther.trim()
    return examSubjectSelect.trim()
  }

  const closeComposer = () => {
    if (posting) return
    const today = todayISO()
    setReportDate(today)
    setTitle(defaultTitle(today))
    setEditingTitle(false)
    setHasExam(false)
    setExamDate('')
    setExamSubjectSelect('')
    setExamSubjectOther('')
    setExamContent('')
    setExperimentContent('')
    setHomeworkContent('')
    setShowComposer(false)
  }

  const handlePost = async () => {
    if (!isAdmin) return
    const exam = examContent.trim()
    const exp = experimentContent.trim()
    const hw = homeworkContent.trim()
    const subject = resolvedSubject()

    if (hasExam) {
      if (!examDate) return alert('Vui lòng chọn ngày kiểm tra!')
      if (!subject) return alert('Vui lòng chọn hoặc nhập môn kiểm tra!')
      if (!exam) return alert('Vui lòng nhập nội dung kiểm tra!')
    }
    if (!exp && !hw && !(hasExam && exam)) {
      return alert('Vui lòng nhập ít nhất một nội dung (kiểm tra / thí nghiệm / BTVN)!')
    }

    setPosting(true)
    try {
      await classroomService.createHomework({
        title: title.trim() || defaultTitle(reportDate),
        report_date: reportDate,
        has_exam: hasExam,
        exam_date: hasExam ? examDate : null,
        exam_subject: hasExam ? subject : '',
        exam_content: hasExam ? exam : '',
        experiment_content: exp,
        homework_content: hw,
      })
      closeComposer()
      setLoading(true)
      await fetchPosts()
    } catch (err) {
      alert(err.message || 'Đăng báo bài thất bại.')
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!isAdmin) return
    if (!window.confirm('Bạn có chắc chắn muốn xóa báo bài này? (Thông báo kiểm tra liên quan cũng sẽ bị xóa)'))
      return
    try {
      await classroomService.deleteHomework(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      alert(err.message || 'Xóa thất bại.')
    }
  }

  const toggleFilterType = (key) => {
    setFilterTypes((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      const d = p.report_date || (p.created_at ? String(p.created_at).slice(0, 10) : '')
      if (filterFrom && d && d < filterFrom) return false
      if (filterTo && d && d > filterTo) return false

      const hasE = p.has_exam && p.exam_content
      const hasExp = !!p.experiment_content
      const hasHw = !!p.homework_content

      const anyTypeOn = filterTypes.exam || filterTypes.experiment || filterTypes.homework
      if (!anyTypeOn) return false

      const matchExam = filterTypes.exam && hasE
      const matchExp = filterTypes.experiment && hasExp
      const matchHw = filterTypes.homework && hasHw

      if (!matchExam && !matchExp && !matchHw) return false
      return true
    })
  }, [posts, filterFrom, filterTo, filterTypes])

  return (
    <div className="hw-board">
      <div className="hw-filters">
        <div className="hw-filter-dates">
          <label>
            Từ ngày
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
            />
          </label>
          {(filterFrom || filterTo) && (
            <button
              type="button"
              className="hw-filter-clear"
              onClick={() => {
                setFilterFrom('')
                setFilterTo('')
              }}
            >
              Xóa ngày
            </button>
          )}
        </div>
        <div className="hw-filter-types" role="group" aria-label="Lọc loại nội dung">
          <button
            type="button"
            className={`hw-chip${filterTypes.exam ? ' is-on is-exam' : ''}`}
            onClick={() => toggleFilterType('exam')}
          >
            Kiểm tra
          </button>
          <button
            type="button"
            className={`hw-chip${filterTypes.experiment ? ' is-on is-exp' : ''}`}
            onClick={() => toggleFilterType('experiment')}
          >
            Thí nghiệm / thuyết trình…
          </button>
          <button
            type="button"
            className={`hw-chip${filterTypes.homework ? ' is-on is-hw' : ''}`}
            onClick={() => toggleFilterType('homework')}
          >
            BTVN
          </button>
        </div>
      </div>

      {loading ? (
        <div className="hw-state">
          <span className="hw-spinner" aria-hidden="true" />
          <p>Đang tải báo bài...</p>
        </div>
      ) : error ? (
        <div className="hw-state hw-state--error">
          <p>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="hw-empty">Chưa có báo bài nào{posts.length ? ' khớp bộ lọc' : ''}.</p>
      ) : (
        <div className="hw-list">
          {filtered.map((post) => (
            <article key={post.id} className="hw-card">
              <h3 className="hw-title">{post.title}</h3>

              <div className="hw-body">
                {post.has_exam && post.exam_content ? (
                  <div className="hw-block hw-block--exam">
                    <div className="hw-block-label">Kiểm tra</div>
                    <div className="hw-exam-meta">
                      {post.exam_subject ? (
                        <span className="hw-exam-pill">Môn: {post.exam_subject}</span>
                      ) : null}
                      {post.exam_date ? (
                        <span className="hw-exam-pill">Ngày: {formatVNDate(post.exam_date)}</span>
                      ) : null}
                    </div>
                    <p className="hw-block-text">{post.exam_content}</p>
                  </div>
                ) : null}

                {post.experiment_content ? (
                  <div className="hw-block hw-block--exp">
                    <div className="hw-block-label">Thí nghiệm, thuyết trình…</div>
                    <p className="hw-block-text">{post.experiment_content}</p>
                  </div>
                ) : null}

                {post.homework_content ? (
                  <div className="hw-block hw-block--hw">
                    <div className="hw-block-label">BTVN</div>
                    <p className="hw-block-text">{post.homework_content}</p>
                  </div>
                ) : null}
              </div>

              <div className="hw-meta">
                <span className="hw-meta-info">
                  {post.report_date ? `Ngày ${formatVNDate(post.report_date)} · ` : ''}
                  {post.created_by_name || 'Admin'} ·{' '}
                  {new Date(post.created_at).toLocaleString('vi-VN')}
                </span>
                {isAdmin ? (
                  <button
                    type="button"
                    className="hw-btn-delete"
                    onClick={() => handleDelete(post.id)}
                  >
                    Xóa
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {isAdmin ? (
        <button
          type="button"
          className="hw-fab"
          onClick={() => setShowComposer(true)}
          aria-label="Đăng báo bài mới"
          title="Đăng báo bài mới"
        >
          +
        </button>
      ) : null}

      {showComposer ? (
        <div className="hw-composer-overlay" onClick={closeComposer} role="presentation">
          <div
            className="hw-composer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hw-composer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="hw-composer-header">
              <h2 id="hw-composer-title">Đăng báo bài</h2>
              <button
                type="button"
                className="hw-composer-close"
                onClick={closeComposer}
                disabled={posting}
              >
                ✕
              </button>
            </header>

            <div className="hw-composer-body">
              <div className="hw-title-row">
                {editingTitle ? (
                  <input
                    className="hw-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <h3 className="hw-title-preview">{title}</h3>
                )}
                <button
                  type="button"
                  className="hw-btn-edit-title"
                  onClick={() => setEditingTitle((v) => !v)}
                  title={editingTitle ? 'Xong' : 'Chỉnh tiêu đề'}
                >
                  {editingTitle ? '✓' : '✎'}
                </button>
              </div>

              <label className="hw-field">
                Ngày báo bài
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => {
                    setReportDate(e.target.value)
                    if (!editingTitle) {
                      setTitle(defaultTitle(e.target.value))
                    }
                  }}
                />
              </label>

              <div className="hw-toggle-row">
                <span className="hw-toggle-label">Có bài kiểm tra không?</span>
                <button
                  type="button"
                  className={`hw-switch${hasExam ? ' is-on' : ''}`}
                  role="switch"
                  aria-checked={hasExam}
                  onClick={() => setHasExam((v) => !v)}
                >
                  <span className="hw-switch-knob" />
                </button>
              </div>

              {hasExam ? (
                <div className="hw-exam-fields">
                  <label className="hw-field">
                    Ngày kiểm tra
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                    />
                  </label>

                  <label className="hw-field">
                    Môn kiểm tra
                    <select
                      className="hw-select"
                      value={examSubjectSelect}
                      onChange={(e) => setExamSubjectSelect(e.target.value)}
                    >
                      <option value="">— Chọn môn —</option>
                      {SUBJECT_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value={SUBJECT_OTHER}>Khác…</option>
                    </select>
                  </label>

                  {examSubjectSelect === SUBJECT_OTHER ? (
                    <label className="hw-field">
                      Tên môn khác
                      <input
                        type="text"
                        className="hw-text-input"
                        placeholder="Nhập tên môn..."
                        value={examSubjectOther}
                        onChange={(e) => setExamSubjectOther(e.target.value)}
                      />
                    </label>
                  ) : null}

                  <label className="hw-field">
                    Nội dung kiểm tra
                    <textarea
                      className="hw-textarea hw-textarea--exam"
                      rows={3}
                      placeholder="Nhập nội dung kiểm tra..."
                      value={examContent}
                      onChange={(e) => setExamContent(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              <label className="hw-field">
                Thí nghiệm, thuyết trình…
                <textarea
                  className="hw-textarea"
                  rows={3}
                  placeholder="Nhập nội dung thí nghiệm / thuyết trình (nếu có)..."
                  value={experimentContent}
                  onChange={(e) => setExperimentContent(e.target.value)}
                />
              </label>

              <label className="hw-field">
                BTVN
                <textarea
                  className="hw-textarea"
                  rows={4}
                  placeholder="Nhập bài tập về nhà..."
                  value={homeworkContent}
                  onChange={(e) => setHomeworkContent(e.target.value)}
                />
              </label>
            </div>

            <footer className="hw-composer-footer">
              <button
                type="button"
                className="hw-btn-post"
                onClick={handlePost}
                disabled={posting}
              >
                {posting ? 'Đang đăng...' : 'Đăng bài'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
