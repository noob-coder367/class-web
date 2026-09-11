import './TimetableBoard.css'

export const DAYS = ['t2', 't3', 't4', 't5', 't6', 't7']
export const DAY_LABELS = {
  t2: 'Thứ 2',
  t3: 'Thứ 3',
  t4: 'Thứ 4',
  t5: 'Thứ 5',
  t6: 'Thứ 6',
  t7: 'Thứ 7',
}

function subjectById(timetable, id) {
  if (!id) return null
  return timetable.subjects.find((s) => s.id === id) || null
}

function formatDateVi(iso) {
  const [y, m, d] = String(iso || '').split('-')
  if (!y || !m || !d) return iso || ''
  return `${d}/${m}/${y}`
}

function minutesOf(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function nowHm(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dayIdFromDate(date) {
  const map = { 0: null, 1: 't2', 2: 't3', 3: 't4', 4: 't5', 5: 't6', 6: 't7' }
  return map[date.getDay()] ?? null
}

export function findLiveSlot(timetable, date = new Date()) {
  const dayId = dayIdFromDate(date)
  if (!dayId) return null
  const hm = nowHm(date)
  const nowMin = minutesOf(hm)
  for (const session of timetable.sessions || []) {
    for (const period of session.periods || []) {
      const a = minutesOf(period.start)
      const b = minutesOf(period.end)
      if (nowMin >= a && nowMin < b) {
        return { sessionId: session.id, periodId: period.id, dayId }
      }
    }
  }
  return null
}

function rowspanMap(session, day) {
  const lessons = (session.periods || []).filter((p) => p.kind === 'lesson')
  const map = {}
  let i = 0
  while (i < lessons.length) {
    const cur = lessons[i]
    const subj = session.grid?.[cur.id]?.[day] || ''
    let span = 1
    if (subj) {
      while (i + span < lessons.length) {
        const next = lessons[i + span]
        const nextSubj = session.grid?.[next.id]?.[day] || ''
        if (nextSubj !== subj) break
        // only merge if no break between these two in the periods array
        const curIdx = session.periods.indexOf(cur)
        const nextIdx = session.periods.indexOf(next)
        if (nextIdx !== curIdx + span) break
        span += 1
      }
    }
    map[cur.id] = span
    for (let k = 1; k < span; k += 1) map[lessons[i + k].id] = 0
    i += span
  }
  return map
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function SessionTable({ session, timetable, live }) {
  return (
    <section className={`tkb-session ${session.id === 'afternoon' ? 'is-afternoon' : ''}`}>
      <header className="tkb-session-head">
        <h2>{session.label}</h2>
        <p>Thứ Hai — Thứ Bảy</p>
      </header>

      <div className="tkb-banners">
        {session.extra ? (
          <div className="tkb-banner">
            <span className="tkb-banner-time">{session.extra.time}</span>
            <span>{session.extra.note}</span>
          </div>
        ) : null}
        <div className="tkb-banner">
          <span className="tkb-banner-time">{session.arrival?.time}</span>
          <span>{session.arrival?.note}</span>
        </div>
      </div>

      <div className="tkb-scroll">
        <table className="tkb-table">
          <thead>
            <tr>
              <th className="tkb-th tkb-th-period">Tiết</th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className={`tkb-th${live?.sessionId === session.id && live.dayId === day ? ' is-today' : ''}`}
                >
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(session.periods || []).map((period) => {
              if (period.kind === 'break') {
                const isLive =
                  live?.sessionId === session.id && live.periodId === period.id
                return (
                  <tr key={period.id} className="tkb-break-row">
                    <td className="tkb-td tkb-td-period">
                      <span className="tkb-period-time">
                        {period.start} – {period.end}
                      </span>
                    </td>
                    <td
                      className={`tkb-td tkb-break-cell${isLive ? ' is-live' : ''}`}
                      colSpan={DAYS.length}
                    >
                      {period.label}
                      {period.note ? <span> ({period.note})</span> : null}
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={period.id}>
                  <td className="tkb-td tkb-td-period">
                    <span className="tkb-period-num">Tiết {period.number}</span>
                    <span className="tkb-period-time">
                      {period.start} – {period.end}
                    </span>
                    {period.note ? (
                      <span className="tkb-period-note">{period.note}</span>
                    ) : null}
                  </td>
                  {DAYS.map((day) => {
                    const spans = rowspanMap(session, day)
                    const span = spans[period.id]
                    if (span === 0) return null
                    const subjectId = session.grid?.[period.id]?.[day] || ''
                    const subject = subjectById(timetable, subjectId)
                    const isLive =
                      live?.sessionId === session.id &&
                      live.dayId === day &&
                      (live.periodId === period.id || span > 1)
                    return (
                      <td
                        key={day}
                        rowSpan={span > 1 ? span : undefined}
                        className={`tkb-td tkb-td-subject tkb-tone-${subject?.tone || 'empty'}${isLive && live.periodId === period.id ? ' is-live' : ''}`}
                      >
                        {subject ? (
                          <span className="tkb-subject">
                            <span className="tkb-subject-icon">
                              <IconBook />
                            </span>
                            {subject.name}
                          </span>
                        ) : (
                          <span className="tkb-empty">—</span>
                        )}
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

export default function TimetableBoard({ timetable, now = new Date() }) {
  if (!timetable?.sessions) return <p className="classroom-empty">Chưa có nội dung</p>

  const live = findLiveSlot(timetable, now)

  return (
    <div className="tkb-board">
      <div className="tkb-meta">
        <div>
          <p className="tkb-kicker">Thời khoá biểu lớp</p>
          <h1 className="tkb-class">{timetable.className || '10A4'}</h1>
        </div>
        <div className="tkb-meta-side">
          <p>{timetable.school}</p>
          {timetable.effectiveFrom ? (
            <p>Có hiệu lực từ {formatDateVi(timetable.effectiveFrom)}</p>
          ) : null}
          {live ? <span className="tkb-live-badge">Đang trong giờ học</span> : null}
        </div>
      </div>

      {timetable.sessions.map((session) => (
        <SessionTable
          key={session.id}
          session={session}
          timetable={timetable}
          live={live}
        />
      ))}
    </div>
  )
}
