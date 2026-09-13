import { useEffect, useMemo, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import {
  DAY_IDS,
  dayLabel,
  formatDateVN,
  getActiveWeekEndISO,
  getActiveWeekStartISO,
  getNextWeekEndISO,
  getNextWeekStartISO,
} from '../lib/cleaningDuty.js'
import './CleaningDutySettings.css'

function emptyDays() {
  const initial = {}
  for (const dayId of DAY_IDS) {
    initial[dayId] = { assignees: [], note: '' }
  }
  return initial
}

function daysFromSchedule(schedule) {
  const initial = emptyDays()
  if (!schedule?.days) return initial
  for (const dayId of DAY_IDS) {
    const src = schedule.days[dayId]
    initial[dayId] = {
      assignees: Array.isArray(src?.assignees) ? [...src.assignees] : [],
      note: src?.note || '',
    }
  }
  return initial
}

export default function CleaningDutySettings({ onClose, onSave }) {
  // Chủ nhật: "Tuần này" = T2–T7 tuần kế (đã reset)
  const thisWeekStart = useMemo(() => getActiveWeekStartISO(new Date()), [])
  const thisWeekEnd = useMemo(() => getActiveWeekEndISO(new Date()), [])
  const nextWeekStart = useMemo(() => getNextWeekStartISO(new Date()), [])
  const nextWeekEnd = useMemo(() => getNextWeekEndISO(new Date()), [])

  const [activeWeek, setActiveWeek] = useState('this') // 'this' | 'next'
  const [thisDays, setThisDays] = useState(emptyDays)
  const [nextDays, setNextDays] = useState(emptyDays)
  const [thisNote, setThisNote] = useState('')
  const [nextNote, setNextNote] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [membersData, thisSchedule, nextSchedule] = await Promise.all([
          classroomService.getMembers().catch(() => ({ members: [] })),
          classroomService.getCleaningSchedule(thisWeekStart),
          classroomService.getCleaningSchedule(nextWeekStart),
        ])
        if (cancelled) return
        setMembers(Array.isArray(membersData?.members) ? membersData.members : [])
        setThisDays(daysFromSchedule(thisSchedule?.schedule))
        setThisNote(thisSchedule?.schedule?.note || '')
        setNextDays(daysFromSchedule(nextSchedule?.schedule))
        setNextNote(nextSchedule?.schedule?.note || '')
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được dữ liệu cài đặt.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [thisWeekStart, nextWeekStart])

  const days = activeWeek === 'this' ? thisDays : nextDays
  const setDays = activeWeek === 'this' ? setThisDays : setNextDays
  const weekNote = activeWeek === 'this' ? thisNote : nextNote
  const setWeekNote = activeWeek === 'this' ? setThisNote : setNextNote
  const weekStart = activeWeek === 'this' ? thisWeekStart : nextWeekStart
  const weekEnd = activeWeek === 'this' ? thisWeekEnd : nextWeekEnd

  const addAssignee = (dayId, username) => {
    if (!username) return
    setDays((prev) => {
      const current = prev[dayId]?.assignees || []
      if (current.includes(username)) return prev
      return {
        ...prev,
        [dayId]: { ...prev[dayId], assignees: [...current, username] },
      }
    })
  }

  const removeAssignee = (dayId, username) => {
    setDays((prev) => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        assignees: (prev[dayId]?.assignees || []).filter((n) => n !== username),
      },
    }))
  }

  const updateNote = (dayId, value) => {
    setDays((prev) => ({
      ...prev,
      [dayId]: { ...prev[dayId], note: value },
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payloadThis = {
        week_start: thisWeekStart,
        note: thisNote.trim(),
        days: Object.fromEntries(
          DAY_IDS.map((dayId) => [
            dayId,
            {
              assignees: thisDays[dayId]?.assignees || [],
              note: (thisDays[dayId]?.note || '').trim(),
            },
          ])
        ),
      }
      const payloadNext = {
        week_start: nextWeekStart,
        note: nextNote.trim(),
        days: Object.fromEntries(
          DAY_IDS.map((dayId) => [
            dayId,
            {
              assignees: nextDays[dayId]?.assignees || [],
              note: (nextDays[dayId]?.note || '').trim(),
            },
          ])
        ),
      }
      await onSave(payloadThis)
      await onSave(payloadNext)
      onClose()
    } catch (err) {
      setError(err.message || 'Không lưu được lịch trực.')
    } finally {
      setSaving(false)
    }
  }

  const memberNames = members.map((m) => m.username).filter(Boolean)

  return (
    <div className="cleaning-settings-overlay" role="dialog" aria-modal="true" aria-label="Cài đặt lịch trực vệ sinh">
      <div className="cleaning-settings">
        <header className="cleaning-settings-head">
          <h2>Cài đặt lịch trực vệ sinh</h2>
          <button type="button" onClick={onClose} aria-label="Đóng">✕</button>
        </header>

        <div className="cleaning-settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeWeek === 'this'}
            className={`cleaning-settings-tab${activeWeek === 'this' ? ' is-active' : ''}`}
            onClick={() => setActiveWeek('this')}
          >
            Tuần này
            <span className="cleaning-settings-tab-range">
              {formatDateVN(thisWeekStart)} – {formatDateVN(thisWeekEnd)}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeWeek === 'next'}
            className={`cleaning-settings-tab${activeWeek === 'next' ? ' is-active' : ''}`}
            onClick={() => setActiveWeek('next')}
          >
            Tuần sau
            <span className="cleaning-settings-tab-range">
              {formatDateVN(nextWeekStart)} – {formatDateVN(nextWeekEnd)}
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="cleaning-settings-body">
          {error ? <p className="cleaning-settings-error">{error}</p> : null}

          {loading ? (
            <p className="cleaning-settings-loading">Đang tải danh sách thành viên...</p>
          ) : (
            <>
              <p className="cleaning-settings-hint">
                Chọn học sinh từ danh sách tài khoản đã đăng ký. Một người có thể trực nhiều ngày. Không giới hạn số lượng mỗi ngày.
              </p>

              <div className="cleaning-settings-days">
                {DAY_IDS.map((dayId) => {
                  const dayAssignees = days[dayId]?.assignees || []
                  const available = memberNames.filter((n) => !dayAssignees.includes(n))
                  return (
                    <div key={dayId} className="cleaning-settings-day">
                      <div className="cleaning-settings-day-title">{dayLabel(dayId)}</div>

                      <div className="cleaning-settings-chips">
                        {dayAssignees.length === 0 ? (
                          <span className="cleaning-settings-empty-chip">Chưa chọn ai</span>
                        ) : (
                          dayAssignees.map((name) => (
                            <span key={name} className="cleaning-settings-chip">
                              {name}
                              <button
                                type="button"
                                className="cleaning-settings-chip-remove"
                                onClick={() => removeAssignee(dayId, name)}
                                aria-label={`Xóa ${name}`}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      <label className="cleaning-settings-select-label">
                        Thêm người trực
                        <select
                          className="cleaning-settings-select"
                          value=""
                          onChange={(e) => {
                            addAssignee(dayId, e.target.value)
                            e.target.value = ''
                          }}
                        >
                          <option value="">— Chọn tài khoản —</option>
                          {available.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                          {available.length === 0 && memberNames.length > 0 ? (
                            <option value="" disabled>Đã chọn hết danh sách</option>
                          ) : null}
                          {memberNames.length === 0 ? (
                            <option value="" disabled>Chưa có thành viên</option>
                          ) : null}
                        </select>
                      </label>

                      <label className="cleaning-settings-note-label">
                        Ghi chú ngày (không bắt buộc)
                        <input
                          type="text"
                          value={days[dayId]?.note || ''}
                          onChange={(e) => updateNote(dayId, e.target.value)}
                          placeholder="Khu vực trực, dụng cụ, ..."
                        />
                      </label>
                    </div>
                  )
                })}
              </div>

              <label className="cleaning-settings-weeknote">
                Ghi chú chung tuần ({formatDateVN(weekStart)} – {formatDateVN(weekEnd)})
                <input
                  type="text"
                  value={weekNote}
                  onChange={(e) => setWeekNote(e.target.value)}
                  placeholder="Không bắt buộc"
                />
              </label>
            </>
          )}

          <div className="cleaning-settings-actions">
            <button type="button" className="cleaning-settings-cancel" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="cleaning-settings-save" disabled={saving || loading}>
              {saving ? 'Đang lưu...' : 'Lưu cả hai tuần'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
