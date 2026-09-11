import { useMemo, useState } from 'react'
import { DAYS, DAY_LABELS } from './TimetableBoard.jsx'
import './TimetableSettings.css'

const TONE_OPTIONS = [
  { id: 'act', label: 'Hoạt động' },
  { id: 'lit', label: 'Văn' },
  { id: 'lang', label: 'Ngoại ngữ' },
  { id: 'math', label: 'Toán' },
  { id: 'sci', label: 'Khoa học' },
  { id: 'tech', label: 'Công nghệ' },
  { id: 'hist', label: 'Xã hội' },
  { id: 'pe', label: 'Thể dục' },
]

function slugify(name) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `mon-${Date.now()}`
}

const TONES = ['act', 'tech', 'sci', 'math', 'lit', 'lang', 'hist', 'pe']

export default function TimetableSettings({
  open,
  timetable,
  onChange,
  onClose,
  onSave,
  saving,
}) {
  const [tab, setTab] = useState('subjects')
  const [sessionId, setSessionId] = useState('morning')
  const [newName, setNewName] = useState('')

  const session = useMemo(
    () => (timetable?.sessions || []).find((s) => s.id === sessionId) || timetable?.sessions?.[0],
    [timetable, sessionId]
  )

  if (!open || !timetable) return null

  const patch = (updater) => {
    const next = structuredClone(timetable)
    updater(next)
    onChange(next)
  }

  const addSubject = () => {
    const name = newName.trim()
    if (!name) return
    patch((next) => {
      if (next.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) return
      let id = slugify(name)
      if (next.subjects.some((s) => s.id === id)) id = `${id}-${Date.now()}`
      next.subjects.push({
        id,
        name,
        tone: TONES[next.subjects.length % TONES.length],
      })
    })
    setNewName('')
  }

  return (
    <div className="tkb-settings-overlay" onClick={onClose} role="presentation">
      <aside
        className="tkb-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tkb-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tkb-settings-head">
          <div>
            <h2 id="tkb-settings-title">Cài đặt thời khoá biểu</h2>
            <p>Chọn môn bằng danh sách thả xuống, chỉnh giờ từng tiết.</p>
          </div>
          <button type="button" className="tkb-settings-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </header>

        <div className="tkb-settings-tabs" role="tablist">
          <button
            type="button"
            className={tab === 'subjects' ? 'is-active' : ''}
            onClick={() => setTab('subjects')}
          >
            Môn học
          </button>
          <button
            type="button"
            className={tab === 'times' ? 'is-active' : ''}
            onClick={() => setTab('times')}
          >
            Thời gian
          </button>
        </div>

        <div className="tkb-settings-body">
          {tab === 'subjects' ? (
            <>
              <label className="tkb-field-label">Danh sách môn</label>
              <div className="tkb-add-row">
                <input
                  value={newName}
                  placeholder="Thêm môn mới…"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSubject()
                    }
                  }}
                />
                <button type="button" onClick={addSubject}>
                  Thêm
                </button>
              </div>

              <ul className="tkb-subject-list">
                {timetable.subjects.map((subject) => (
                  <li key={subject.id}>
                    <input
                      value={subject.name}
                      onChange={(e) =>
                        patch((next) => {
                          const found = next.subjects.find((s) => s.id === subject.id)
                          if (found) found.name = e.target.value
                        })
                      }
                    />
                    <select
                      value={subject.tone}
                      onChange={(e) =>
                        patch((next) => {
                          const found = next.subjects.find((s) => s.id === subject.id)
                          if (found) found.tone = e.target.value
                        })
                      }
                      aria-label={`Nhóm màu ${subject.name}`}
                    >
                      {TONE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="tkb-icon-btn"
                      aria-label={`Xóa ${subject.name}`}
                      onClick={() =>
                        patch((next) => {
                          next.subjects = next.subjects.filter((s) => s.id !== subject.id)
                          next.sessions.forEach((s) => {
                            Object.values(s.grid || {}).forEach((row) => {
                              DAYS.forEach((d) => {
                                if (row[d] === subject.id) row[d] = ''
                              })
                            })
                          })
                        })
                      }
                    >
                      Xóa
                    </button>
                  </li>
                ))}
              </ul>

              <div className="tkb-session-switch">
                {(timetable.sessions || []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={s.id === session?.id ? 'is-active' : ''}
                    onClick={() => setSessionId(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="tkb-assign-wrap">
                <table className="tkb-assign">
                  <thead>
                    <tr>
                      <th>Tiết</th>
                      {DAYS.map((d) => (
                        <th key={d}>{DAY_LABELS[d]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(session?.periods || [])
                      .filter((p) => p.kind === 'lesson')
                      .map((period) => (
                        <tr key={period.id}>
                          <td className="tkb-assign-period">
                            <strong>Tiết {period.number}</strong>
                            <span>
                              {period.start}–{period.end}
                            </span>
                          </td>
                          {DAYS.map((day) => (
                            <td key={day}>
                              <select
                                value={session.grid?.[period.id]?.[day] || ''}
                                onChange={(e) =>
                                  patch((next) => {
                                    const s = next.sessions.find((x) => x.id === session.id)
                                    if (!s.grid[period.id]) {
                                      s.grid[period.id] = {
                                        t2: '', t3: '', t4: '', t5: '', t6: '', t7: '',
                                      }
                                    }
                                    s.grid[period.id][day] = e.target.value
                                  })
                                }
                                aria-label={`${session.label} tiết ${period.number} ${DAY_LABELS[day]}`}
                              >
                                <option value="">— Trống —</option>
                                {timetable.subjects.map((sub) => (
                                  <option key={sub.id} value={sub.id}>
                                    {sub.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            (timetable.sessions || []).map((s) => (
              <section key={s.id} className="tkb-time-block">
                <h3>{s.label}</h3>
                {s.extra ? (
                  <label className="tkb-time-row">
                    <span>Lễ chào cờ</span>
                    <input
                      type="time"
                      value={s.extra.time}
                      onChange={(e) =>
                        patch((next) => {
                          const found = next.sessions.find((x) => x.id === s.id)
                          if (found?.extra) found.extra.time = e.target.value
                        })
                      }
                    />
                  </label>
                ) : null}
                <label className="tkb-time-row">
                  <span>Có mặt tại trường</span>
                  <input
                    type="time"
                    value={s.arrival?.time || ''}
                    onChange={(e) =>
                      patch((next) => {
                        const found = next.sessions.find((x) => x.id === s.id)
                        if (found?.arrival) found.arrival.time = e.target.value
                      })
                    }
                  />
                </label>
                {(s.periods || []).map((period) => (
                  <div key={period.id} className="tkb-time-row tkb-time-row--split">
                    <span>
                      {period.kind === 'break'
                        ? period.label || 'Giải lao'
                        : `Tiết ${period.number}`}
                    </span>
                    <div>
                      <input
                        type="time"
                        value={period.start}
                        onChange={(e) =>
                          patch((next) => {
                            const found = next.sessions
                              .find((x) => x.id === s.id)
                              ?.periods.find((p) => p.id === period.id)
                            if (found) found.start = e.target.value
                          })
                        }
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={period.end}
                        onChange={(e) =>
                          patch((next) => {
                            const found = next.sessions
                              .find((x) => x.id === s.id)
                              ?.periods.find((p) => p.id === period.id)
                            if (found) found.end = e.target.value
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>

        <footer className="tkb-settings-foot">
          <button type="button" className="tkb-btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="tkb-btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </footer>
      </aside>
    </div>
  )
}
