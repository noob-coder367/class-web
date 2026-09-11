import { useMemo, useState } from 'react'
import RulesSettings from './RulesSettings.jsx'
import './RulesBoard.css'

const PERIOD_OPTIONS = [
  '',
  'Sáng T1',
  'Sáng T2',
  'Sáng T3',
  'Sáng T4',
  'Sáng T5',
  'Chiều T1',
  'Chiều T2',
  'Chiều T3',
  'Chiều T4',
]

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function offenseOptions(rules) {
  const names = []
  for (const section of rules?.sections || []) {
    for (const line of section.items || []) {
      const name = String(line).split(/\s*:\s*/)[0].trim()
      if (name && !names.includes(name)) names.push(name)
    }
  }
  return names
}

export default function RulesBoard({
  rules,
  violations,
  isAdmin,
  onSaveRules,
  onAddViolation,
  onDeleteViolation,
}) {
  const [pane, setPane] = useState('rules')
  const [openSettings, setOpenSettings] = useState(false)
  const [form, setForm] = useState({
    date: todayISO(),
    period: '',
    name: '',
    offense: '',
    warning: '',
  })
  const [customOffense, setCustomOffense] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const options = useMemo(() => offenseOptions(rules), [rules])

  const handleAdd = async (e) => {
    e.preventDefault()
    const offense = form.offense === '__other__' ? customOffense.trim() : form.offense.trim()
    if (!form.name.trim() || !offense) {
      setError('Cần nhập tên và lỗi vi phạm.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onAddViolation?.({
        date: form.date || todayISO(),
        period: form.period,
        name: form.name.trim(),
        offense,
        warning: form.warning.trim(),
      })
      setForm({ date: todayISO(), period: '', name: '', offense: '', warning: '' })
      setCustomOffense('')
    } catch (err) {
      setError(err.message || 'Không thêm được vi phạm.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xoá hàng vi phạm này?')) return
    try {
      await onDeleteViolation?.(id)
    } catch (err) {
      setError(err.message || 'Không xoá được vi phạm.')
    }
  }

  return (
    <div className="rules-board">
      <div className="rules-switch" role="tablist" aria-label="Nội quy lớp">
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'rules'}
          className={pane === 'rules' ? 'is-active' : ''}
          onClick={() => setPane('rules')}
        >
          Nội quy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'violations'}
          className={pane === 'violations' ? 'is-active' : ''}
          onClick={() => setPane('violations')}
        >
          Danh sách vi phạm
        </button>
      </div>

      {pane === 'rules' ? (
        <article className="rules-doc">
          <h2 className="rules-doc-title">{rules?.title || 'NỘI QUY LỚP'}</h2>
          {(rules?.sections || []).map((section) => (
            <section key={section.id} className="rules-doc-section">
              <h3>{section.title}</h3>
              <ul>
                {(section.items || []).map((item, index) => (
                  <li key={`${section.id}-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
          {rules?.notice?.body ? (
            <p className="rules-doc-notice">
              <strong>{rules.notice.title || 'LƯU Ý'} :</strong> {rules.notice.body}
            </p>
          ) : null}
        </article>
      ) : (
        <div className="rules-violations">
          {isAdmin ? (
            <form className="rules-add-form" onSubmit={handleAdd}>
              <h3>Thêm vi phạm</h3>
              <div className="rules-add-grid">
                <label>
                  Ngày
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Tiết (tuỳ chọn)
                  <select
                    value={form.period}
                    onChange={(e) => setForm((prev) => ({ ...prev, period: e.target.value }))}
                  >
                    {PERIOD_OPTIONS.map((item) => (
                      <option key={item || 'none'} value={item}>
                        {item || '—'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tên
                  <input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Họ và tên"
                    required
                  />
                </label>
                <label>
                  Lỗi vi phạm
                  <select
                    value={form.offense}
                    onChange={(e) => setForm((prev) => ({ ...prev, offense: e.target.value }))}
                    required
                  >
                    <option value="">Chọn lỗi</option>
                    {options.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                    <option value="__other__">Khác...</option>
                  </select>
                </label>
                {form.offense === '__other__' ? (
                  <label className="rules-add-span">
                    Lỗi khác
                    <input
                      value={customOffense}
                      onChange={(e) => setCustomOffense(e.target.value)}
                      placeholder="Nhập lỗi vi phạm"
                    />
                  </label>
                ) : null}
                <label className="rules-add-span">
                  Nội dung cảnh báo
                  <input
                    value={form.warning}
                    onChange={(e) => setForm((prev) => ({ ...prev, warning: e.target.value }))}
                    placeholder="Ví dụ: Nhắc nhở lần 1 / đánh dấu 3 lần"
                  />
                </label>
              </div>
              {error && pane === 'violations' ? <p className="rules-form-error">{error}</p> : null}
              <button type="submit" disabled={saving}>
                {saving ? 'Đang thêm...' : 'Thêm hàng vi phạm'}
              </button>
            </form>
          ) : null}

          {!violations?.length ? (
            <p className="rules-empty">Chưa có vi phạm</p>
          ) : (
            <div className="rules-table-wrap">
              <table className="rules-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Tiết</th>
                    <th>Tên</th>
                    <th>Lỗi vi phạm</th>
                    <th>Nội dung cảnh báo</th>
                    {isAdmin ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {violations.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.period || '—'}</td>
                      <td>{row.name}</td>
                      <td>{row.offense}</td>
                      <td>{row.warning || '—'}</td>
                      {isAdmin ? (
                        <td>
                          <button
                            type="button"
                            className="rules-row-delete"
                            onClick={() => handleDelete(row.id)}
                          >
                            Xoá
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isAdmin && pane === 'rules' ? (
        <button
          type="button"
          className="rules-fab"
          onClick={() => setOpenSettings(true)}
          aria-label="Cài đặt nội quy"
          title="Cài đặt nội quy"
        >
          <IconGear />
        </button>
      ) : null}

      {openSettings && isAdmin && rules ? (
        <RulesSettings
          data={rules}
          onClose={() => setOpenSettings(false)}
          onSave={onSaveRules}
        />
      ) : null}
    </div>
  )
}
