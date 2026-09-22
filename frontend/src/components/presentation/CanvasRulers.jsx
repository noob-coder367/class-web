import { useRef } from 'react'

export default function CanvasRulers({ guides, onChange }) {
  const drag = useRef(null)
  const begin = (event, kind) => { const rect = event.currentTarget.parentElement.getBoundingClientRect(); drag.current = { kind, rect }; event.currentTarget.setPointerCapture?.(event.pointerId) }
  const move = (event) => { if (!drag.current) return; const { kind, rect } = drag.current; const value = Math.max(0, Math.min(100, kind === 'vertical' ? ((event.clientX - rect.left) / rect.width) * 100 : ((event.clientY - rect.top) / rect.height) * 100)); onChange(kind, value) }
  const end = () => { drag.current = null }
  return <><div className="presentation-ruler presentation-ruler-top" onPointerDown={(event) => begin(event, 'vertical')} onPointerMove={move} onPointerUp={end}>{[0, 20, 40, 60, 80, 100].map((tick) => <span key={tick} style={{ left: `${tick}%` }}>{tick}</span>)}</div><div className="presentation-ruler presentation-ruler-left" onPointerDown={(event) => begin(event, 'horizontal')} onPointerMove={move} onPointerUp={end}>{[0, 20, 40, 60, 80, 100].map((tick) => <span key={tick} style={{ top: `${tick}%` }}>{tick}</span>)}</div>{guides.vertical.map((value, index) => <div key={`v-${index}`} className="presentation-draggable-guide presentation-draggable-guide-v" style={{ left: `${value}%` }} onPointerDown={(event) => begin(event, 'vertical')} onPointerMove={move} onPointerUp={end} />)}{guides.horizontal.map((value, index) => <div key={`h-${index}`} className="presentation-draggable-guide presentation-draggable-guide-h" style={{ top: `${value}%` }} onPointerDown={(event) => begin(event, 'horizontal')} onPointerMove={move} onPointerUp={end} />)}</>
}
