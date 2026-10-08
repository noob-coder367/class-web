import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'

const controls = [['up', ArrowUp], ['left', ArrowLeft], ['down', ArrowDown], ['right', ArrowRight]]

export default function MobileControls({ disabled, onMove }) {
  return <div className="mobile-controls" aria-label="Điều hướng mê cung">{controls.map(([direction, Icon]) => <button key={direction} type="button" aria-label={`Đi ${direction}`} disabled={disabled} onClick={() => onMove(direction)}><Icon size={28} strokeWidth={3} aria-hidden="true" /></button>)}</div>
}
