import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../lib/routes.js'
import './ClassHome.css'

export function TreeIcon({ size = 26 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="5" rx="1.2" />
      <rect x="14" y="10" width="7" height="5" rx="1.2" />
      <rect x="14" y="17" width="7" height="4" rx="1.2" />
      <path d="M6.5 8v10.5a1 1 0 0 0 1 1H14M6.5 12.5H14" />
    </svg>
  )
}

export default function ClassHome() {
  const navigate = useNavigate()
  return (
    <div className="chome">
      <section className="chome-card" aria-label="Hệ thống thành viên lớp 10A4">
        <span className="chome-grip" aria-hidden="true" />
        <span className="chome-icon"><TreeIcon /></span>
        <div className="chome-text">
          <h2>Hệ thống thành viên lớp 10A4</h2>
          <p>Ban cán sự và các thành viên của lớp.</p>
        </div>
        <button type="button" className="chome-btn" onClick={() => navigate(ROUTES.classMembers)}>
          Xem tất cả các thành viên của lớp
        </button>
      </section>
    </div>
  )
}
