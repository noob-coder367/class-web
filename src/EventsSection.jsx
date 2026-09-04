import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import './EventsSection.css'

const NOTIFY_OPTIONS = ['normal', 'hot', 'urgent']

const NOTIFY_LABELS = {
  normal: 'Thông thường',
  hot: '🔥 Hot',
  urgent: '🚨 Khẩn cấp',
}

export default function EventsSection({ profile }) {
  /* =====================================================
     LIST STATE
  ===================================================== */

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  /* =====================================================
     COMPOSER STATE
  ===================================================== */

  const [showComposer, setShowComposer] = useState(false)
  const [posting, setPosting] = useState(false)

  const [content, setContent] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])

  const [notifyType, setNotifyType] = useState('normal')
  const [showNotifyMenu, setShowNotifyMenu] = useState(false)

  const [expiresAt, setExpiresAt] = useState('')

  const fileInputRef = useRef(null)

  const isAdmin = profile?.role === 'admin'

  /* =====================================================
     FETCH EVENTS

     Trước khi tải danh sách, gọi function
     delete_expired_events() để dọn các sự kiện
     đã hết hạn (xem SQL đi kèm).
  ===================================================== */

  const fetchEvents = async () => {
    try {
      await supabase.rpc('delete_expired_events')
    } catch (error) {
      console.error(
        'Lỗi dọn sự kiện hết hạn:',
        error
      )
    }

    const {
      data,
      error,
    } = await supabase
      .from('events')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (data) {
      setEvents(data)
    }

    if (error) {
      console.error(
        'Lỗi tải sự kiện:',
        error
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchEvents()

    /*
      Cập nhật realtime khi có sự kiện
      mới / bị xóa.
    */

    const channel = supabase
      .channel('realtime-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
        },
        () => {
          fetchEvents()
        }
      )
      .subscribe()

    /*
      Dự phòng: cứ 60s tự kiểm tra và dọn
      sự kiện hết hạn, kể cả khi không có
      thay đổi realtime nào xảy ra.
    */

    const interval = setInterval(() => {
      fetchEvents()
    }, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  /* =====================================================
     FILE HANDLING
  ===================================================== */

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || [])

    if (files.length === 0) return

    setSelectedFiles((prev) => [...prev, ...files])

    setPreviewUrls((prev) => [
      ...prev,
      ...files.map((file) =>
        URL.createObjectURL(file)
      ),
    ])

    /*
      Reset input để có thể chọn lại
      cùng 1 file nếu cần.
    */

    e.target.value = ''
  }

  const removeFile = (index) => {
    setSelectedFiles((prev) =>
      prev.filter((_, i) => i !== index)
    )

    setPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index])

      return prev.filter((_, i) => i !== index)
    })
  }

  /* =====================================================
     RESET / CLOSE COMPOSER
  ===================================================== */

  const closeComposer = () => {
    if (posting) return

    previewUrls.forEach((url) =>
      URL.revokeObjectURL(url)
    )

    setContent('')
    setSelectedFiles([])
    setPreviewUrls([])
    setNotifyType('normal')
    setShowNotifyMenu(false)
    setExpiresAt('')
    setShowComposer(false)
  }

  /* =====================================================
     UPLOAD ẢNH LÊN SUPABASE STORAGE

     Bucket: event-images (cần tạo trước,
     để Public).
  ===================================================== */

  const uploadImages = async () => {
    const uploadedUrls = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]

      const ext =
        file.name.split('.').pop() || 'jpg'

      const path = `events/${Date.now()}-${i}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`

      const {
        error: uploadError,
      } = await supabase.storage
        .from('event-images')
        .upload(path, file)

      if (uploadError) {
        throw new Error(
          `Tải ảnh "${file.name}" thất bại: ${uploadError.message}`
        )
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from('event-images')
        .getPublicUrl(path)

      uploadedUrls.push(publicUrlData.publicUrl)
    }

    return uploadedUrls
  }

  /* =====================================================
     ĐĂNG SỰ KIỆN
  ===================================================== */

  const handlePostEvent = async () => {
    if (!isAdmin) return

    const cleanContent = content.trim()

    if (!cleanContent && selectedFiles.length === 0) {
      return alert(
        'Vui lòng nhập nội dung hoặc chọn ít nhất 1 ảnh!'
      )
    }

    setPosting(true)

    try {
      const imageUrls =
        selectedFiles.length > 0
          ? await uploadImages()
          : []

      const {
        error,
      } = await supabase.from('events').insert([
        {
          content: cleanContent,
          images: imageUrls,
          notify_type: notifyType,
          expires_at: expiresAt
            ? new Date(expiresAt).toISOString()
            : null,
          created_by: profile?.id || null,
          created_by_name:
            profile?.username || 'Admin',
        },
      ])

      if (error) {
        alert(
          'Đăng sự kiện thất bại: ' +
          error.message
        )

        return
      }

      closeComposer()
      fetchEvents()

    } catch (error) {
      console.error(error)

      alert(
        error.message ||
        'Có lỗi xảy ra khi đăng sự kiện!'
      )
    } finally {
      setPosting(false)
    }
  }

  /* =====================================================
     XÓA SỰ KIỆN (chỉ admin)
  ===================================================== */

  const handleDeleteEvent = async (eventId) => {
    if (!isAdmin) return

    const confirmDelete = window.confirm(
      'Bạn có chắc chắn muốn xóa sự kiện này?'
    )

    if (!confirmDelete) return

    const {
      error,
    } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)

    if (error) {
      alert(
        'Xóa sự kiện thất bại: ' +
        error.message
      )

      return
    }

    setEvents((prev) =>
      prev.filter((e) => e.id !== eventId)
    )
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <>
      <section
        id="su-kien"
        className="events-section"
      >

        <div className="section-inner">

          <p className="eyebrow">
            Cập nhật
          </p>

          <h2>
            Sự kiện
          </h2>

          <p className="section-desc">
            Những sự kiện, thông báo nổi bật
            của lớp 10A4 sẽ được cập nhật
            tại đây.
          </p>

          {loading ? (
            <p className="empty-state">
              Đang tải sự kiện...
            </p>
          ) : events.length === 0 ? (
            <p className="empty-state">
              Chưa có sự kiện nào.
            </p>
          ) : (
            <div className="event-list">

              {events.map((event) => (
                <article
                  className={`event-card event-card--${event.notify_type}`}
                  key={event.id}
                >

                  <div className="event-body">

                    {event.images?.length > 0 && (
                      <div
                        className="event-images"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(
                            event.images.length,
                            3
                          )}, 1fr)`,
                        }}
                      >
                        {event.images.map(
                          (url, i) => (
                            <div
                              className="event-image"
                              key={i}
                            >
                              <img
                                src={url}
                                alt={`Ảnh sự kiện ${i + 1}`}
                                loading="lazy"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {event.content && (
                      <div className="event-content">
                        <p>
                          {event.content}
                        </p>
                      </div>
                    )}

                  </div>

                  <div className="event-meta">

                    <span
                      className={`notify-badge notify-badge--${event.notify_type}`}
                    >
                      {NOTIFY_LABELS[
                        event.notify_type
                      ] || 'Thông thường'}
                    </span>

                    <span className="event-meta-info">
                      {event.created_by_name ||
                        'Admin'}{' '}
                      ·{' '}
                      {new Date(
                        event.created_at
                      ).toLocaleString(
                        'vi-VN'
                      )}
                    </span>

                    {event.expires_at && (
                      <span className="event-meta-info">
                        Tự xóa:{' '}
                        {new Date(
                          event.expires_at
                        ).toLocaleString(
                          'vi-VN'
                        )}
                      </span>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-delete-event"
                        onClick={() =>
                          handleDeleteEvent(
                            event.id
                          )
                        }
                      >
                        Xóa
                      </button>
                    )}

                  </div>

                </article>
              ))}

            </div>
          )}

        </div>

      </section>

      {/* =================================================
          FAB - CHỈ ADMIN THẤY
      ================================================= */}

      {isAdmin && (
        <button
          type="button"
          className="event-fab"
          onClick={() =>
            setShowComposer(true)
          }
          aria-label="Đăng sự kiện mới"
          title="Đăng sự kiện mới"
        >
          +
        </button>
      )}

      {/* =================================================
          COMPOSER MODAL
      ================================================= */}

      {showComposer && (
        <div className="event-composer-overlay fade-in">
          <div className="event-composer-modal slide-up">

            <div className="event-composer-header">
              <h2>
                Đăng sự kiện mới
              </h2>

              <button
                type="button"
                className="btn-close"
                onClick={closeComposer}
                disabled={posting}
              >
                ✕
              </button>
            </div>

            <div className="event-composer-body">

              <div className="composer-left">

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFilesChange}
                  style={{ display: 'none' }}
                />

                <div
                  className="upload-box"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >

                  {previewUrls.length === 0 ? (
                    <div className="upload-placeholder">
                      <span className="upload-icon">
                        📷
                      </span>

                      <p>
                        Chạm để chọn ảnh từ
                        thư viện điện thoại
                      </p>
                    </div>
                  ) : (
                    <div className="upload-preview-grid">

                      {previewUrls.map(
                        (url, i) => (
                          <div
                            className="upload-preview-item"
                            key={i}
                          >
                            <img
                              src={url}
                              alt="preview"
                            />

                            <button
                              type="button"
                              className="btn-remove-preview"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(i)
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )
                      )}

                    </div>
                  )}

                </div>

                {previewUrls.length > 0 && (
                  <button
                    type="button"
                    className="btn-add-more"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    + Thêm ảnh khác
                  </button>
                )}

              </div>

              <div className="composer-right">

                <textarea
                  className="composer-textarea"
                  placeholder="Nội dung sự kiện..."
                  rows={8}
                  value={content}
                  onChange={(e) =>
                    setContent(e.target.value)
                  }
                />

                <div className="composer-extra-row">

                  <div className="notify-dropdown">

                    <button
                      type="button"
                      className="btn-notify-toggle"
                      onClick={() =>
                        setShowNotifyMenu(
                          (v) => !v
                        )
                      }
                    >
                      {NOTIFY_LABELS[notifyType]}{' '}
                      ▾
                    </button>

                    {showNotifyMenu && (
                      <div className="notify-menu">

                        {NOTIFY_OPTIONS.map(
                          (opt) => (
                            <button
                              key={opt}
                              type="button"
                              className={`notify-menu-item ${
                                notifyType ===
                                opt
                                  ? 'active'
                                  : ''
                              }`}
                              onClick={() => {
                                setNotifyType(
                                  opt
                                )
                                setShowNotifyMenu(
                                  false
                                )
                              }}
                            >
                              {
                                NOTIFY_LABELS[
                                  opt
                                ]
                              }
                            </button>
                          )
                        )}

                      </div>
                    )}

                  </div>

                  <label className="expire-picker">
                    <span>
                      Tự xóa lúc:
                    </span>

                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) =>
                        setExpiresAt(
                          e.target.value
                        )
                      }
                    />
                  </label>

                </div>

              </div>

            </div>

            <div className="event-composer-footer">
              <button
                type="button"
                className="btn-post-event"
                disabled={posting}
                onClick={handlePostEvent}
              >
                {posting
                  ? 'Đang đăng...'
                  : 'Đăng thông báo sự kiện'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
