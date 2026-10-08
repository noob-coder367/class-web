import { useEffect, useState } from 'react'
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react'

const faces = { 1: Dice1, 2: Dice2, 3: Dice3, 4: Dice4, 5: Dice5, 6: Dice6 }

export default function DiceOverlay({ value, onComplete }) {
  const [rolling, setRolling] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => { setRolling(false); onComplete?.() }, 900)
    return () => clearTimeout(timer)
  }, [onComplete])
  return <div className="dice-overlay" role="status" aria-live="polite"><div className="dice-kicker">KẾT QUẢ LƯỢT ĐI</div><div className={`dice-cube ${rolling ? 'dice-cube-rolling' : ''}`}><span>{(() => { const Face = faces[value] || Dice5; return <Face size={84} strokeWidth={2.2} aria-hidden="true" /> })()}</span></div><strong>{rolling ? 'Xúc xắc đang lăn…' : `Bạn được đi ${value} bước`}</strong><span className="dice-hint">Chuẩn bị tiến vào mê cung</span></div>
}
