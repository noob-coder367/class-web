import { useCallback, useEffect, useRef, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './AnnouncementsBoard.css'

const NOTIFY_OPTIONS = ['normal', 'hot', 'urgent']

const NOTIFY_LABELS = {
  normal: 'Thông thường',
  hot: '🔥 Hot',
  urgent: '🚨 Khẩn cấp',
}

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

export default function AnnouncementsBoard({
  isAdmin,
  tkbNotice,
  onDismissTkbNotice,
  dismissingTkb,
  onOpenTimetable,
}) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showComposer, setShowComposer] = useState(false)
  const [posting, setPosting] = useState(false)
  const [content, setContent] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  const [notifyType, setNotifyType] = useState('normal')
  const [showNotifyMenu, setShowNotifyMenu] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')

  const [editingExpiryId, setEditingExpiryId] = useState(null)
  const [editExpiresAt, setEditExpiresAt] = useState('')

  const fileInputRef = useRef(null)

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
    setShowComposer(false)
  }

  const handlePost = async () => {
    if (!isAdmin) return
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

  const handleDelete = async (id) => {
    if (!isAdmin) return
    if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return
    try {
      await classroomService.deleteAnnouncement(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      alert(err.message || 'Xóa thất bại.')
    }
  }

  const startEditExpiry = (post) => {
    if (!isAdmin) return
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
    if (!isAdmin) return
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

  const hasAny =
    (tkbNotice && tkbNotice.active) || posts.length > 0

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
      ) : !hasAny ? (
        <p className="ann-empty">Chưa có thông báo nào.</p>
      ) : (
        <div className="ann-list">
          {/* Thông báo thay đổi TKB (nếu còn) */}
          {tkbNotice?.active ? (
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
                {isAdmin ? (
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

          {posts.map((post) => (
            <article
              key={post.id}
              className={`ann-card ann-card--${post.notify_type || 'normal'}`}
            >
              <div className="ann-body">
                {post.images?.length > 0 ? (
                  <div className="ann-images" style={imageGridStyle(post.images.length)}>
                    {post.images.map((url, i) => (
                      <a
                        key={i}
                        className="ann-image"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img src={url} alt={`Ảnh ${i + 1}`} loading="lazy" />
                      </a>
                    ))}
                  </div>
                ) : null}

                {post.content ? (
                  <div className="ann-content-wrap">
                    <p className="ann-content">{post.content}</p>
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

                {isAdmin && editingExpiryId === post.id ? (
                  <span className="ann-expire-edit">
                    <input
                      type="datetime-local"
                      value={editExpiresAt}
                      onChange={(e) => setEditExpiresAt(e.target.value)}
                    />
                    <button type="button" className="ann-btn-save-expiry" onClick={() => handleUpdateExpiry(post.id)}>
                      Lưu
                    </button>
                    <button type="button" className="ann-btn-cancel-expiry" onClick={cancelEditExpiry}>
                      Hủy
                    </button>
                  </span>
                ) : isAdmin ? (
                  <button
                    type="button"
                    className="ann-btn-expiry"
                    onClick={() => startEditExpiry(post)}
                    title="Đổi thời gian tự xóa"
                  >
                    Đổi giờ tự xóa
                  </button>
                ) : null}

                {isAdmin ? (
                  <button type="button" className="ann-btn-delete" onClick={() => handleDelete(post.id)}>
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
    </div>
  )
}
