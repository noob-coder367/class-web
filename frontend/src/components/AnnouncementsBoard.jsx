import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getSeenPostIds,
  isPostSeen,
  markPostSeen,
} from '../lib/unreadStore.js'
import {
  canEdit,
  canHardDelete,
  canHide,
  canManageArchive,
  canPostToSection,
  postableSections,
  SECTION_LABELS,
} from '../lib/roles.js'
import './AnnouncementsBoard.css'

const NOTIFY_OPTIONS = ['normal', 'hot', 'urgent']

const NOTIFY_LABELS = {
  normal: 'Thông thường',
  hot: '🔥 Hot',
  urgent: '🚨 Khẩn cấp',
}

const SECTION_META = [
  {
    id: 'main',
    title: 'Thông báo chính',
    hint: 'Thông tin chung của lớp',
  },
  {
    id: 'important',
    title: 'Báo bài quan trọng',
    hint: 'Kiểm tra & báo bài từ LPHT',
  },
  {
    id: 'discipline',
    title: 'Vi phạm kỷ luật cao',
    hint: 'Hệ thống tự đăng khi tụt bậc uy tín',
  },
]

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Không đọc được ảnh'))
    reader.readAsDataURL(file)
  })
}

function imageGridStyle(count) {
  if (count <= 1) return { gridTemplateColumns: '1fr' }
  if (count === 2) return { gridTemplateColumns: '1fr 1fr' }
  if (count === 3) return { gridTemplateColumns: '1fr 1fr 1fr' }
  if (count === 4) return { gridTemplateColumns: '1fr 1fr' }
  return { gridTemplateColumns: 'repeat(3, 1fr)' }
}

function excerpt(text, max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trim()}…`
}

function PostCard({
  post,
  compact = false,
  role,
  onOpen,
  onHide,
  onDelete,
  onStartEditExpiry,
  editingExpiryId,
  editExpiresAt,
  setEditExpiresAt,
  onSaveExpiry,
  onCancelExpiry,
}) {
  const canHideThis = canHide(role, post.section)
  const canDeleteThis = canHardDelete(role, post.section)
  const canEditThis = canEdit(role, post.section)
  const showActions = !compact && (canHideThis || canDeleteThis || canEditThis)

  return (
    <article
      className={`ann-card ann-card--${post.notify_type || 'normal'} ann-card--${post.section || 'main'}${compact ? ' ann-card--preview' : ''}`}
      onClick={compact && onOpen ? () => onOpen(post) : undefined}
      role={compact ? 'button' : undefined}
      tabIndex={compact ? 0 : undefined}
      onKeyDown={
        compact && onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(post)
              }
            }
          : undefined
      }
    >
      <div className="ann-body">
        {post.images?.length > 0 ? (
          <div className="ann-images" style={imageGridStyle(compact ? 1 : post.images.length)}>
            {(compact ? post.images.slice(0, 1) : post.images).map((url, i) => (
              <a
                key={i}
                className="ann-image"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <img src={url} alt={`Ảnh ${i + 1}`} loading="lazy" />
              </a>
            ))}
          </div>
        ) : null}

        {post.content ? (
          <div className="ann-content-wrap">
            <p className="ann-content">
              {compact ? excerpt(post.content) : post.content}
            </p>
          </div>
        ) : null}
      </div>

      <div className="ann-meta">
        <span className={`ann-badge ann-badge--${post.notify_type || 'normal'}`}>
          {NOTIFY_LABELS[post.notify_type] || 'Thông thường'}
        </span>
        <span className="ann-meta-info">
          {post.created_by_name || 'Admin'} ·{' '}
          {new Date(post.created_at).toLocaleString('vi-VN')}
        </span>

        {post.expires_at && editingExpiryId !== post.id ? (
          <span className="ann-meta-info">
            Tự xóa: {new Date(post.expires_at).toLocaleString('vi-VN')}
          </span>
        ) : null}

        {compact ? (
          <span className="ann-meta-hint">Nhấn để xem · sẽ chuyển vào kho chi tiết sau khi xem</span>
        ) : null}

        {showActions && canEditThis && editingExpiryId === post.id ? (
          <span className="ann-expire-edit" onClick={(e) => e.stopPropagation()}>
            <input
              type="datetime-local"
              value={editExpiresAt}
              onChange={(e) => setEditExpiresAt(e.target.value)}
            />
            <button type="button" className="ann-btn-save-expiry" onClick={() => onSaveExpiry(post.id)}>
              Lưu
            </button>
            <button type="button" className="ann-btn-cancel-expiry" onClick={onCancelExpiry}>
              Hủy
            </button>
          </span>
        ) : showActions && canEditThis ? (
          <button
            type="button"
            className="ann-btn-expiry"
            onClick={(e) => {
              e.stopPropagation()
              onStartEditExpiry(post)
            }}
            title="Đổi thời gian tự xóa"
          >
            Đổi giờ tự xóa
          </button>
        ) : null}

        {showActions && canHideThis ? (
          <button
            type="button"
            className="ann-btn-hide"
            onClick={(e) => {
              e.stopPropagation()
              onHide(post)
            }}
          >
            Ẩn
          </button>
        ) : null}

        {showActions && canDeleteThis ? (
          <button
            type="button"
            className="ann-btn-delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(post)
            }}
          >
            Xóa vĩnh viễn
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function AnnouncementsBoard({
  role: roleProp,
  caps,
  canDismissTkb,
  tkbNotice,
  onDismissTkbNotice,
  dismissingTkb,
  onOpenTimetable,
}) {
  const { profile } = useAuth()
  const role = roleProp || profile?.role || 'user'
  const userId = profile?.id || 'anon'

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Recalc preview on every mount (đổi tab đi-về). seenTick forces re-read localStorage.
  const [seenTick, setSeenTick] = useState(0)
  const [openedPreviewId, setOpenedPreviewId] = useState(null)

  // expandedSection: ẩn 2 ô còn lại, hiện toàn bộ bài của ô đang mở.
  const [expandedSection, setExpandedSection] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [archiveItems, setArchiveItems] = useState([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveError, setArchiveError] = useState('')

  const [showComposer, setShowComposer] = useState(false)
  const [posting, setPosting] = useState(false)
  const [content, setContent] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  const [notifyType, setNotifyType] = useState('normal')
  const [showNotifyMenu, setShowNotifyMenu] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const allowedSections = useMemo(() => postableSections(role), [role])
  const [composerSection, setComposerSection] = useState(allowedSections[0] || 'main')
  const [editingExpiryId, setEditingExpiryId] = useState(null)
  const [editExpiresAt, setEditExpiresAt] = useState('')

  const fileInputRef = useRef(null)
  const canArchive = canManageArchive(role) || !!caps?.announcements_main_manage
  const canPost = allowedSections.length > 0

  useEffect(() => {
    if (!allowedSections.includes(composerSection)) {
      setComposerSection(allowedSections[0] || 'main')
    }
  }, [allowedSections, composerSection])

  const fetchPosts = useCallback(async () => {
    try {
      const data = await classroomService.getAnnouncements()
      setPosts(Array.isArray(data?.items) ? data.items : [])
      setError('')
    } catch (err) {
      setError(err.message || 'Không tải được thông báo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
    const interval = setInterval(fetchPosts, 60000)
    return () => clearInterval(interval)
  }, [fetchPosts])

  const bySection = useMemo(() => {
    const map = { main: [], important: [], discipline: [] }
    for (const post of posts) {
      const key = post.section === 'important' || post.section === 'discipline' ? post.section : 'main'
      map[key].push(post)
    }
    return map
  }, [posts])

  const unseenBySection = useMemo(() => {
    const seen = getSeenPostIds(userId)
    const map = { main: [], important: [], discipline: [] }
    for (const key of Object.keys(map)) {
      map[key] = bySection[key].filter((p) => p.id && !seen.has(String(p.id)))
    }
    void seenTick
    return map
  }, [bySection, userId, seenTick])

  const handleOpenPreview = (post) => {
    markPostSeen(post.id, userId)
    setOpenedPreviewId(post.id)
  }

  const handleOpenInList = (post) => {
    if (!isPostSeen(post.id, userId)) {
      markPostSeen(post.id, userId)
      setSeenTick((n) => n + 1)
    }
  }

  const toggleSection = (id) => {
    setExpandedSection((current) => (current === id ? null : id))
  }

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      String(f.type || '').startsWith('image/')
    )
    if (!files.length) return
    setSelectedFiles((prev) => [...prev, ...files])
    setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const closeComposer = () => {
    if (posting) return
    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setContent('')
    setSelectedFiles([])
    setPreviewUrls([])
    setNotifyType('normal')
    setShowNotifyMenu(false)
    setExpiresAt('')
    setComposerSection(allowedSections[0] || 'main')
    setShowComposer(false)
  }

  const handlePost = async () => {
    if (!canPostToSection(role, composerSection)) return
    const clean = content.trim()
    if (!clean && selectedFiles.length === 0) {
      return alert('Vui lòng nhập nội dung hoặc chọn ít nhất 1 ảnh!')
    }
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return alert('Thời gian tự xóa phải lớn hơn thời gian hiện tại!')
    }

    setPosting(true)
    try {
      const images = []
      for (const file of selectedFiles) {
        const dataUrl = await fileToBase64(file)
        images.push({
          mimeType: file.type || 'image/jpeg',
          contentBase64: dataUrl,
        })
      }

      await classroomService.createAnnouncement({
        content: clean,
        notify_type: notifyType,
        section: composerSection,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        images,
      })

      closeComposer()
      setLoading(true)
      await fetchPosts()
    } catch (err) {
      alert(err.message || 'Đăng thông báo thất bại.')
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (post) => {
    if (!canHardDelete(role, post.section)) return
    if (!window.confirm('Xóa vĩnh viễn thông báo này? Ảnh đính kèm cũng sẽ bị xóa.')) return
    try {
      await classroomService.deleteAnnouncement(post.id)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch (err) {
      alert(err.message || 'Xóa thất bại.')
    }
  }

  const handleHide = async (post) => {
    if (!canHide(role, post.section)) return
    if (!window.confirm('Ẩn thông báo này? Mọi thành viên sẽ không còn thấy bài.')) return
    try {
      await classroomService.hideAnnouncement(post.id)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch (err) {
      alert(err.message || 'Ẩn thất bại.')
    }
  }

  const startEditExpiry = (post) => {
    if (!canEdit(role, post.section)) return
    setEditingExpiryId(post.id)
    setEditExpiresAt(
      post.expires_at ? new Date(post.expires_at).toISOString().slice(0, 16) : ''
    )
  }

  const cancelEditExpiry = () => {
    setEditingExpiryId(null)
    setEditExpiresAt('')
  }

  const handleUpdateExpiry = async (id) => {
    if (editExpiresAt && new Date(editExpiresAt) <= new Date()) {
      return alert('Thời gian tự xóa phải lớn hơn thời gian hiện tại!')
    }
    try {
      const data = await classroomService.updateAnnouncementExpiry(
        id,
        editExpiresAt ? new Date(editExpiresAt).toISOString() : null
      )
      if (data?.item) {
        setPosts((prev) => prev.map((p) => (p.id === id ? data.item : p)))
      }
      cancelEditExpiry()
    } catch (err) {
      alert(err.message || 'Cập nhật thất bại.')
    }
  }

  const loadArchive = useCallback(async () => {
    if (!canArchive) return
    setArchiveLoading(true)
    setArchiveError('')
    try {
      const data = await classroomService.getAnnouncementsArchive()
      setArchiveItems(Array.isArray(data?.items) ? data.items : [])
    } catch (err) {
      setArchiveError(err.message || 'Không tải được kho lưu trữ.')
    } finally {
      setArchiveLoading(false)
    }
  }, [canArchive])

  const openArchive = async () => {
    setShowArchive(true)
    await loadArchive()
  }

  const handleUnhide = async (post) => {
    if (!canArchive) return
    try {
      await classroomService.unhideAnnouncement(post.id)
      setArchiveItems((prev) => prev.filter((p) => p.id !== post.id))
      await fetchPosts()
    } catch (err) {
      alert(err.message || 'Bỏ ẩn thất bại.')
    }
  }

  const cardProps = {
    role,
    onHide: handleHide,
    onDelete: handleDelete,
    onStartEditExpiry: startEditExpiry,
    editingExpiryId,
    editExpiresAt,
    setEditExpiresAt,
    onSaveExpiry: handleUpdateExpiry,
    onCancelExpiry: cancelEditExpiry,
  }

  const focusing = Boolean(expandedSection)
  const hasTkb = Boolean(tkbNotice && tkbNotice.active)

  return (
    <div className="ann-board">
      {loading ? (
        <div className="ann-state">
          <span className="ann-spinner" aria-hidden="true" />
          <p>Đang tải thông báo...</p>
        </div>
      ) : error ? (
        <div className="ann-state ann-state--error">
          <p>{error}</p>
        </div>
      ) : (
        <>
          {canArchive ? (
            <div className="ann-toolbar">
              <button type="button" className="ann-btn-archive" onClick={openArchive}>
                Kho lưu trữ
              </button>
            </div>
          ) : null}

          {hasTkb ? (
            <article
              className={`ann-card ann-card--tkb${tkbNotice.hasChanges ? ' ann-card--changed' : ''}`}
            >
              <div className="ann-body">
                <h3 className="ann-title">
                  {tkbNotice.from && tkbNotice.to
                    ? `Thông báo thay đổi TKB từ ngày ${tkbNotice.from.split('-').reverse().join('/')} đến ngày ${tkbNotice.to.split('-').reverse().join('/')}`
                    : 'Thông báo thay đổi thời khoá biểu'}
                </h3>
                <p className="ann-content">{tkbNotice.summary || 'Chưa có sự thay đổi'}</p>
                {tkbNotice.hasChanges && Array.isArray(tkbNotice.lines) && tkbNotice.lines.length > 0 ? (
                  <ul className="ann-tkb-lines">
                    {tkbNotice.lines.slice(0, 12).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="ann-meta">
                <button type="button" className="ann-btn-detail" onClick={onOpenTimetable}>
                  Ấn để xem chi tiết hơn
                </button>
                {canDismissTkb ? (
                  <button
                    type="button"
                    className="ann-btn-delete"
                    onClick={onDismissTkbNotice}
                    disabled={dismissingTkb}
                  >
                    {dismissingTkb ? 'Đang xoá…' : 'Xoá thông báo'}
                  </button>
                ) : null}
              </div>
            </article>
          ) : null}

          <div className={`ann-sections${focusing ? ' is-focusing' : ''}`}>
            {SECTION_META.map((section) => {
              if (focusing && expandedSection !== section.id) return null
              const list = bySection[section.id] || []
              const unseen = unseenBySection[section.id] || []
              const latestUnseen = unseen[0] || null
              const showPreview =
                !focusing && latestUnseen && latestUnseen.id !== openedPreviewId
              const showOpened = !focusing && latestUnseen && latestUnseen.id === openedPreviewId
              const isOpen = expandedSection === section.id

              return (
                <section
                  key={section.id}
                  className={`ann-section ann-section--${section.id}${isOpen ? ' is-expanded' : ''}`}
                >
                  <header className="ann-section-header">
                    <div className="ann-section-heading">
                      <h2>{section.title}</h2>
                      <p>{section.hint}</p>
                    </div>
                    {list.length > 0 ? (
                      <span className="ann-section-count">{list.length}</span>
                    ) : null}
                  </header>

                  <button
                    type="button"
                    className="ann-btn-detail-toggle"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? 'Đóng chi tiết' : 'Xem chi tiết các sự kiện'}
                  </button>

                  {showPreview || showOpened ? (
                    <div className="ann-section-preview">
                      <p className="ann-section-preview-label">Mới nhất chưa xem</p>
                      <PostCard
                        post={latestUnseen}
                        compact={!showOpened}
                        onOpen={handleOpenPreview}
                        {...cardProps}
                      />
                    </div>
                  ) : !isOpen ? (
                    <p className="ann-section-empty">
                      {list.length === 0
                        ? 'Chưa có bài trong mục này.'
                        : 'Bạn đã xem hết bài mới. Mở chi tiết để xem kho lưu trữ của mục.'}
                    </p>
                  ) : null}

                  {isOpen ? (
                    <div className="ann-section-archive">
                      {list.length === 0 ? (
                        <p className="ann-section-empty">Chưa có sự kiện nào được lưu.</p>
                      ) : (
                        list.map((post) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            onOpen={handleOpenInList}
                            {...cardProps}
                          />
                        ))
                      )}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        </>
      )}

      {canPost ? (
        <button
          type="button"
          className="ann-fab"
          onClick={() => setShowComposer(true)}
          aria-label="Đăng thông báo mới"
          title="Đăng thông báo mới"
        >
          +
        </button>
      ) : null}

      {showComposer ? (
        <div className="ann-composer-overlay" onClick={closeComposer} role="presentation">
          <div
            className="ann-composer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ann-composer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ann-composer-header">
              <h2 id="ann-composer-title">Đăng thông báo mới</h2>
              <button type="button" className="ann-composer-close" onClick={closeComposer} disabled={posting}>
                ✕
              </button>
            </header>

            <div className="ann-composer-body">
              <div className="ann-composer-left">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFilesChange}
                  style={{ display: 'none' }}
                />
                <div className="ann-upload-box" onClick={() => fileInputRef.current?.click()}>
                  {previewUrls.length === 0 ? (
                    <div className="ann-upload-placeholder">
                      <span className="ann-upload-icon">📷</span>
                      <p>Chạm để chọn ảnh (không giới hạn số lượng)</p>
                    </div>
                  ) : (
                    <div className="ann-upload-grid">
                      {previewUrls.map((url, i) => (
                        <div className="ann-upload-item" key={i}>
                          <img src={url} alt="preview" />
                          <button
                            type="button"
                            className="ann-upload-remove"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(i)
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {previewUrls.length > 0 ? (
                  <button
                    type="button"
                    className="ann-btn-add-more"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    + Thêm ảnh khác
                  </button>
                ) : null}
              </div>

              <div className="ann-composer-right">
                {allowedSections.length > 1 ? (
                  <label className="ann-section-field">
                    Đăng vào mục
                    <select
                      value={composerSection}
                      onChange={(e) => setComposerSection(e.target.value)}
                    >
                      {allowedSections.map((id) => (
                        <option key={id} value={id}>
                          {SECTION_LABELS[id]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="ann-section-locked">
                    Đăng vào: <strong>{SECTION_LABELS[composerSection]}</strong>
                  </p>
                )}

                <textarea
                  className="ann-textarea"
                  placeholder="Nội dung thông báo..."
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />

                <div className="ann-composer-extras">
                  <div className="ann-notify-dropdown">
                    <button
                      type="button"
                      className="ann-btn-notify"
                      onClick={() => setShowNotifyMenu((v) => !v)}
                    >
                      {NOTIFY_LABELS[notifyType]} ▾
                    </button>
                    {showNotifyMenu ? (
                      <div className="ann-notify-menu">
                        {NOTIFY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`ann-notify-item${notifyType === opt ? ' is-active' : ''}`}
                            onClick={() => {
                              setNotifyType(opt)
                              setShowNotifyMenu(false)
                            }}
                          >
                            {NOTIFY_LABELS[opt]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <label className="ann-expire-field">
                    Tự xóa lúc (tuỳ chọn)
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>

            <footer className="ann-composer-footer">
              <button type="button" className="ann-btn-post" onClick={handlePost} disabled={posting}>
                {posting ? 'Đang đăng...' : 'Đăng thông báo'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {showArchive ? (
        <div className="ann-composer-overlay" onClick={() => setShowArchive(false)} role="presentation">
          <div
            className="ann-composer-modal ann-archive-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ann-archive-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ann-composer-header">
              <h2 id="ann-archive-title">Kho lưu trữ — bài đã ẩn</h2>
              <button type="button" className="ann-composer-close" onClick={() => setShowArchive(false)}>
                ✕
              </button>
            </header>
            <div className="ann-archive-body">
              <p className="ann-archive-note">
                Bài LPHT / LPKL (và bài bạn đã ẩn) nằm đây. Bỏ ẩn để hiện lại cho cả lớp.
                Bài hết hạn tự biến mất khỏi kho, không khôi phục được.
              </p>
              {archiveLoading ? (
                <div className="ann-state">
                  <span className="ann-spinner" aria-hidden="true" />
                  <p>Đang tải kho lưu trữ...</p>
                </div>
              ) : archiveError ? (
                <p className="ann-state ann-state--error">{archiveError}</p>
              ) : archiveItems.length === 0 ? (
                <p className="ann-empty">Kho lưu trữ trống.</p>
              ) : (
                archiveItems.map((post) => (
                  <article key={post.id} className={`ann-card ann-card--${post.section || 'main'}`}>
                    <div className="ann-body">
                      <span className="ann-badge">{SECTION_LABELS[post.section] || post.section}</span>
                      {post.content ? <p className="ann-content">{post.content}</p> : null}
                    </div>
                    <div className="ann-meta">
                      <span className="ann-meta-info">
                        Ẩn {post.hidden_at ? new Date(post.hidden_at).toLocaleString('vi-VN') : ''}
                        {post.hidden_by_name ? ` · ${post.hidden_by_name}` : ''}
                      </span>
                      <button
                        type="button"
                        className="ann-btn-unhide"
                        onClick={() => handleUnhide(post)}
                      >
                        Bỏ ẩn
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
