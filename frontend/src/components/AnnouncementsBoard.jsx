import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as classroomService from '../services/classroomService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getSeenPostIds, markPostSeen } from '../lib/unreadStore.js'
import {
  canEdit, canHardDelete, canHide, canManageArchive,
  canPostToSection, postableSections, SECTION_LABELS,
} from '../lib/roles.js'
import { announcementDetailPath, classTabPath, parseAnnouncementId } from '../lib/routes.js'
import { shareHelper } from '../utils/shareHelper.js'
import { downloadOfficialDocImage, shareOfficialDocImage } from '../utils/exportShareImage.jsx'
import './AnnouncementsBoard.css'
import { buildWeekFolders, getStudyWeekNumber } from '../lib/studyWeek.js'

const NOTIFY_OPTIONS = ['normal', 'hot', 'urgent']
const NOTIFY_LABELS = { normal: 'Thông thường', hot: '🔥 Hot', urgent: '🚨 Khẩn cấp' }
const MAX_ANNOUNCEMENT_IMAGES_PER_POST = 5
const SECTION_META = [
  { id: 'main', title: 'Thông báo chính', hint: 'Thông tin chung của lớp' },
  { id: 'important', title: 'Báo bài quan trọng', hint: 'Kiểm tra & báo bài từ LPHT' },
  { id: 'discipline', title: 'Vi phạm kỷ luật cao', hint: 'Hệ thống tự đăng khi tụt bậc uy tín' },
]



function SectionIcon({ id }) {
  const common = { viewBox: '0 0 24 24', width: 28, height: 28, fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (id === 'important') {
    return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3h6v1M9 13l2.2 2.2L15.5 11" /></svg>
  }
  if (id === 'discipline') {
    return <svg {...common}><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" /><path d="M12 8.5v4.5M12 16.2v.01" /></svg>
  }
  return <svg {...common}><path d="M4 10v4h3l6 4V6L7 10H4z" /><path d="M16.5 9a4 4 0 0 1 0 6" /></svg>
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

function detailContentBlocks(content) {
  return String(content || '').split(/\r?\n/).map((line, index) => {
    const text = line.trim()
    if (!text) return <div className="ann-detail-spacer" key={`detail-space-${index}`} aria-hidden="true" />
    const isList = /^[-–—•]\s*/.test(text)
    return <p className={`ann-detail-paragraph${isList ? ' ann-detail-list' : ''}`} key={`detail-line-${index}`}>{text}</p>
  })
}

function PostCard({
  post, compact = false, role, onOpen, onHide, onDelete,
  onStartEditExpiry, editingExpiryId, editExpiresAt, setEditExpiresAt,
  onSaveExpiry, onCancelExpiry,
}) {
  const canHideThis = canHide(role, post.section)
  const canDeleteThis = canHardDelete(role, post.section)
  const canEditThis = canEdit(role, post.section)
  const showActions = !compact && (canHideThis || canDeleteThis || canEditThis)

  return (
    <article
      className={`ann-card ann-card--${post.notify_type || 'normal'} ann-card--${post.section || 'main'}${compact ? ' ann-card--preview' : ''}${onOpen ? ' ann-card--clickable' : ''}`}
      onClick={onOpen ? () => onOpen(post) : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(post) } } : undefined}
    >
      <div className="ann-body">
        {post.images?.length > 0 ? (
          <div className="ann-images" style={imageGridStyle(compact ? 1 : post.images.length)}>
            {(compact ? post.images.slice(0, 1) : post.images).map((url, i) => (
              <a key={i} className="ann-image" href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <img src={url} alt={`Ảnh ${i + 1}`} loading="lazy" />
              </a>
            ))}
          </div>
        ) : null}
        {post.title ? <h3 className="ann-post-title">{post.title}</h3> : null}
        {post.content ? (
          <div className="ann-content-wrap">
            <p className="ann-content">{compact ? excerpt(post.content) : post.content}</p>
          </div>
        ) : null}
      </div>
      <div className="ann-meta">
        <span className={`ann-badge ann-badge--${post.notify_type || 'normal'}`}>{NOTIFY_LABELS[post.notify_type] || 'Thông thường'}</span>
        <span className="ann-meta-info">{post.created_by_name || 'Admin'} · {new Date(post.created_at).toLocaleString('vi-VN')}</span>
        {post.expires_at && editingExpiryId !== post.id ? (
          <span className="ann-meta-info">Tự xóa: {new Date(post.expires_at).toLocaleString('vi-VN')}</span>
        ) : null}
        {compact ? <span className="ann-meta-hint">Nhấn để xem chi tiết · đánh dấu đã đọc</span> : null}
        {showActions && canEditThis && editingExpiryId === post.id ? (
          <span className="ann-expire-edit" onClick={(e) => e.stopPropagation()}>
            <input type="datetime-local" value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} />
            <button type="button" className="ann-btn-save-expiry" onClick={() => onSaveExpiry(post.id)}>Lưu</button>
            <button type="button" className="ann-btn-cancel-expiry" onClick={onCancelExpiry}>Hủy</button>
          </span>
        ) : showActions && canEditThis ? (
          <button type="button" className="ann-btn-expiry" onClick={(e) => { e.stopPropagation(); onStartEditExpiry(post) }}>Đổi giờ tự xóa</button>
        ) : null}
        {showActions && canHideThis ? (
          <button type="button" className="ann-btn-hide" onClick={(e) => { e.stopPropagation(); onHide(post) }}>Ẩn</button>
        ) : null}
        {showActions && canDeleteThis ? (
          <button type="button" className="ann-btn-delete" onClick={(e) => { e.stopPropagation(); onDelete(post) }}>Xóa vĩnh viễn</button>
        ) : null}
      </div>
    </article>
  )
}

function NoteIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  )
}

function FileRow({
  post, role, onOpen, onHide, onDelete,
  onStartEditExpiry, editingExpiryId, editExpiresAt, setEditExpiresAt,
  onSaveExpiry, onCancelExpiry,
}) {
  const canHideThis = canHide(role, post.section)
  const canDeleteThis = canHardDelete(role, post.section)
  const canEditThis = canEdit(role, post.section)
  const name = post.title || excerpt(post.content, 70) || 'Thông báo không tiêu đề'
  const editing = canEditThis && editingExpiryId === post.id
  return (
    <div className={`ann-file ann-file--${post.notify_type || 'normal'}`}>
      <div className="ann-file-main">
        <span className="ann-file-note"><NoteIcon /></span>
        <div className="ann-file-text">
          <strong className="ann-file-name">{name}</strong>
          <span className="ann-file-meta">
            {post.notify_type && post.notify_type !== 'normal' ? <span className={`ann-badge ann-badge--${post.notify_type}`}>{NOTIFY_LABELS[post.notify_type]}</span> : null}
            {post.created_by_name || 'Admin'} · {new Date(post.created_at).toLocaleString('vi-VN')}
          </span>
        </div>
        <button type="button" className="ann-file-view" onClick={() => onOpen(post)}>Xem</button>
      </div>
      {editing || canEditThis || canHideThis || canDeleteThis ? (
        <div className="ann-file-actions">
          {editing ? (
            <span className="ann-expire-edit">
              <input type="datetime-local" value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} />
              <button type="button" className="ann-btn-save-expiry" onClick={() => onSaveExpiry(post.id)}>Lưu</button>
              <button type="button" className="ann-btn-cancel-expiry" onClick={onCancelExpiry}>Hủy</button>
            </span>
          ) : canEditThis ? (
            <button type="button" className="ann-btn-expiry" onClick={() => onStartEditExpiry(post)}>Đổi giờ tự xóa</button>
          ) : null}
          {canHideThis ? <button type="button" className="ann-btn-hide" onClick={() => onHide(post)}>Ẩn</button> : null}
          {canDeleteThis ? <button type="button" className="ann-btn-delete" onClick={() => onDelete(post)}>Xóa vĩnh viễn</button> : null}
        </div>
      ) : null}
    </div>
  )
}

export default function AnnouncementsBoard({
  role: roleProp, caps, canDismissTkb, tkbNotice, onDismissTkbNotice, dismissingTkb, onOpenTimetable,
}) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const role = roleProp || profile?.role || 'user'
  const userId = profile?.id || 'anon'

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [seenTick, setSeenTick] = useState(0)
  const [openedPreviewId, setOpenedPreviewId] = useState(null)
  const [detailPost, setDetailPost] = useState(null)
  const [expandedSection, setExpandedSection] = useState(null)
  const [expandedWeek, setExpandedWeek] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [archiveItems, setArchiveItems] = useState([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [posting, setPosting] = useState(false)
  const [content, setContent] = useState('')
  const [postTitle, setPostTitle] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  const [notifyType, setNotifyType] = useState('normal')
  const [documentKind, setDocumentKind] = useState('thong_bao')
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
    if (!allowedSections.includes(composerSection)) setComposerSection(allowedSections[0] || 'main')
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
    const interval = setInterval(fetchPosts, 8000)
    const onRefresh = () => fetchPosts()
    window.addEventListener('classweb-class-refresh', onRefresh)
    return () => { clearInterval(interval); window.removeEventListener('classweb-class-refresh', onRefresh) }
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

  const openDetail = (post, opts = {}) => {
    if (!post) return
    markPostSeen(post.id, userId)
    setOpenedPreviewId(post.id)
    setSeenTick((t) => t + 1)
    setDetailPost(post)
    if (!opts.silent) navigate(announcementDetailPath(post.id))
  }
  const closeDetail = () => {
    setDetailPost(null)
    navigate(classTabPath('announcements'), { replace: true })
  }

  // Truy cập trực tiếp bằng URL /vo-lop/thong-bao?id=... (hoặc path cũ /thong-bao-chung/:id)
  // -> tự mở modal chi tiết ngay khi danh sách bài đăng đã tải xong.
  useEffect(() => {
    const id = parseAnnouncementId(location.pathname, location.search)
    if (!id) {
      if (detailPost) setDetailPost(null)
      return
    }
    if (detailPost && String(detailPost.id) === String(id)) return
    const found = posts.find((p) => String(p.id) === String(id))
    if (found) openDetail(found, { silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, posts])

  const toggleSection = (id) => setExpandedSection((c) => (c === id ? null : id))

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => String(f.type || '').startsWith('image/'))
    if (!files.length) return
    const remaining = MAX_ANNOUNCEMENT_IMAGES_PER_POST - selectedFiles.length
    const accepted = files.slice(0, Math.max(remaining, 0))
    if (accepted.length < files.length) alert(`Mỗi bài tối đa ${MAX_ANNOUNCEMENT_IMAGES_PER_POST} ảnh.`)
    if (!accepted.length) return
    setSelectedFiles((prev) => [...prev, ...accepted])
    setPreviewUrls((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviewUrls((prev) => { URL.revokeObjectURL(prev[index]); return prev.filter((_, i) => i !== index) })
  }

  const closeComposer = () => {
    if (posting) return
    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setContent(''); setPostTitle(''); setSelectedFiles([]); setPreviewUrls([])
    setNotifyType('normal'); setDocumentKind('thong_bao'); setShowNotifyMenu(false); setExpiresAt('')
    setComposerSection(allowedSections[0] || 'main'); setShowComposer(false)
  }

  const handlePost = async () => {
    if (!canPostToSection(role, composerSection)) return
    const clean = content.trim()
    if (!clean && selectedFiles.length === 0) return alert('Vui lòng nhập nội dung hoặc chọn ít nhất 1 ảnh!')
    if (expiresAt && new Date(expiresAt) <= new Date()) return alert('Thời gian tự xóa phải lớn hơn thời gian hiện tại!')
    setPosting(true)
    try {
      const images = selectedFiles.length ? await classroomService.uploadAnnouncementImages(selectedFiles) : []
      await classroomService.createAnnouncement({
        title: postTitle.trim(),
        document_kind: documentKind,
        content: clean, notify_type: notifyType, section: composerSection,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null, images,
      })
      closeComposer(); setLoading(true); await fetchPosts()
      window.dispatchEvent(new CustomEvent('classweb-class-refresh'))
    } catch (err) {
      alert(err.message || 'Đăng thông báo thất bại.')
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (post) => {
    if (!canHardDelete(role, post.section)) return
    if (!window.confirm('Xóa vĩnh viễn thông báo này?')) return
    try {
      await classroomService.deleteAnnouncement(post.id)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch (err) { alert(err.message || 'Xóa thất bại.') }
  }

  const handleHide = async (post) => {
    if (!canHide(role, post.section)) return
    if (!window.confirm('Ẩn thông báo này?')) return
    try {
      await classroomService.hideAnnouncement(post.id)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch (err) { alert(err.message || 'Ẩn thất bại.') }
  }

  const startEditExpiry = (post) => {
    if (!canEdit(role, post.section)) return
    setEditingExpiryId(post.id)
    setEditExpiresAt(post.expires_at ? new Date(post.expires_at).toISOString().slice(0, 16) : '')
  }
  const cancelEditExpiry = () => { setEditingExpiryId(null); setEditExpiresAt('') }

  const handleUpdateExpiry = async (id) => {
    if (editExpiresAt && new Date(editExpiresAt) <= new Date()) return alert('Thời gian tự xóa phải lớn hơn thời gian hiện tại!')
    try {
      const data = await classroomService.updateAnnouncementExpiry(id, editExpiresAt ? new Date(editExpiresAt).toISOString() : null)
      if (data?.item) setPosts((prev) => prev.map((p) => (p.id === id ? data.item : p)))
      cancelEditExpiry()
    } catch (err) { alert(err.message || 'Cập nhật thất bại.') }
  }

  const handleShareImage = async (post) => {
    try { await shareOfficialDocImage(post) } catch (err) { alert(err.message || 'Không xuất được ảnh thông báo.') }
  }
  const handleShareLink = async (post) => {
    await shareHelper({
      title: post.title || 'Thông báo lớp',
      text: post.content || '',
      path: `/vo-lop/trang-chu/thong-bao-chung?id=${post.id}`,
      fullText: true,
    })
  }
  const handleDownloadImage = async (post) => {
    try { await downloadOfficialDocImage(post) } catch (err) { alert(err.message || 'Không tải được ảnh thông báo.') }
  }

  const loadArchive = useCallback(async () => {
    if (!canArchive) return
    setArchiveLoading(true); setArchiveError('')
    try {
      const data = await classroomService.getAnnouncementsArchive()
      setArchiveItems(Array.isArray(data?.items) ? data.items : [])
    } catch (err) { setArchiveError(err.message || 'Không tải được kho lưu trữ.') }
    finally { setArchiveLoading(false) }
  }, [canArchive])

  const openArchive = async () => { setShowArchive(true); await loadArchive() }

  const handleUnhide = async (post) => {
    if (!canArchive) return
    try {
      await classroomService.unhideAnnouncement(post.id)
      setArchiveItems((prev) => prev.filter((p) => p.id !== post.id))
      await fetchPosts()
    } catch (err) { alert(err.message || 'Bỏ ẩn thất bại.') }
  }

  const cardProps = {
    role, onHide: handleHide, onDelete: handleDelete,
    onStartEditExpiry: startEditExpiry, editingExpiryId, editExpiresAt,
    setEditExpiresAt, onSaveExpiry: handleUpdateExpiry, onCancelExpiry: cancelEditExpiry,
  }

  const focusing = Boolean(expandedSection)
  const hasTkb = Boolean(tkbNotice && tkbNotice.active)

  return (
    <div className="ann-board">
      {loading ? (
        <div className="ann-state"><span className="ann-spinner" /><p>Đang tải thông báo...</p></div>
      ) : error ? (
        <div className="ann-state ann-state--error"><p>{error}</p></div>
      ) : (
        <>
          {canArchive ? (
            <div className="ann-toolbar">
              <button type="button" className="ann-btn-archive" onClick={openArchive}>Kho lưu trữ</button>
            </div>
          ) : null}

          {hasTkb ? (
            <article className={`ann-card ann-card--tkb${tkbNotice.hasChanges ? ' ann-card--changed' : ''}`}>
              <div className="ann-body">
                <h3 className="ann-title">
                  {tkbNotice.from && tkbNotice.to
                    ? `Thông báo thay đổi TKB từ ngày ${tkbNotice.from.split('-').reverse().join('/')} đến ngày ${tkbNotice.to.split('-').reverse().join('/')}`
                    : 'Thông báo thay đổi thời khoá biểu'}
                </h3>
                <p className="ann-content">{tkbNotice.summary || 'Chưa có sự thay đổi'}</p>
              </div>
              <div className="ann-meta">
                <button type="button" className="ann-btn-detail" onClick={onOpenTimetable}>Ấn để xem chi tiết hơn</button>
                {canDismissTkb ? (
                  <button type="button" className="ann-btn-delete" onClick={onDismissTkbNotice} disabled={dismissingTkb}>
                    {dismissingTkb ? 'Đang xoá…' : 'Xoá thông báo'}
                  </button>
                ) : null}
              </div>
            </article>
          ) : null}

          <div className={`ann-sections${focusing ? ' is-focusing' : ''}`}>
            {SECTION_META.map((section) => {
              const list = bySection[section.id] || []
              const unseen = unseenBySection[section.id] || []
              const isOpen = expandedSection === section.id

              return (
                <section key={section.id} className={`ann-section ann-section--${section.id}${isOpen ? ' is-expanded' : ''}`}>
                  <header className="ann-banner">
                    <div className="ann-banner-top">
                      <span className="ann-banner-logo"><SectionIcon id={section.id} /></span>
                      <span className="ann-banner-brand">{section.hint}</span>
                    </div>
                    <h2 className="ann-banner-title">{section.title}</h2>
                    <p className="ann-banner-sub">
                      {unseen.length > 0 ? `Có ${unseen.length} bài chưa xem. Mở ra để cập nhật nhé.` : list.length > 0 ? 'Bạn đã xem hết bài mới.' : 'Chưa có bài nào trong mục này.'}
                    </p>
                    <div className="ann-banner-pills">
                      <span className="ann-banner-pill">{list.length} bài đăng</span>
                      {unseen.length > 0 ? (
                        <span className="ann-banner-pill">{section.id === 'important' ? 'Có báo bài mới' : 'Có thông báo mới'}</span>
                      ) : null}
                    </div>
                  </header>

                  <div className="ann-section-body">
                  <button
                    type="button"
                    className="ann-folder-toggle"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSection(section.id) }}
                    aria-expanded={isOpen}
                  >
                    <span className="ann-tree-grip" aria-hidden="true" />
                    <span className="ann-folder-chevron" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={isOpen ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} /></svg>
                    </span>
                    <span className="ann-folder-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="5" rx="1.2" /><rect x="14" y="10" width="7" height="5" rx="1.2" /><rect x="14" y="17" width="7" height="4" rx="1.2" /><path d="M6.5 8v10.5a1 1 0 0 0 1 1H14M6.5 12.5H14" /></svg>
                    </span>
                    <span className="ann-folder-label">
                      <strong>Tất cả bài đăng</strong>
                    </span>
                    <span className="ann-section-count">{list.length}</span>
                  </button>

                  {!isOpen && list.length === 0 ? <p className="ann-section-empty">Chưa có bài nào.</p> : null}

                  {isOpen ? (
                    <div className="ann-section-archive">
                      {buildWeekFolders(list, (post) => post.created_at, getStudyWeekNumber()).map((week) => {
                        const weekId = `${section.id}:${week.key}`
                        const weekOpen = expandedWeek === weekId
                        return (
                          <div key={weekId} className="ann-week">
                            <button
                              type="button"
                              className={`ann-week-folder${weekOpen ? ' is-active' : ''}`}
                              aria-expanded={weekOpen}
                              onClick={() => setExpandedWeek((c) => (c === weekId ? null : weekId))}
                            >
                              <span className="ann-tree-grip" aria-hidden="true" />
                              <span className="ann-week-chevron" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={weekOpen ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} /></svg>
                              </span>
                              <span className="ann-week-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="5" rx="1.2" /><rect x="14" y="10" width="7" height="5" rx="1.2" /><rect x="14" y="17" width="7" height="4" rx="1.2" /><path d="M6.5 8v10.5a1 1 0 0 0 1 1H14M6.5 12.5H14" /></svg>
                              </span>
                              <strong>{week.label}</strong>
                              <small>{week.items.length} bài</small>
                            </button>
                            {weekOpen ? (
                              <div className="ann-week-children">
                                {week.items.length === 0 ? (
                                  <p className="ann-section-empty">Không có gì.</p>
                                ) : (
                                  week.items.map((post) => (
                                    <FileRow key={post.id} post={post} {...cardProps} onOpen={openDetail} />
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}

      {canPost ? (
        <button type="button" className="ann-fab" onClick={() => setShowComposer(true)} aria-label="Đăng thông báo mới">+</button>
      ) : null}

      {showComposer ? (
        <div className="ann-composer-overlay" onClick={closeComposer} role="presentation">
          <div className="ann-composer-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="ann-composer-header">
              <h2>Đăng thông báo mới</h2>
              <button type="button" className="ann-composer-close" onClick={closeComposer}>✕</button>
            </header>
            <div className="ann-composer-body">
              <div className="ann-composer-left">
                <div className="ann-upload-box" onClick={() => fileInputRef.current?.click()}>
                  {previewUrls.length === 0 ? (
                    <div className="ann-upload-placeholder">
                      <span className="ann-upload-icon">📷</span>
                      <p>Chạm để chọn ảnh từ thư viện điện thoại</p>
                      <small>Tối đa 5 ảnh/bài · hệ thống giữ khoảng 20 ảnh mới nhất</small>
                    </div>
                  ) : (
                    <div className="ann-upload-grid">
                      {previewUrls.map((url, i) => (
                        <div key={i} className="ann-upload-item">
                          <img src={url} alt="" />
                          <button type="button" className="ann-upload-remove" onClick={(e) => { e.stopPropagation(); removeFile(i) }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFilesChange} />
                {previewUrls.length > 0 ? (
                  <button type="button" className="ann-btn-add-more" onClick={() => fileInputRef.current?.click()}>+ Thêm ảnh khác</button>
                ) : null}
              </div>
              <div className="ann-composer-right">
                <input
                  className="ann-title-input"
                  type="text"
                  placeholder="Tiêu đề bài đăng"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  maxLength={120}
                />
                <textarea className="ann-textarea" placeholder="Nội dung thông báo..." value={content} onChange={(e) => setContent(e.target.value)} />
                <div className="ann-composer-extras">
                  {allowedSections.length > 1 ? (
                    <label className="ann-section-field">
                      Mục đăng
                      <select value={composerSection} onChange={(e) => setComposerSection(e.target.value)}>
                        {allowedSections.map((s) => (
                          <option key={s} value={s}>{SECTION_LABELS[s] || s}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="ann-notify-dropdown">
                    <button type="button" className="ann-btn-notify" onClick={() => setShowNotifyMenu((v) => !v)}>
                      {NOTIFY_LABELS[notifyType]} ▾
                    </button>
                    {showNotifyMenu ? (
                      <div className="ann-notify-menu">
                        {NOTIFY_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`ann-notify-item${notifyType === opt ? ' is-active' : ''}`}
                            onClick={() => { setNotifyType(opt); setShowNotifyMenu(false) }}
                          >
                            {NOTIFY_LABELS[opt]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <label className="ann-section-field">
                    Loại văn bản
                    <select value={documentKind} onChange={(e) => setDocumentKind(e.target.value)}>
                      <option value="thong_bao">Thông báo</option>
                      <option value="bao_cao">Báo cáo</option>
                    </select>
                  </label>
                  <label className="ann-expire-field">
                    Tự xóa lúc (tuỳ chọn)
                    <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
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

      {detailPost ? (
        <div className="ann-detail-overlay" onClick={closeDetail} role="presentation">
          <div className="ann-detail-modal" role="dialog" aria-modal="true" aria-label="Chi tiết thông báo" onClick={(e) => e.stopPropagation()}>
            <header className="ann-detail-header">
              <span className="ann-detail-document-kind">{detailPost.document_kind === 'bao_cao' ? 'BÁO CÁO' : 'THÔNG BÁO'}</span>
              <button type="button" className="ann-detail-close" onClick={closeDetail} aria-label="Đóng">✕</button>
            </header>
            <div className="ann-detail-body">
              {detailPost.images?.length > 0 ? (
                <div className="ann-images ann-detail-images" style={imageGridStyle(detailPost.images.length)}>
                  {detailPost.images.map((url, i) => (
                    <a key={i} className="ann-image" href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Ảnh ${i + 1}`} loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : null}
              <h1 className="ann-detail-document-heading">{detailPost.document_kind === 'bao_cao' ? 'BÁO CÁO' : 'THÔNG BÁO'}</h1>
              {detailPost.title ? <h2 className="ann-detail-title">{detailPost.title}</h2> : null}
              {detailPost.content ? <div className="ann-detail-content">{detailContentBlocks(detailPost.content)}</div> : null}
            </div>
            <footer className="ann-detail-footer">
              <span className="ann-meta-info">{detailPost.document_kind === 'bao_cao' ? 'Báo cáo' : 'Thông báo'} · Số: {detailPost.short_id || '—'}</span>
              <span className="ann-meta-info">{detailPost.created_by_name || 'Admin'} · {new Date(detailPost.created_at).toLocaleString('vi-VN')}</span>
              {detailPost.expires_at ? (
                <span className="ann-meta-info">Tự xóa: {new Date(detailPost.expires_at).toLocaleString('vi-VN')}</span>
              ) : null}
              <div className="ann-detail-actions">
                <button type="button" className="ann-btn-share ann-btn-share--link" onClick={() => handleShareLink(detailPost)}>Chia sẻ</button>
                <button type="button" className="ann-btn-share" onClick={() => handleShareImage(detailPost)}>Chia sẻ ảnh</button>
                <button type="button" className="ann-btn-share ann-btn-share--light" onClick={() => handleDownloadImage(detailPost)}>Tải JPEG</button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {showArchive ? (
        <div className="ann-composer-overlay" onClick={() => setShowArchive(false)} role="presentation">
          <div className="ann-composer-modal ann-archive-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="ann-composer-header">
              <h2>Kho lưu trữ — bài đã ẩn</h2>
              <button type="button" className="ann-composer-close" onClick={() => setShowArchive(false)}>✕</button>
            </header>
            <div className="ann-archive-body">
              <p className="ann-archive-note">Bài đã ẩn không hiện với thành viên. Bấm Bỏ ẩn để đưa lại.</p>
              {archiveLoading ? (
                <div className="ann-state"><span className="ann-spinner" /><p>Đang tải...</p></div>
              ) : archiveError ? (
                <div className="ann-state ann-state--error"><p>{archiveError}</p></div>
              ) : archiveItems.length === 0 ? (
                <p className="ann-empty">Kho lưu trữ trống.</p>
              ) : (
                archiveItems.map((post) => (
                  <article key={post.id} className={`ann-card ann-card--${post.notify_type || 'normal'}`}>
                    <div className="ann-body">
                      {post.title ? <h3 className="ann-post-title">{post.title}</h3> : null}
                      {post.content ? <p className="ann-content">{post.content}</p> : null}
                    </div>
                    <div className="ann-meta">
                      <span className="ann-badge">{SECTION_LABELS[post.section] || post.section}</span>
                      <span className="ann-meta-info">{post.created_by_name || 'Admin'} · {new Date(post.created_at).toLocaleString('vi-VN')}</span>
                      <button type="button" className="ann-btn-unhide" onClick={() => handleUnhide(post)}>Bỏ ẩn</button>
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
