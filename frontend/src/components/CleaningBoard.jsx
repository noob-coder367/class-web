import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as classroomService from '../services/classroomService.js'
import CleaningDutySettings from './CleaningDutySettings.jsx'
import {
  DAY_IDS,
  dateForDayISO,
  dayIdFor,
  dayLabel,
  effectiveStatus,
  formatDateVN,
  getActiveWeekEndISO,
  getActiveWeekStartISO,
  getWeekStartISO,
  statusLabel,
  todayISO,
  tomorrowISO,
} from '../lib/cleaningDuty.js'
import { CLEANING_SHARE_PATH, cleaningDayPath } from '../lib/routes.js'
import { shareHelper } from '../utils/shareHelper.js'
import './CleaningBoard.css'

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

function statusDotClass(status) {
  if (status === 'done') return 'cleaning-dot cleaning-dot--done'
  if (status === 'not_clean') return 'cleaning-dot cleaning-dot--not-clean'
  if (status === 'doing') return 'cleaning-dot cleaning-dot--doing'
  return 'cleaning-dot cleaning-dot--preparing'
}

function findStatusRow(weekStatus, dateISO) {
  return (weekStatus?.days || []).find((row) => row.duty_date === dateISO) || null
}

function getAssigneesForDate(schedule, dateISO) {
  const dayId = dayIdFor(dateISO)
  if (!dayId || !schedule?.days) return []
  // Chỉ lấy assignee nếu ngày thuộc đúng tuần của schedule
  if (schedule.week_start && getWeekStartISO(dateISO) !== schedule.week_start) return []
  return schedule.days[dayId]?.assignees || []
}

function StarRating({ rating }) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0))
  if (!n) return null
  return (
    <span className="cleaning-rating" role="img" aria-label={`${n} trên 5 sao`}>
      {'★'.repeat(n)}
      <span className="cleaning-rating-empty">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

function ReviewComment({ review }) {
  const comment = String(review?.comment || '').trim()
  if (!comment) return null
  return <p className="cleaning-review-comment">Lời đánh giá: {comment}</p>
}

/** Ô chỉ chứa ảnh trực nhật của 1 ngày (cuộn được nếu nhiều ảnh). */
function DutyPhotosModal({ dateISO, dayId, onClose }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await classroomService.getCleaningPhotos({
          weekStart: getWeekStartISO(dateISO),
          dutyDate: dateISO,
          dayId,
        })
        if (!cancelled) setPhotos(data?.items || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được ảnh trực nhật.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [dateISO, dayId])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (zoom) setZoom(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, onClose])

  return (
    <div className="cleaning-photos-overlay" role="presentation" onClick={onClose}>
      <div
        className="cleaning-photos-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Ảnh trực nhật"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="cleaning-photos-close" onClick={onClose} aria-label="Đóng">×</button>
        {loading ? <p className="cleaning-photos-state">Đang tải ảnh...</p> : null}
        {error ? <p className="cleaning-photos-state cleaning-photos-state--error">{error}</p> : null}
        {!loading && !error && !photos.length ? <p className="cleaning-photos-state">Chưa có ảnh trực nhật</p> : null}
        {photos.length ? (
          <div className="cleaning-photos-scroll">
            {photos.map((photo) => (
              <button key={photo.id} type="button" className="cleaning-photos-item" onClick={() => setZoom(photo)}>
                <img src={photo.url} alt={photo.original_name || 'Ảnh trực nhật'} loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {zoom ? (
        <div
          className="cleaning-photos-zoom"
          role="presentation"
          onClick={(event) => { event.stopPropagation(); setZoom(null) }}
        >
          <img src={zoom.url} alt={zoom.original_name || 'Ảnh trực nhật'} />
        </div>
      ) : null}
    </div>
  )
}

function DutyStatusCard({ title, dateISO, statusRow, assignees, isAdmin, onUpdate, updating, onOpen, onOpenPhotos }) {
  const dayId = dayIdFor(dateISO)
  const displayStatus = effectiveStatus(dateISO, statusRow)
  const review = statusRow?.review || null

  return (
    <div className={`cleaning-status-card cleaning-status-card--${displayStatus}`}>
      <div className="cleaning-status-card-head">
        <span className="cleaning-status-card-title">{title}</span>
        <span className="cleaning-status-card-date">{formatDateVN(dateISO)}</span>
      </div>

      {!dayId ? (
        <p className="cleaning-status-card-empty">Chủ nhật — không có lịch trực vệ sinh.</p>
      ) : (
        <>
          <div className="cleaning-status-assignees">
            {assignees.length > 0 ? (
              assignees.map((name) => (
                <span key={name} className="cleaning-assignee-chip">{name}</span>
              ))
            ) : (
              <span className="cleaning-status-no-assignee">Chưa phân công</span>
            )}
          </div>

          <div className="cleaning-status-row">
            <span className={statusDotClass(displayStatus)} aria-hidden="true" />
            <span className="cleaning-status-text">{statusLabel(displayStatus)}</span>
            <StarRating rating={review?.rating} />
          </div>
          <ReviewComment review={review} />

          {statusRow?.marked_by_name ? (
            <p className="cleaning-status-meta">
              Cập nhật bởi {statusRow.marked_by_name}
              {statusRow.marked_at ? ` · ${new Date(statusRow.marked_at).toLocaleString('vi-VN')}` : ''}
            </p>
          ) : null}
          {statusRow?.note ? <p className="cleaning-status-note">Ghi chú: {statusRow.note}</p> : null}

          {isAdmin ? (
            <div className="cleaning-status-actions">
              <button
                type="button"
                className="cleaning-status-btn cleaning-status-btn--doing"
                disabled={updating || displayStatus === 'doing'}
                onClick={() => onUpdate(dateISO, 'doing')}
              >
                Đang làm
              </button>
              <button
                type="button"
                className="cleaning-status-btn cleaning-status-btn--done"
                disabled={updating || displayStatus === 'done'}
                onClick={() => onUpdate(dateISO, 'done')}
              >
                Đã làm
              </button>
              <button
                type="button"
                className="cleaning-status-btn cleaning-status-btn--not-clean"
                disabled={updating || displayStatus === 'not_clean'}
                onClick={() => onUpdate(dateISO, 'not_clean')}
                title="Đánh dấu lớp chưa đạt yêu cầu vệ sinh"
              >
                Chưa sạch!
              </button>
              <button
                type="button"
                className="cleaning-status-btn cleaning-status-btn--preparing"
                disabled={updating || displayStatus === 'preparing'}
                onClick={() => onUpdate(dateISO, 'preparing')}
              >
                Đặt lại
              </button>
            </div>
          ) : null}
          <div className="cleaning-status-media-actions">
            <button type="button" className="cleaning-link-btn" onClick={() => onOpenPhotos(dateISO, dayId)}>Xem ảnh trực</button>
            {isAdmin ? <button type="button" className="cleaning-status-add" onClick={() => onOpen(dayId, true)} aria-label="Thêm ảnh trực nhật">+</button> : null}
          </div>
          <div className="cleaning-status-media-actions">
            <button type="button" className="cleaning-link-btn" onClick={() => onOpen(dayId)}>Xem chi tiết <span aria-hidden="true">→</span></button>
          </div>
        </>
      )}
    </div>
  )
}

export default function CleaningBoard({ isAdmin }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schedule, setSchedule] = useState(null)
  const [weekStatuses, setWeekStatuses] = useState({})
  const [photosTarget, setPhotosTarget] = useState(null)
  const [openSettings, setOpenSettings] = useState(false)
  const [updatingDate, setUpdatingDate] = useState('')

  const todayDate = todayISO()
  const tomorrowDate = tomorrowISO()
  // Chủ nhật → tuần hiệu lực = tuần sau (T2–T7 sắp tới)
  const [activeWeekStart, setActiveWeekStart] = useState(() => getActiveWeekStartISO(new Date()))
  const currentWeekStart = activeWeekStart
  const currentWeekEnd = useMemo(() => getActiveWeekEndISO(activeWeekStart), [activeWeekStart])
  const todayWeekStart = useMemo(() => getWeekStartISO(todayDate), [todayDate])
  const tomorrowWeekStart = useMemo(() => getWeekStartISO(tomorrowDate), [tomorrowDate])

  useEffect(() => {
    const timer = setInterval(() => setActiveWeekStart(getActiveWeekStartISO(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // Trạng thái + đánh giá của mọi tuần cần hiển thị (hôm nay, ngày mai, bảng trực)
      const weekStarts = [...new Set([todayWeekStart, tomorrowWeekStart, currentWeekStart])]
      const [scheduleData, ...statusList] = await Promise.all([
        classroomService.getCleaningSchedule(currentWeekStart),
        ...weekStarts.map((ws) => classroomService.getCleaningStatus(ws)),
      ])
      setSchedule(scheduleData?.schedule || null)
      setWeekStatuses(Object.fromEntries(weekStarts.map((ws, i) => [ws, statusList[i] || null])))
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu vệ sinh lớp.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpdateStatus = async (dateISO, status) => {
    setUpdatingDate(dateISO)
    try {
      await classroomService.updateCleaningStatus(dateISO, { status })
      await load()
    } catch (err) {
      setError(err.message || 'Không cập nhật được trạng thái vệ sinh.')
    } finally {
      setUpdatingDate('')
    }
  }

  const handleSaveSchedule = async (payload) => {
    await classroomService.saveCleaningSchedule(payload)
    await load()
  }

  const todayStatusRow = findStatusRow(weekStatuses[todayWeekStart], todayDate)
  const tomorrowStatusRow = findStatusRow(weekStatuses[tomorrowWeekStart], tomorrowDate)
  const todayAssignees = getAssigneesForDate(schedule, todayDate)
  const tomorrowAssignees = getAssigneesForDate(schedule, tomorrowDate)

  const weekTitleFrom = formatDateVN(schedule?.week_start || currentWeekStart)
  const weekTitleTo = formatDateVN(currentWeekEnd)

  const todayDisplayStatus = effectiveStatus(todayDate, todayStatusRow)
  const tomorrowDisplayStatus = effectiveStatus(tomorrowDate, tomorrowStatusRow)

  const handleShareStatus = () => {
    shareHelper({
      title: 'Lịch vệ sinh lớp...',
      text: `Hôm nay: ${statusLabel(todayDisplayStatus)} · Ngày mai: ${statusLabel(tomorrowDisplayStatus)}`,
      path: CLEANING_SHARE_PATH,
      fullText: true,
    })
  }

  const openDay = (dayId, gallery = false) => navigate(cleaningDayPath(dayId, gallery))
  const openPhotos = (dateISO, dayId) => setPhotosTarget({ dateISO, dayId })

  return (
    <div className="cleaning-board">
      {error ? <p className="cleaning-board-error">{error}</p> : null}

      <section className="cleaning-card">
        <h2 className="cleaning-card-title">Tình trạng vệ sinh lớp</h2>
        {loading ? (
          <p className="cleaning-board-loading">Đang tải...</p>
        ) : (
          <div className="cleaning-status-grid">
            <DutyStatusCard
              title="Hôm nay"
              dateISO={todayDate}
              statusRow={todayStatusRow}
              assignees={todayAssignees}
              isAdmin={isAdmin}
              onUpdate={handleUpdateStatus}
              updating={updatingDate === todayDate}
              onOpen={openDay}
              onOpenPhotos={openPhotos}
            />
            <DutyStatusCard
              title="Ngày mai"
              dateISO={tomorrowDate}
              statusRow={tomorrowStatusRow}
              assignees={tomorrowAssignees}
              isAdmin={isAdmin}
              onUpdate={handleUpdateStatus}
              updating={updatingDate === tomorrowDate}
              onOpen={openDay}
              onOpenPhotos={openPhotos}
            />
          </div>
        )}
      </section>

      <div className="cleaning-share-row">
        <button
          type="button"
          className="cleaning-btn-share"
          onClick={handleShareStatus}
          aria-label="Chia sẻ tình trạng vệ sinh lớp"
        >
          <IconShare />
          Chia sẻ
        </button>
      </div>

      <section className="cleaning-card">
        <div className="cleaning-card-head">
          <h2 className="cleaning-card-title">
            Danh sách trực từ ngày {weekTitleFrom} đến ngày {weekTitleTo}
          </h2>
        </div>

        {loading ? (
          <p className="cleaning-board-loading">Đang tải...</p>
        ) : (
          <div className="cleaning-table-wrap">
            <table className="cleaning-table">
              <thead>
                <tr>
                  <th>Thứ</th>
                  <th>Học sinh trực</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {DAY_IDS.map((dayId) => {
                  const day = schedule?.days?.[dayId]
                  const isToday = dayIdFor(todayDate) === dayId && currentWeekStart === todayWeekStart
                  const rowDate = dateForDayISO(currentWeekStart, dayId)
                  const review = findStatusRow(weekStatuses[currentWeekStart], rowDate)?.review || null
                  const rowClass = isToday ? 'cleaning-row--today' : ''
                  return (
                    <Fragment key={dayId}>
                    <tr className={`cleaning-row-main ${rowClass}`}>
                      <td className="cleaning-table-day">{dayLabel(dayId)}</td>
                      <td>
                        {day?.assignees?.length ? (
                          <div className="cleaning-assignees">
                            {day.assignees.map((name) => (
                              <span key={name} className="cleaning-assignee-chip">{name}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="cleaning-table-empty">Chưa phân công</span>
                        )}
                      </td>
                      <td className="cleaning-table-note">{day?.note || '—'}</td>
                    </tr>
                    <tr className={`cleaning-row-extra ${rowClass}`}>
                      <td colSpan={3}>
                        <div className="cleaning-row-review">
                          <div className="cleaning-row-review-text">
                            <StarRating rating={review?.rating} />
                            <ReviewComment review={review} />
                          </div>
                          <button type="button" className="cleaning-link-btn" onClick={() => openDay(dayId)}>
                            Xem chi tiết <span aria-hidden="true">→</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {schedule?.note ? <p className="cleaning-week-note">Ghi chú tuần: {schedule.note}</p> : null}
      </section>

      {isAdmin ? (
        <button
          type="button"
          className="cleaning-fab"
          onClick={() => setOpenSettings(true)}
          aria-label="Cài đặt lịch trực"
          title="Cài đặt lịch trực (tuần này & tuần sau)"
        >
          <IconGear />
        </button>
      ) : null}

      {photosTarget ? (
        <DutyPhotosModal
          dateISO={photosTarget.dateISO}
          dayId={photosTarget.dayId}
          onClose={() => setPhotosTarget(null)}
        />
      ) : null}

      {openSettings ? (
        <CleaningDutySettings
          onClose={() => setOpenSettings(false)}
          onSave={handleSaveSchedule}
        />
      ) : null}
    </div>
  )
}
