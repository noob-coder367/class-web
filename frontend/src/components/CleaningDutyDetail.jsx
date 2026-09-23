import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as classroomService from '../services/classroomService.js'
import {
  dateForDayISO,
  dayLabel,
  effectiveStatus,
  formatDateVN,
  getActiveWeekStartISO,
  statusLabel,
} from '../lib/cleaningDuty.js'
import { cleaningDayPath } from '../lib/routes.js'
import './CleaningDutyDetail.css'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'])

function isImageFile(file) {
  if (String(file?.type || '').toLowerCase().startsWith('image/')) return true
  const ext = String(file?.name || '').split('.').pop().toLowerCase()
  return IMAGE_EXTENSIONS.has(ext)
}

function imageFiles(files) {
  return Array.from(files || []).filter(isImageFile)
}

export default function CleaningDutyDetail({ dayId, gallery = false, canUpload = false }) {
  const navigate = useNavigate()
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const selectedRef = useRef([])
  const [weekStart, setWeekStart] = useState(() => getActiveWeekStartISO(new Date()))
  const dutyDate = useMemo(() => dateForDayISO(weekStart, dayId), [weekStart, dayId])
  const [schedule, setSchedule] = useState(null)
  const [status, setStatus] = useState(null)
  const [photos, setPhotos] = useState([])
  const [review, setReview] = useState({ rating: 0, comment: '' })
  const [selected, setSelected] = useState([])
  const [lightbox, setLightbox] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setWeekStart(getActiveWeekStartISO(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [scheduleData, statusData, photoData, reviewResult] = await Promise.all([
        classroomService.getCleaningSchedule(weekStart),
        classroomService.getCleaningStatus(weekStart),
        classroomService.getCleaningPhotos({ weekStart, dutyDate: dutyDate, dayId }),
        classroomService.getCleaningReview({ weekStart, dutyDate, dayId }).catch((err) => ({ __error: err })),
      ])
      setSchedule(scheduleData?.schedule || null)
      setStatus((statusData?.days || []).find((item) => item.duty_date === dutyDate) || null)
      setPhotos(photoData?.items || [])
      if (reviewResult?.__error) {
        setReview({ rating: 0, comment: '' })
        setError(reviewResult.__error.message || 'Không tải được đánh giá trực nhật.')
      } else {
        setReview({ rating: Number(reviewResult?.review?.rating) || 0, comment: reviewResult?.review?.comment || '' })
      }
    } catch (err) {
      setError(err.message || 'Không tải được thông tin trực nhật.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [dayId, dutyDate, weekStart])
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])
  useEffect(() => () => selectedRef.current.forEach((file) => URL.revokeObjectURL(file.preview)), [])

  const day = schedule?.days?.[dayId] || { assignees: [], note: '' }
  const displayStatus = effectiveStatus(dutyDate, status)

  const addFiles = (incoming) => {
    const valid = imageFiles(incoming)
    if (valid.length !== incoming.length) setError('Một số file không phải ảnh nên đã được bỏ qua.')
    const next = [...selected, ...valid]
    if (next.length > 20) {
      setError('Mỗi lượt chỉ được chọn tối đa 20 ảnh.')
      return
    }
    const tooLarge = next.find((file) => file.size > 25 * 1024 * 1024)
    if (tooLarge) {
      setError(`Ảnh "${tooLarge.name}" vượt quá giới hạn 25MB.`)
      return
    }
    setError('')
    setSelected(next.map((file) => Object.assign(file, { preview: URL.createObjectURL(file) })))
  }

  const removeSelected = (index) => {
    const file = selected[index]
    if (file?.preview) URL.revokeObjectURL(file.preview)
    setSelected((items) => items.filter((_item, itemIndex) => itemIndex !== index))
  }

  const upload = async () => {
    if (!selected.length || !canUpload) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const uploadedCount = selected.length
      await classroomService.uploadCleaningPhotos({ weekStart, dutyDate, dayId, files: selected })
      selected.forEach((file) => file.preview && URL.revokeObjectURL(file.preview))
      setSelected([])
      setSuccess(`Đã tải lên ${uploadedCount} ảnh trực nhật.`)
      await load()
    } catch (err) {
      setError(err.message || 'Không tải được ảnh trực nhật.')
    } finally {
      setUploading(false)
    }
  }

  const saveReview = async () => {
    setSavingReview(true)
    setError('')
    setSuccess('')
    try {
      const result = await classroomService.saveCleaningReview({ weekStart, dutyDate, dayId, ...review })
      setReview({ rating: Number(result?.review?.rating) || review.rating, comment: result?.review?.comment ?? review.comment })
      setSuccess('Đã lưu đánh giá trực nhật.')
    } catch (err) {
      setError(err.message || 'Không lưu được đánh giá trực nhật.')
    } finally {
      setSavingReview(false)
    }
  }

  const deletePhoto = async (photo) => {
    if (!canUpload || !window.confirm('Xóa ảnh trực nhật này?')) return
    try {
      await classroomService.deleteCleaningPhoto(photo.id)
      setPhotos((items) => items.filter((item) => item.id !== photo.id))
    } catch (err) {
      setError(err.message || 'Không xóa được ảnh trực nhật.')
    }
  }

  if (!dayId) return <div className="cleaning-detail-state">Không xác định được ngày trực.</div>

  return (
    <div className="cleaning-detail">
      <div className="cleaning-detail-head">
        <button type="button" className="cleaning-detail-back" onClick={() => navigate(classTabPathFallback())}>← Vệ sinh lớp</button>
        <div>
          <p className="cleaning-detail-kicker">Tuần bắt đầu {formatDateVN(weekStart)}</p>
          <h2>{dayLabel(dayId)} · {formatDateVN(dutyDate)}</h2>
        </div>
      </div>
      {error ? <p className="cleaning-detail-alert cleaning-detail-alert--error">{error}</p> : null}
      {success ? <p className="cleaning-detail-alert cleaning-detail-alert--success">{success}</p> : null}
      {loading ? <p className="cleaning-detail-state">Đang tải thông tin trực nhật...</p> : (
        <>
          <section className="cleaning-detail-card">
            <h3>Thông tin lượt trực</h3>
            <div className="cleaning-detail-info-grid">
              <div><span>Học sinh</span><strong>{day.assignees?.length ? day.assignees.join(', ') : 'Chưa phân công'}</strong></div>
              <div><span>Trạng thái</span><strong>{statusLabel(displayStatus)}</strong></div>
              <div><span>Ghi chú</span><strong>{day.note || status?.note || '—'}</strong></div>
            </div>
            {canUpload && !gallery ? (
              <div className="cleaning-detail-actions">
                <button type="button" onClick={() => navigate(cleaningDayPath(dayId, true))}>Thêm ảnh trực nhật</button>
              </div>
            ) : null}
          </section>

          <section id="cleaning-review" className="cleaning-detail-card">
            <h3>Đánh giá trực nhật</h3>
            {canUpload ? (
              <>
                <div className="cleaning-stars" aria-label="Chọn số sao">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" className={star <= review.rating ? 'is-selected' : ''} onClick={() => setReview((value) => ({ ...value, rating: star }))} aria-label={`${star} sao`}>
                      {star <= review.rating ? '★' : '☆'}
                    </button>
                  ))}
                </div>
                <label className="cleaning-review-field">Lời đánh giá
                  <textarea value={review.comment} maxLength={1000} onChange={(event) => setReview((value) => ({ ...value, comment: event.target.value }))} placeholder="Nhận xét về mức độ sạch sẽ..." />
                </label>
                <button type="button" className="cleaning-detail-primary" onClick={saveReview} disabled={savingReview}>{savingReview ? 'Đang lưu...' : 'Đổi số sao & đánh giá'}</button>
              </>
            ) : review.rating > 0 || review.comment.trim() ? (
              <>
                {review.rating > 0 ? (
                  <span className="cleaning-rating" role="img" aria-label={`${review.rating} trên 5 sao`}>
                    {'★'.repeat(review.rating)}
                    <span className="cleaning-rating-empty">{'★'.repeat(5 - review.rating)}</span>
                  </span>
                ) : null}
                {review.comment.trim() ? <p className="cleaning-review-readonly">Lời đánh giá: {review.comment}</p> : null}
              </>
            ) : (
              <p className="cleaning-detail-empty">Chưa có đánh giá</p>
            )}
          </section>

          {gallery && canUpload ? (
            <section className="cleaning-detail-card">
              <h3>Thêm ảnh trực nhật</h3>
              <div className="cleaning-upload-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files) }}>
                <p>Kéo ảnh vào đây hoặc chọn từ thiết bị</p>
                <div className="cleaning-upload-actions">
                  <button type="button" onClick={() => cameraRef.current?.click()}>Chụp ảnh</button>
                  <button type="button" onClick={() => galleryRef.current?.click()}>Chọn Album</button>
                </div>
                <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
                <input ref={galleryRef} hidden type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
                <small>Tối đa 20 ảnh/lượt, mỗi ảnh không quá 25MB.</small>
              </div>
              {selected.length ? <div className="cleaning-preview-grid">{selected.map((file, index) => <div key={`${file.name}-${index}`}><img src={file.preview} alt={file.name} /><button type="button" onClick={() => removeSelected(index)}>×</button></div>)}</div> : null}
              <button type="button" className="cleaning-detail-primary" onClick={upload} disabled={!selected.length || uploading}>{uploading ? `Đang tải ${selected.length} ảnh...` : `Tải ${selected.length || ''} ảnh lên`}</button>
            </section>
          ) : null}

          <section className="cleaning-detail-card">
            <h3>Ảnh trực nhật</h3>
            {photos.length ? <div className="cleaning-gallery">{photos.map((photo) => <figure key={photo.id}><button type="button" onClick={() => setLightbox(photo)}><img src={photo.url} alt={photo.original_name} /></button><figcaption>{photo.uploaded_by_name || 'Thành viên'} · {new Date(photo.created_at).toLocaleString('vi-VN')}{canUpload ? <button type="button" onClick={() => deletePhoto(photo)}>Xóa</button> : null}</figcaption></figure>)}</div> : <p className="cleaning-detail-empty">Chưa có ảnh trực nhật</p>}
          </section>
        </>
      )}
      {lightbox ? <div className="cleaning-lightbox" role="presentation" onClick={() => setLightbox(null)}><img src={lightbox.url} alt={lightbox.original_name} /></div> : null}
    </div>
  )
}

function classTabPathFallback() {
  return '/vo-lop/ve-sinh-chung'
}
