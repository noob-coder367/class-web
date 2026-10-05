import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as classroomService from '../services/classroomService.js'
import { parseClassPath, homeworkDetailPath, parseHomeworkSegment, classTabPath } from '../lib/routes.js'
import HomeworkSubmissionPanel from './HomeworkSubmissionPanel.jsx'
import ExamBoard from './ExamBoard.jsx'
import { shareOfficialDocImage } from '../utils/exportShareImage.jsx'
import './HomeworkBoard.css'
import { getStudyWeekNumber, buildWeekFolders } from '../lib/studyWeek.js'

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

export { getStudyWeekNumber }

function formatVNDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function defaultTitle(isoDate) {
  return `Báo bài ngày ${formatVNDate(isoDate) || '…'}`
}

function IconDocument() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4M8 12h8M8 16h6"/></svg> }
function IconChecklist() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h10M9 12h10M9 19h10"/><path d="m4 5 1.5 1.5L7.5 4M4 12l1.5 1.5L7.5 11M4 19l1.5 1.5L7.5 18"/></svg> }
function IconUpload() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg> }

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
  const [expandedWeek, setExpandedWeek] = useState(null)
  const [filterTypes, setFilterTypes] = useState({
    exam: true,
    experiment: true,
    homework: true,
  })
  const [currentWeek, setCurrentWeek] = useState(() => getStudyWeekNumber())

  useEffect(() => {
    const updateWeek = () => setCurrentWeek(getStudyWeekNumber())
    updateWeek()
    const timer = setInterval(updateWeek, 60 * 1000)
    return () => clearInterval(timer)
  }, [])

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
    const content = [
      post.report_date ? `Ngày báo bài: ${formatVNDate(post.report_date)}` : '',
      post.has_exam && post.exam_content ? `Kiểm tra${post.exam_subject ? ` môn ${post.exam_subject}` : ''}${post.exam_date ? ` ngày ${formatVNDate(post.exam_date)}` : ''}:\n${post.exam_content}` : '',
      post.experiment_content ? `Thí nghiệm:\n${post.experiment_content}` : '',
      post.homework_content ? `Bài tập về nhà:\n${post.homework_content}` : '',
    ].filter(Boolean).join('\n\n')
    const report = {
      ...post,
      section: 'important',
      document_kind: 'bao_cao',
      short_id: post.announcement_short_id || 1,
      title: post.title || 'Báo bài',
      content,
      images: [],
    }
    try {
      await shareOfficialDocImage(report)
    } catch (err) {
      if (err?.name !== 'AbortError') alert(err.message || 'Không thể xuất ảnh bài tập về nhà.')
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

  const weeks = useMemo(
    () => buildWeekFolders(filtered, (post) => post.report_date || String(post.created_at || '').slice(0, 10), currentWeek),
    [filtered, currentWeek]
  )

  return (
    <div className="hw-board">
      <div className="hw-current-week" aria-live="polite">
        <span className="hw-current-week-label">Lịch học kỳ I</span>
        <strong>Tuần {currentWeek}</strong>
        <small>Tính từ mốc 01/09/2026 · tuần học bắt đầu từ Thứ Hai</small>
      </div>
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
      ) : (
        <>
          <div className="hw-tree" aria-label="Các tuần báo bài">
            {weeks.map((week) => {
              const isOpen = expandedWeek === week.key
              return (
              <div key={week.key} className={`hw-tree-item${isOpen ? ' is-open' : ''}`}>
                <button type="button" className={`hw-week-folder${isOpen ? ' is-active' : ''}`} aria-expanded={isOpen} onClick={() => setExpandedWeek((current) => current === week.key ? null : week.key)}>
                  <span className="hw-tree-grip" aria-hidden="true" />
                  <span className="hw-tree-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={isOpen ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} /></svg></span>
                  <span className="hw-folder-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="5" rx="1.2" /><rect x="14" y="10" width="7" height="5" rx="1.2" /><rect x="14" y="17" width="7" height="4" rx="1.2" /><path d="M6.5 8v10.5a1 1 0 0 0 1 1H14M6.5 12.5H14" /></svg></span>
                  <strong>{week.label}</strong><small>{week.items.length} báo bài</small>
                </button>
                {isOpen && week.items.length === 0 ? <div className="hw-tree-children"><p className="hw-week-empty">Không có gì.</p></div> : null}
                {isOpen && week.items.length > 0 ? <div className="hw-tree-children"><div className="hw-list">
          {week.items.map((post) => (
            <div key={post.id} className="hw-file">
              <div className="hw-file-main">
                <span className="hw-file-note" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>
                </span>
                <div className="hw-file-text">
                  <strong className="hw-file-name">{post.title || 'Báo bài'}</strong>
                  <span className="hw-file-meta">
                    {post.report_date ? `Ngày ${formatVNDate(post.report_date)} · ` : ''}
                    {post.created_by_name || 'Admin'} · {new Date(post.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
                <button type="button" className="hw-file-view" onClick={() => openDetail(post)}>Xem</button>
              </div>
              <div className="hw-file-actions">
                <button type="button" className="hw-btn-share" onClick={() => handleSharePost(post)}>Chia sẻ</button>
                {isAdmin ? <button type="button" className="hw-btn-delete" onClick={() => handleDelete(post.id)}>Xóa</button> : null}
              </div>
            </div>
          ))}
                </div></div> : null}
              </div>
              )
            })}
          </div>
        </>
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

/** Bài tập về nhà: Báo bài / Kiểm tra / Nộp bài. */
export default function HomeworkBoard({ isAdmin }) {
  const [mode, setMode] = useState('report')
  return (
    <div className="hw-root">
      <div className="hw-mode-tabs" role="tablist" aria-label="Chế độ bài tập về nhà">
        <button type="button" role="tab" aria-selected={mode === 'report'} className={`hw-mode-tab${mode === 'report' ? ' is-active' : ''}`} onClick={() => setMode('report')}><IconDocument /><span>Báo bài</span></button>
        <button type="button" role="tab" aria-selected={mode === 'check'} className={`hw-mode-tab${mode === 'check' ? ' is-active' : ''}`} onClick={() => setMode('check')}><IconChecklist /><span>Kiểm tra</span></button>
        <button type="button" role="tab" aria-selected={mode === 'submit'} className={`hw-mode-tab${mode === 'submit' ? ' is-active' : ''}`} onClick={() => setMode('submit')}><IconUpload /><span>Bài tập</span></button>
      </div>
      {mode === 'submit' ? <HomeworkSubmissionPanel canManage={isAdmin === true} /> : mode === 'check' ? <ExamBoard canManage={isAdmin === true} /> : <HomeworkReportBoard isAdmin={isAdmin} />}
    </div>
  )
}
