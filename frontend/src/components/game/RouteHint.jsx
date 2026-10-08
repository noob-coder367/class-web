import { useMemo } from 'react'
import { shortestPath } from '../../lib/maze.js'

const TOKEN_COLORS = { blue: '#4b73dc', green: '#35ad78', purple: '#9670dc', orange: '#ed9a47', pink: '#df6f9f', cyan: '#42bacc', red: '#e16161', gold: '#d1a62c' }

// Chuyển các tâm ô thành đường cong mượt (Catmull-Rom -> Bezier), có chút uốn lượn để không thẳng/vuông góc.
function curvePath(points) {
  if (points.length < 2) return ''
  const wobbled = points.map(([x, y], i) => [x + Math.sin(i * 1.7) * 0.16, y + Math.cos(i * 1.3) * 0.16])
  let d = `M ${wobbled[0][0]} ${wobbled[0][1]}`
  for (let i = 0; i < wobbled.length - 1; i += 1) {
    const p0 = wobbled[i - 1] || wobbled[i]
    const p1 = wobbled[i]
    const p2 = wobbled[i + 1]
    const p3 = wobbled[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 4, p1[1] + (p2[1] - p0[1]) / 4]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 4, p2[1] - (p3[1] - p1[1]) / 4]
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`
  }
  return d
}

// teamName/token/order/total: để hiện nhãn "Bản đồ của đội X (1/4)" khi các đội lần lượt xem bản đồ.
export default function RouteHint({ maze, from, teamName, token, order, total }) {
  const color = TOKEN_COLORS[token] || '#e11d2e'
  const { d, start, end } = useMemo(() => {
    const path = shortestPath(maze, from, maze.exit)
    const points = path.map((cell) => [cell.x + 0.5, cell.y + 0.5])
    return { d: curvePath(points), start: points[0], end: points[points.length - 1] }
  }, [maze, from])
  if (!d) return null
  return <div className="route-hint" role="img" aria-label={`Gợi ý hướng đi tới đích${teamName ? ` của ${teamName}` : ''}`}>
    {teamName && <div className="route-hint-label"><span className="route-hint-dot" style={{ background: color }} /><span>Tới lượt</span><strong>{teamName}</strong>{total > 1 && <small>{order}/{total}</small>}</div>}
    <svg viewBox={`-0.3 -0.3 ${maze.width + 0.6} ${maze.height + 0.6}`}>{[0, 0.4, 0.8].map((delay) => <circle key={delay} className="route-hint-ripple" cx={start[0]} cy={start[1]} r="0.26" fill="none" stroke={color} strokeWidth="0.07" style={{ animationDelay: `${delay}s` }} />)}<path className="route-hint-line" d={d} pathLength="1" fill="none" stroke={color} strokeWidth="0.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx={start[0]} cy={start[1]} r="0.24" fill={color} /><circle className="route-hint-end" cx={end[0]} cy={end[1]} r="0.3" fill="none" stroke={color} strokeWidth="0.1" /></svg>
  </div>
}
