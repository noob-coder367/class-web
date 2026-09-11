import { Fragment, useMemo, useState } from 'react'

function medalFor(rank) {
  if (rank === 1) return { emoji: '🥇', label: 'Vàng' }
  if (rank === 2) return { emoji: '🥈', label: 'Bạc' }
  if (rank === 3) return { emoji: '🥉', label: 'Đồng' }
  return null
}

function toneFor(score, starting) {
  const ratio = starting > 0 ? score / starting : 0
  if (ratio >= 0.85) return 'high'
  if (ratio >= 0.6) return 'mid'
  return 'low'
}

/** Phân loại tình trạng theo thang điểm còn lại */
export function statusFor(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return { label: '—', level: 'unknown' }
  if (s >= 86) return { label: 'Tốt', level: 'good' }
  if (s >= 65) return { label: 'Cảnh báo cấp I', level: 'warn1' }
  if (s >= 31) return { label: 'Cảnh báo cấp II', level: 'warn2' }
  return { label: 'Cảnh báo cấp III', level: 'warn3' }
}

function initialOf(name) {
  const text = String(name || '').trim()
  if (!text) return '?'
  const parts = text.split(/\s+/)
  return parts[parts.length - 1].slice(0, 1).toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function IconChevron({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={open ? 'is-open' : ''}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export default function ReputationBoard({
  rows = [],
  startingPoints = 100,
  currentUserId,
  loading,
  violations = [],
}) {
  const [expandedId, setExpandedId] = useState(null)

  const podium = useMemo(() => {
    const firsts = rows.filter((row) => row.rank === 1).slice(0, 3)
    const seconds = rows.filter((row) => row.rank === 2).slice(0, 2)
    const thirds = rows.filter((row) => row.rank === 3).slice(0, 2)
    return { firsts, seconds, thirds }
  }, [rows])

  const violationsByUser = useMemo(() => {
    const map = new Map()
    for (const v of violations || []) {
      const key = v.userId || v.name
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(v)
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.date === b.date) return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        return String(b.date).localeCompare(String(a.date))
      })
    }
    return map
  }, [violations])

  if (loading) {
    return (
      <div className="rank-board">
        <p className="rules-empty">Đang tải bảng xếp hạng...</p>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="rank-board">
        <header className="rank-hero">
          <p className="rank-kicker">Lớp 10A4</p>
          <h2>Bảng xếp hạng uy tín</h2>
          <p>Chưa có thành viên 10A4 nào. Khi admin duyệt tài khoản vào lớp, tên sẽ xuất hiện tại đây.</p>
        </header>
      </div>
    )
  }

  const maxScore = Math.max(startingPoints, ...rows.map((row) => row.score), 1)

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="rank-board">
      <header className="rank-hero">
        <p className="rank-kicker">Lớp 10A4 · Điểm uy tín</p>
        <h2>Bảng xếp hạng</h2>
        <p>
          Mỗi bạn bắt đầu với <strong>{startingPoints} điểm</strong>. Vi phạm sẽ trừ đúng số điểm trong nội quy.
          Hạng trùng điểm sẽ cùng Top — có thể có nhiều Top 1, Top 2…
        </p>
        <div className="rank-status-legend" aria-label="Thang tình trạng">
          <span className="rank-status-chip is-good">100–86: Tốt</span>
          <span className="rank-status-chip is-warn1">85–65: Cảnh báo cấp I</span>
          <span className="rank-status-chip is-warn2">64–31: Cảnh báo cấp II</span>
          <span className="rank-status-chip is-warn3">≤30: Cảnh báo cấp III</span>
        </div>
      </header>

      {podium.firsts.length ? (
        <div className="rank-podium" aria-label="Top 3">
          <div className="rank-podium-col is-silver">
            {podium.seconds[0] ? (
              <>
                <span className="rank-podium-medal">🥈</span>
                <strong>{podium.seconds[0].username}</strong>
                <em>{podium.seconds[0].score} đ</em>
                <span>Top {podium.seconds[0].rank}</span>
              </>
            ) : (
              <span className="rank-podium-empty">Chưa có Top 2</span>
            )}
          </div>
          <div className="rank-podium-col is-gold">
            <span className="rank-podium-medal">🥇</span>
            <strong>{podium.firsts[0].username}</strong>
            <em>{podium.firsts[0].score} đ</em>
            <span>
              Top 1{podium.firsts.length > 1 ? ` · +${podium.firsts.length - 1} đồng hạng` : ''}
            </span>
          </div>
          <div className="rank-podium-col is-bronze">
            {podium.thirds[0] ? (
              <>
                <span className="rank-podium-medal">🥉</span>
                <strong>{podium.thirds[0].username}</strong>
                <em>{podium.thirds[0].score} đ</em>
                <span>Top {podium.thirds[0].rank}</span>
              </>
            ) : (
              <span className="rank-podium-empty">Chưa có Top 3</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="rank-table-wrap">
        <table className="rank-table">
          <thead>
            <tr>
              <th className="rank-col-top">Top</th>
              <th>Họ và tên</th>
              <th className="rank-col-score">Điểm uy tín</th>
              <th className="rank-col-status">Tình trạng</th>
              <th className="rank-col-expand" aria-label="Chi tiết" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const medal = medalFor(row.rank)
              const tone = toneFor(row.score, startingPoints)
              const status = statusFor(row.score)
              const width = Math.max(6, Math.min(100, Math.round((row.score / maxScore) * 100)))
              const isMe = currentUserId && row.id === currentUserId
              const isOpen = expandedId === row.id
              const mine =
                violationsByUser.get(row.id) ||
                violationsByUser.get(row.username) ||
                []

              return (
                <Fragment key={row.id}>
                  <tr className={`${isMe ? 'is-me' : ''} is-${tone} ${isOpen ? 'is-expanded' : ''}`}>
                    <td className="rank-col-top">
                      <span className={`rank-badge is-top-${Math.min(row.rank, 4)}`}>
                        {medal ? <span aria-hidden="true">{medal.emoji}</span> : null}
                        {row.rank}
                      </span>
                    </td>
                    <td>
                      <div className="rank-name">
                        <span className="rank-avatar" aria-hidden="true">
                          {initialOf(row.username)}
                        </span>
                        <div>
                          <strong>
                            {row.username}
                            {isMe ? <em className="rank-you">Bạn</em> : null}
                          </strong>
                          <small>
                            {row.role === 'admin' ? 'Admin · ' : ''}
                            {row.violations
                              ? `${row.violations} vi phạm · −${row.deducted}đ`
                              : 'Chưa có vi phạm'}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="rank-col-score">
                      <div className="rank-score">
                        <b>{row.score}</b>
                        <span className="rank-bar" aria-hidden="true">
                          <i style={{ width: `${width}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="rank-col-status">
                      <span className={`rank-status-chip is-${status.level}`}>{status.label}</span>
                    </td>
                    <td className="rank-col-expand">
                      <button
                        type="button"
                        className={`rank-expand-btn ${isOpen ? 'is-open' : ''}`}
                        onClick={() => toggleExpand(row.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Ẩn chi tiết vi phạm' : 'Xem chi tiết vi phạm'}
                        title={isOpen ? 'Ẩn chi tiết' : 'Xem chi tiết vi phạm'}
                      >
                        <IconChevron open={isOpen} />
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="rank-detail-row">
                      <td colSpan={5}>
                        <div className="rank-detail-panel">
                          <h4>Chi tiết vi phạm — {row.username}</h4>
                          {!mine.length ? (
                            <p className="rank-detail-empty">Chưa có vi phạm nào được ghi nhận.</p>
                          ) : (
                            <ul className="rank-detail-list">
                              {mine.map((v) => (
                                <li key={v.id}>
                                  <span className="rank-detail-date">{formatDate(v.date)}</span>
                                  {v.period ? <span className="rank-detail-period">{v.period}</span> : null}
                                  <span className="rank-detail-offense">{v.offense}</span>
                                  <span className="rank-detail-points">−{Number(v.points) || 0}đ</span>
                                  {v.warning ? (
                                    <span className="rank-detail-warning">{v.warning}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
