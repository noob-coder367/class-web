import { useState } from 'react'
import { DAY_IDS, dayLabel } from '../lib/cleaningDuty.js'
import './CleaningDutySettings.css'

function parseAssignees(text) {
  return String(text || '')
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
}

export default function CleaningDutySettings({ weekStart, schedule, onClose, onSave }) {
  const [days, setDays] = useState(() => {
    const initial = {}
    for (const dayId of DAY_IDS) {
      const src = schedule?.days?.[dayId]
      initial[dayId] = {
        assigneesText: (src?.assignees || []).join(', '),
        note: src?.note || '',
      }
    }
    return initial
  })
  const [weekNote, setWeekNote] = useState(schedule?.note || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateDay = (dayId, field, value) => {
    setDays((prev) => ({ ...prev, [dayId]: { ...prev[dayId], [field]: value } }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        week_start: weekStart,
        note: weekNote.trim(),
        days: Object.fromEntries(
          DAY_IDS.map((dayId) => [
            dayId,
            {
              assignees: parseAssignees(days[dayId].assigneesText),
              note: days[dayId].note.trim(),
            },
          ])
        ),
      }
      await onSave(payload)
      onClose()
    } catch (err) {
      setError(err.message || 'Không lưu được lịch trực.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cleaning-settings-overlay" role="dialog" aria-modal="true" aria-label="Sửa phân công trực vệ sinh">
      <div className="cleaning-settings">
        <header className="cleaning-settings-head">
          <h2>Phân công trực vệ sinh</h2>
          <button type="button" onClick={onClose} aria-label="Đóng">✕</button>
        </header>

        <form onSubmit={handleSubmit} className="cleaning-settings-body">
          {error ? <p className="cleaning-settings-error">{error}</p> : null}

          <div className="cleaning-settings-days">
            {DAY_IDS.map((dayId) => (
              <div key={dayId} className="cleaning-settings-day">
                <label>
                  {dayLabel(dayId)} — Học sinh trực (cách nhau bằng dấu phẩy)
                  <textarea
                    rows={2}
                    value={days[dayId].assigneesText}
                    onChange={(e) => updateDay(dayId, 'assigneesText', e.target.value)}
                    placeholder="Nguyễn Văn A, Trần Thị B, ..."
                  />
                </label>
                <label>
                  Ghi chú (khu vực trực, dụng cụ, ...)
                  <input
                    type="text"
                    value={days[dayId].note}
                    onChange={(e) => updateDay(dayId, 'note', e.target.value)}
                    placeholder="Không bắt buộc"
                  />
                </label>
              </div>
            ))}
          </div>

          <label className="cleaning-settings-weeknote">
            Ghi chú chung cho cả tuần
            <input
              type="text"
              value={weekNote}
              onChange={(e) => setWeekNote(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </label>

          <div className="cleaning-settings-actions">
            <button type="button" className="cleaning-settings-cancel" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="cleaning-settings-save" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu lịch trực'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
