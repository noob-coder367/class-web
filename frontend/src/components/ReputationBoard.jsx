import { useMemo } from 'react'

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

function initialOf(name) {
  const text = String(name || '').trim()
  if (!text) return '?'
  const parts = text.split(/\s+/)
  return parts[parts.length - 1].slice(0, 1).toUpperCase()
}

export default function ReputationBoard({
  rows = [],
  startingPoints = 100,
  currentUserId,
  loading,
}) {
  const podium = useMemo(() => {
    const firsts = rows.filter((row) => row.rank === 1).slice(0, 3)
    const seconds = rows.filter((row) => row.rank === 2).slice(0, 2)
    const thirds = rows.filter((row) => row.rank === 3).slice(0, 2)
    return { firsts, seconds, thirds }
  }, [rows])

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

  return (
    <div className="rank-board">
      <header className="rank-hero">
        <p className="rank-kicker">Lớp 10A4 · Điểm uy tín</p>
        <h2>Bảng xếp hạng</h2>
        <p>
          Mỗi bạn bắt đầu với <strong>{startingPoints} điểm</strong>. Vi phạm sẽ trừ đúng số điểm trong nội quy.
          Hạng trùng điểm sẽ cùng Top — có thể có nhiều Top 1, Top 2…
        </p>
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
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const medal = medalFor(row.rank)
              const tone = toneFor(row.score, startingPoints)
              const width = Math.max(6, Math.min(100, Math.round((row.score / maxScore) * 100)))
              const isMe = currentUserId && row.id === currentUserId
              return (
                <tr key={row.id} className={`${isMe ? 'is-me' : ''} is-${tone}`}>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
