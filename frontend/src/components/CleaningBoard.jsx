import { useEffect, useMemo, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import CleaningDutySettings from './CleaningDutySettings.jsx'
import {
  DAY_IDS,
  dayIdFor,
  dayLabel,
  formatDateVN,
  getWeekStartISO,
  statusLabel,
  todayISO,
  tomorrowISO,
} from '../lib/cleaningDuty.js'
import './CleaningBoard.css'

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
  if (status === 'not_done') return 'cleaning-dot cleaning-dot--not-done'
  return 'cleaning-dot cleaning-dot--pending'
}

/** Tìm hàng trạng thái của 1 ngày cụ thể trong danh sách trả về từ API tuần. */
function findStatusRow(weekStatus, dateISO) {
  return (weekStatus?.days || []).find((row) => row.duty_date === dateISO) || null
}

function DutyStatusCard({ title, dateISO, statusRow, isAdmin, onUpdate, updating }) {
  const dayId = dayIdFor(dateISO)

  return (
    <div className="cleaning-status-card">
      <div className="cleaning-status-card-head">
        <span className="cleaning-status-card-title">{title}</span>
        <span className="cleaning-status-card-date">{formatDateVN(dateISO)}</span>
      </div>

      {!dayId ? (
        <p className="cleaning-status-card-empty">Chủ nhật — không có lịch trực vệ sinh.</p>
      ) : (
        <>
          <div className="cleaning-status-row">
            <span className={statusDotClass(statusRow?.status)} aria-hidden="true" />
            <span className="cleaning-status-text">{statusLabel(statusRow?.status)}</span>
          </div>
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
                className="cleaning-status-btn cleaning-status-btn--done"
                disabled={updating || statusRow?.status === 'done'}
                onClick={() => onUpdate(dateISO, 'done')}
              >
                Đã dọn
              </button>
              <button
                type="button"
                className="cleaning-status-btn cleaning-status-btn--not-done"
                disabled={updating || statusRow?.status === 'not_done'}
                onClick={() => onUpdate(dateISO, 'not_done')}
              >
                Chưa dọn
              </button>
              <button
                type="button"
                className="cleaning-status-btn cleaning-status-btn--pending"
                disabled={updating || statusRow?.status === 'pending' || !statusRow?.status}
                onClick={() => onUpdate(dateISO, 'pending')}
              >
                Đặt lại
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default function CleaningBoard({ isAdmin }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schedule, setSchedule] = useState(null)
  const [todayWeekStatus, setTodayWeekStatus] = useState(null)
  const [tomorrowWeekStatus, setTomorrowWeekStatus] = useState(null)
  const [openSettings, setOpenSettings] = useState(false)
  const [updatingDate, setUpdatingDate] = useState('')

  const todayDate = todayISO()
  const tomorrowDate = tomorrowISO()
  const currentWeekStart = useMemo(() => getWeekStartISO(new Date()), [])
  const todayWeekStart = useMemo(() => getWeekStartISO(todayDate), [todayDate])
  const tomorrowWeekStart = useMemo(() => getWeekStartISO(tomorrowDate), [tomorrowDate])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const needsSeparateFetch = tomorrowWeekStart !== todayWeekStart
      const [scheduleData, todayStatusData, tomorrowStatusData] = await Promise.all([
        classroomService.getCleaningSchedule(currentWeekStart),
        classroomService.getCleaningStatus(todayWeekStart),
        needsSeparateFetch
          ? classroomService.getCleaningStatus(tomorrowWeekStart)
          : Promise.resolve(null),
      ])
      setSchedule(scheduleData?.schedule || null)
      setTodayWeekStatus(todayStatusData || null)
      setTomorrowWeekStatus(needsSeparateFetch ? tomorrowStatusData : todayStatusData)
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
    const data = await classroomService.saveCleaningSchedule(payload)
    setSchedule(data?.schedule || payload)
    await load()
  }

  const todayStatusRow = findStatusRow(todayWeekStatus, todayDate)
  const tomorrowStatusRow = findStatusRow(tomorrowWeekStatus, tomorrowDate)

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
              isAdmin={isAdmin}
              onUpdate={handleUpdateStatus}
              updating={updatingDate === todayDate}
            />
            <DutyStatusCard
              title="Ngày mai"
              dateISO={tomorrowDate}
              statusRow={tomorrowStatusRow}
              isAdmin={isAdmin}
              onUpdate={handleUpdateStatus}
              updating={updatingDate === tomorrowDate}
            />
          </div>
        )}
      </section>

      <section className="cleaning-card">
        <div className="cleaning-card-head">
          <h2 className="cleaning-card-title">Bảng phân công trực</h2>
          {schedule?.week_start ? (
            <span className="cleaning-card-week">
              Tuần từ {formatDateVN(schedule.week_start)}
            </span>
          ) : null}
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
                  return (
                    <tr key={dayId} className={isToday ? 'cleaning-row--today' : ''}>
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
          aria-label="Sửa phân công trực"
          title="Sửa phân công trực"
        >
          <IconGear />
        </button>
      ) : null}

      {openSettings ? (
        <CleaningDutySettings
          weekStart={currentWeekStart}
          schedule={schedule}
          onClose={() => setOpenSettings(false)}
          onSave={handleSaveSchedule}
        />
      ) : null}
    </div>
  )
}
