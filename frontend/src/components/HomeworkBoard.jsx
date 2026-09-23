import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as classroomService from '../services/classroomService.js'
import { parseClassPath, homeworkDetailPath, parseHomeworkSegment, classTabPath } from '../lib/routes.js'
import HomeworkSubmissionPanel from './HomeworkSubmissionPanel.jsx'
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

/** Poll nhanh khi đang mở board (gần realtime). */
const POLL_MS = 8_000

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

function HomeworkReportBoard({ isAdmin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [posts, setPosts] = useState([])
  const [detailPost, setDetailPost] = useState(null)
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

  const fetchPosts = useCallback(async (opts = {}) => {
    const silent = opts.silent === true
    if (!silent) setLoading(true)
    try {
      const data = await classroomService.getHomework()
      setPosts(Array.isArray(data?.items) ? data.items : [])
      setError('')
    } catch (err) {
      if (!silent) setError(err.message || 'Không tải được báo bài.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()

    const tick = () => {
      if (document.visibilityState === 'visible') fetchPosts({ silent: true })
    }
    const interval = setInterval(tick, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchPosts({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)

    const onRefresh = () => fetchPosts({ silent: true })
    window.addEventListener('classweb-class-refresh', onRefresh)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('classweb-class-refresh', onRefresh)
    }
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
      window.dispatchEvent(new CustomEvent('classweb-class-refresh'))
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
      window.dispatchEvent(new CustomEvent('classweb-class-refresh'))
    } catch (err) {
      alert(err.message || 'Xóa thất bại.')
    }
  }

  const handleSharePost = async (post) => {
    const url = new URL(homeworkDetailPath(post.id), window.location.origin).toString()
    const text = `${post.title || 'Bài tập về nhà'}\n${url}`
    try {
      if (navigator.share) await navigator.share({ title: post.title || 'Bài tập về nhà', text: post.title || 'Bài tập về nhà', url })
      else {
        await navigator.clipboard.writeText(text)
        alert('Đã sao chép liên kết bài tập.')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') alert('Không thể chia sẻ bài tập. Bạn có thể sao chép URL trên thanh địa chỉ.')
    }
  }

  const openDetail = (post, opts = {}) => {
    if (!post) return
    setDetailPost(post)
    if (!opts.silent) navigate(homeworkDetailPath(post.id))
  }
  const closeDetail = () => {
    setDetailPost(null)
    navigate(classTabPath('homework'), { replace: true })
  }

  // Truy cập trực tiếp bằng URL /bai-tap-ve-nha/bao-bai-:x -> tự mở Modal
  // chi tiết báo bài tương ứng.
  useEffect(() => {
    const { rest } = parseClassPath(location.pathname)
    const id = parseHomeworkSegment(rest)
    if (!id) {
      if (detailPost) setDetailPost(null)
      return
    }
    if (detailPost && String(detailPost.id) === String(id)) return
    const found = posts.find((p) => String(p.id) === String(id))
    if (found) openDetail(found, { silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, posts])

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
            <article
              key={post.id}
              className="hw-card hw-card--clickable"
              role="button"
              tabIndex={0}
              onClick={() => openDetail(post)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openDetail(post)
                }
              }}
            >
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
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(post.id)
                    }}
                  >
                    Xóa
                  </button>
                ) : null}
                <button
                  type="button"
                  className="hw-btn-share"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSharePost(post)
                  }}
                >
                  Chia sẻ
                </button>
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

      {detailPost ? (
        <div className="hw-composer-overlay" onClick={closeDetail} role="presentation">
          <div
            className="hw-composer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hw-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="hw-composer-header">
              <h2 id="hw-detail-title">{detailPost.title}</h2>
              <button type="button" className="hw-composer-close" onClick={closeDetail} aria-label="Đóng">
                ✕
              </button>
            </header>

            <div className="hw-composer-body">
              {detailPost.has_exam && detailPost.exam_content ? (
                <div className="hw-block hw-block--exam">
                  <div className="hw-block-label">Kiểm tra</div>
                  <div className="hw-exam-meta">
                    {detailPost.exam_subject ? (
                      <span className="hw-exam-pill">Môn: {detailPost.exam_subject}</span>
                    ) : null}
                    {detailPost.exam_date ? (
                      <span className="hw-exam-pill">Ngày: {formatVNDate(detailPost.exam_date)}</span>
                    ) : null}
                  </div>
                  <p className="hw-block-text">{detailPost.exam_content}</p>
                </div>
              ) : null}

              {detailPost.experiment_content ? (
                <div className="hw-block hw-block--exp">
                  <div className="hw-block-label">Thí nghiệm, thuyết trình…</div>
                  <p className="hw-block-text">{detailPost.experiment_content}</p>
                </div>
              ) : null}

              {detailPost.homework_content ? (
                <div className="hw-block hw-block--hw">
                  <div className="hw-block-label">BTVN</div>
                  <p className="hw-block-text">{detailPost.homework_content}</p>
                </div>
              ) : null}

              <p className="hw-meta-info">
                {detailPost.report_date ? `Ngày ${formatVNDate(detailPost.report_date)} · ` : ''}
                {detailPost.created_by_name || 'Admin'} ·{' '}
                {new Date(detailPost.created_at).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
        </div>
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

/** Bài tập về nhà: 2 chế độ — Báo bài (mặc định) / Nộp bài. */
export default function HomeworkBoard({ isAdmin }) {
  const [mode, setMode] = useState('report')
  return (
    <div className="hw-root">
      <div className="hw-mode-tabs" role="tablist" aria-label="Chế độ bài tập về nhà">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'report'}
          className={`hw-mode-tab${mode === 'report' ? ' is-active' : ''}`}
          onClick={() => setMode('report')}
        >
          Báo bài
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'submit'}
          className={`hw-mode-tab${mode === 'submit' ? ' is-active' : ''}`}
          onClick={() => setMode('submit')}
        >
          Nộp bài
        </button>
      </div>
      {mode === 'submit' ? (
        <HomeworkSubmissionPanel canManage={isAdmin === true} />
      ) : (
        <HomeworkReportBoard isAdmin={isAdmin} />
      )}
    </div>
  )
}
