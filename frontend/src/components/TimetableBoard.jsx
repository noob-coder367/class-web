import { useMemo, useState } from 'react'
import TimetableSettings from './TimetableSettings.jsx'
import './TimetableBoard.css'

const SUBJECT_TONE = {
  'Ngữ văn': '#dbeafe',
  Toán: '#fef3c7',
  'CĐ Toán': '#fde68a',
  'Tiếng Anh': '#dcfce7',
  'Tiếng Anh NN': '#bbf7d0',
  'Hóa học': '#fce7f3',
  'CĐ Hóa học': '#fbcfe8',
  'Vật lí': '#e0e7ff',
  'CĐ Vật lí': '#c7d2fe',
  'Sinh học': '#d1fae5',
  'Lịch sử': '#fed7aa',
  'Địa lí': '#fdba74',
  'GD địa phương': '#ffedd5',
  'GDQP và AN': '#fecaca',
  'GD thể': '#bbf7d0',
  'Công nghệ': '#e2e8f0',
  'Tin học': '#cffafe',
  'Tin học Quốc tế': '#a5f3fc',
  STEM: '#ddd6fe',
  'Trí tuệ nhân tạo': '#c7d2fe',
  'HĐTN 1': '#f5d0fe',
  'HĐTN 2': '#f5d0fe',
  'HĐTN 3': '#f5d0fe',
  'Tự học': '#f1f5f9',
  'Câu lạc bộ': '#fde68a',
  'Sinh hoạt lớp': '#e0f2fe',
}

function toneFor(subject) {
  if (!subject) return ''
  return SUBJECT_TONE[subject] || '#eef6fb'
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

/**
 * Khoảng áp dụng: T2 → T7 tuần hiện tại.
 * Chủ nhật: reset sang T2 → T7 tuần sau.
 */
function getApplicationRange(now = new Date()) {
  const d = new Date(now)
  const day = d.getDay() // 0=CN … 6=T7
  const monday = new Date(d)
  monday.setHours(0, 0, 0, 0)
  if (day === 0) {
    monday.setDate(d.getDate() + 1)
  } else {
    monday.setDate(d.getDate() - (day - 1))
  }
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { from: monday, to: saturday }
}

function formatDateVN(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatISOToVN(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function sessionRows(session) {
  const rows = []
  for (const period of session.periods || []) {
    const brk = (session.breaks || []).find((item) => item.after === period.id - 1)
    if (brk) rows.push({ type: 'break', key: `break-${brk.after}`, ...brk })
    rows.push({ type: 'period', key: `p-${period.id}`, ...period })
  }
  return rows
}

function SessionTable({ session, days, variant }) {
  const rows = useMemo(() => sessionRows(session), [session])

  return (
    <section className={`tkb-session tkb-session--${variant}`}>
      <header className="tkb-session-head">
        <div className="tkb-session-title">
          <span className="tkb-session-orb" aria-hidden="true" />
          <h3>{session.label}</h3>
        </div>
        <p>{session.daysNote}</p>
      </header>

      <div className="tkb-meta">
        {session.flagCeremony ? (
          <span>
            <strong>{session.flagCeremony.time}</strong> Lễ chào cờ
            {session.flagCeremony.note ? ` (${session.flagCeremony.note})` : ''}
          </span>
        ) : null}
        <span>
          <strong>{session.arrival}</strong> Học sinh có mặt tại trường
        </span>
      </div>

      <div className="tkb-scroll">
        <table className="tkb-table">
          <thead>
            <tr>
              <th className="tkb-col-period">Tiết / Thời gian</th>
              {days.map((day) => (
                <th key={day.id}>{day.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.type === 'break') {
                return (
                  <tr key={row.key} className="tkb-break">
                    <td>
                      <div className="tkb-period-label">{row.label}</div>
                      <div className="tkb-period-time">
                        {row.start} – {row.end}
                      </div>
                    </td>
                    <td colSpan={days.length} className="tkb-break-span">
                      {row.label}
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={row.key}>
                  <th scope="row">
                    <div className="tkb-period-label">Tiết {row.id}</div>
                    <div className="tkb-period-time">
                      {row.start} – {row.end}
                    </div>
                    {row.note ? <div className="tkb-period-note">{row.note}</div> : null}
                  </th>
                  {days.map((day) => {
                    const subject = session.grid?.[day.id]?.[row.id - 1] || ''
                    return (
                      <td
                        key={day.id}
                        style={subject ? { background: toneFor(subject) } : undefined}
                      >
                        {subject || <span className="tkb-empty-cell">—</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ChangeNoticeBox({ notice, isAdmin, onDismiss, dismissing }) {
  if (!notice?.active) return null

  const from = formatISOToVN(notice.from)
  const to = formatISOToVN(notice.to)
  const title =
    from && to
      ? `Thông báo thay đổi TKB từ ngày ${from} đến ngày ${to}`
      : 'Thông báo thay đổi thời khoá biểu'

  const hasLines = notice.hasChanges && Array.isArray(notice.lines) && notice.lines.length > 0

  return (
    <aside className={`tkb-change-notice${notice.hasChanges ? ' tkb-change-notice--changed' : ''}`}>
      <div className="tkb-change-notice-head">
        <h3>{title}</h3>
        {isAdmin ? (
          <button
            type="button"
            className="tkb-change-dismiss"
            onClick={onDismiss}
            disabled={dismissing}
            title="Ẩn thông báo này"
          >
            {dismissing ? 'Đang xoá…' : 'Xoá thông báo'}
          </button>
        ) : null}
      </div>
      <p className="tkb-change-summary">{notice.summary || 'Chưa có sự thay đổi'}</p>
      {hasLines ? (
        <ul className="tkb-change-lines">
          {notice.lines.slice(0, 20).map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
          {notice.lines.length > 20 ? (
            <li className="tkb-change-more">… và {notice.lines.length - 20} thay đổi khác</li>
          ) : null}
        </ul>
      ) : null}
    </aside>
  )
}

export default function TimetableBoard({ data, isAdmin, onSave, onDismissNotice }) {
  const [openSettings, setOpenSettings] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const applyRange = useMemo(() => getApplicationRange(), [])
  // Recompute on each render is fine; date rarely changes mid-session

  if (!data) return null

  const handleDismiss = async () => {
    if (!onDismissNotice) return
    setDismissing(true)
    try {
      await onDismissNotice()
    } finally {
      setDismissing(false)
    }
  }

  return (
    <div className="tkb-board">
      <div className="tkb-banner">
        <div>
          <p className="tkb-kicker">Thời khoá biểu lớp {data.className}</p>
          <h2>
            Áp dụng từ ngày {formatDateVN(applyRange.from)} đến ngày{' '}
            {formatDateVN(applyRange.to)}
          </h2>
        </div>
      </div>

      <ChangeNoticeBox
        notice={data.changeNotice}
        isAdmin={isAdmin}
        onDismiss={handleDismiss}
        dismissing={dismissing}
      />

      <SessionTable session={data.morning} days={data.days} variant="morning" />
      <SessionTable session={data.afternoon} days={data.days} variant="afternoon" />

      {isAdmin ? (
        <button
          type="button"
          className="tkb-fab"
          onClick={() => setOpenSettings(true)}
          aria-label="Cài đặt thời khoá biểu"
          title="Cài đặt thời khoá biểu"
        >
          <IconGear />
        </button>
      ) : null}

      {openSettings && isAdmin ? (
        <TimetableSettings
          data={data}
          onClose={() => setOpenSettings(false)}
          onSave={onSave}
        />
      ) : null}
    </div>
  )
}
