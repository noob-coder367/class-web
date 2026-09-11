import { useEffect, useMemo, useState } from 'react'
import './TimetableSettings.css'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export default function TimetableSettings({ data, onClose, onSave }) {
  const [tab, setTab] = useState('subjects')
  const [draft, setDraft] = useState(() => clone(data))
  const [newSubject, setNewSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const options = useMemo(() => {
    const fromGrid = []
    for (const session of [draft.morning, draft.afternoon]) {
      for (const col of Object.values(session.grid || {})) {
        for (const name of col) {
          if (name && !fromGrid.includes(name)) fromGrid.push(name)
        }
      }
    }
    return [...new Set([...(draft.subjects || []), ...fromGrid])]
  }, [draft])

  const setCell = (sessionKey, dayId, periodIndex, value) => {
    setDraft((prev) => {
      const next = clone(prev)
      if (!next[sessionKey].grid[dayId]) next[sessionKey].grid[dayId] = []
      next[sessionKey].grid[dayId][periodIndex] = value
      return next
    })
  }

  const setPeriodTime = (sessionKey, index, field, value) => {
    setDraft((prev) => {
      const next = clone(prev)
      next[sessionKey].periods[index][field] = value
      return next
    })
  }

  const setBreakTime = (sessionKey, index, field, value) => {
    setDraft((prev) => {
      const next = clone(prev)
      next[sessionKey].breaks[index][field] = value
      return next
    })
  }

  const addSubject = () => {
    const name = newSubject.trim()
    if (!name) return
    setDraft((prev) => {
      if ((prev.subjects || []).includes(name)) return prev
      return { ...prev, subjects: [...(prev.subjects || []), name] }
    })
    setNewSubject('')
  }

  const removeSubject = (name) => {
    setDraft((prev) => ({
      ...prev,
      subjects: (prev.subjects || []).filter((item) => item !== name),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave?.(draft)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Không lưu được thời khoá biểu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tkb-settings-overlay" onClick={onClose} role="presentation">
      <div
        className="tkb-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tkb-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tkb-settings-header">
          <div>
            <p>Chỉ admin</p>
            <h2 id="tkb-settings-title">Cài đặt thời khoá biểu</h2>
          </div>
          <button type="button" className="tkb-settings-close" onClick={onClose} aria-label="Đóng">
            <IconClose />
          </button>
        </header>

        <div className="tkb-settings-tabs" role="tablist">
          <button type="button" className={tab === 'subjects' ? 'is-active' : ''} onClick={() => setTab('subjects')}>
            Môn học
          </button>
          <button type="button" className={tab === 'times' ? 'is-active' : ''} onClick={() => setTab('times')}>
            Thời gian
          </button>
        </div>

        <div className="tkb-settings-body">
          {tab === 'subjects' ? (
            <div className="tkb-settings-subjects">
              <div className="tkb-subject-catalog">
                <label>
                  Thêm môn vào danh sách thả xuống
                  <span>
                    <input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addSubject()
                        }
                      }}
                      placeholder="Ví dụ: Sinh học"
                    />
                    <button type="button" onClick={addSubject}>
                      Thêm
                    </button>
                  </span>
                </label>
                <ul>
                  {options.map((name) => (
                    <li key={name}>
                      <span>{name}</span>
                      {(draft.subjects || []).includes(name) ? (
                        <button type="button" onClick={() => removeSubject(name)}>
                          Xoá
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              {['morning', 'afternoon'].map((sessionKey) => {
                const session = draft[sessionKey]
                return (
                  <section key={sessionKey} className="tkb-edit-session">
                    <h3>{session.label}</h3>
                    <div className="tkb-edit-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Tiết</th>
                            {draft.days.map((day) => (
                              <th key={day.id}>{day.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {session.periods.map((period, periodIndex) => (
                            <tr key={period.id}>
                              <th>Tiết {period.id}</th>
                              {draft.days.map((day) => (
                                <td key={day.id}>
                                  <select
                                    value={session.grid?.[day.id]?.[periodIndex] || ''}
                                    onChange={(e) => setCell(sessionKey, day.id, periodIndex, e.target.value)}
                                  >
                                    <option value="">— Trống —</option>
                                    {options.map((name) => (
                                      <option key={name} value={name}>
                                        {name}
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
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="tkb-settings-times">
              {['morning', 'afternoon'].map((sessionKey) => {
                const session = draft[sessionKey]
                return (
                  <section key={sessionKey} className="tkb-time-card">
                    <h3>{session.label}</h3>
                    <label className="tkb-time-row">
                      Học sinh có mặt
                      <input
                        type="time"
                        value={session.arrival}
                        onChange={(e) =>
                          setDraft((prev) => {
                            const next = clone(prev)
                            next[sessionKey].arrival = e.target.value
                            return next
                          })
                        }
                      />
                    </label>
                    {session.flagCeremony ? (
                      <label className="tkb-time-row">
                        Lễ chào cờ
                        <input
                          type="time"
                          value={session.flagCeremony.time}
                          onChange={(e) =>
                            setDraft((prev) => {
                              const next = clone(prev)
                              next[sessionKey].flagCeremony.time = e.target.value
                              return next
                            })
                          }
                        />
                      </label>
                    ) : null}

                    {session.periods.map((period, index) => (
                      <div key={period.id} className="tkb-time-period">
                        <strong>Tiết {period.id}</strong>
                        <input
                          type="time"
                          value={period.start}
                          onChange={(e) => setPeriodTime(sessionKey, index, 'start', e.target.value)}
                        />
                        <span>đến</span>
                        <input
                          type="time"
                          value={period.end}
                          onChange={(e) => setPeriodTime(sessionKey, index, 'end', e.target.value)}
                        />
                      </div>
                    ))}

                    {session.breaks.map((item, index) => (
                      <div key={`break-${index}`} className="tkb-time-period tkb-time-period--break">
                        <strong>{item.label}</strong>
                        <input
                          type="time"
                          value={item.start}
                          onChange={(e) => setBreakTime(sessionKey, index, 'start', e.target.value)}
                        />
                        <span>đến</span>
                        <input
                          type="time"
                          value={item.end}
                          onChange={(e) => setBreakTime(sessionKey, index, 'end', e.target.value)}
                        />
                      </div>
                    ))}
                  </section>
                )
              })}
            </div>
          )}
        </div>

        {error ? <p className="tkb-settings-error">{error}</p> : null}

        <footer className="tkb-settings-footer">
          <button type="button" className="tkb-btn-ghost" onClick={onClose} disabled={saving}>
            Huỷ
          </button>
          <button type="button" className="tkb-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </footer>
      </div>
    </div>
  )
}
