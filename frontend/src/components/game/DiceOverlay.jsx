import { useEffect, useState } from 'react'

const faces = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' }

export default function DiceOverlay({ value, onComplete }) {
  const [rolling, setRolling] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => { setRolling(false); onComplete?.() }, 900)
    return () => clearTimeout(timer)
  }, [onComplete])
  return <div className="dice-overlay" role="status" aria-live="polite"><div className={`dice-cube ${rolling ? 'dice-cube-rolling' : ''}`}><span>{faces[value] || '⚄'}</span></div><strong>{rolling ? 'Xúc xắc đang lăn…' : `Bạn được đi ${value} bước`}</strong></div>
}
