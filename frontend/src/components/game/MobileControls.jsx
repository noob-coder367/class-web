const controls = [['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']]

export default function MobileControls({ disabled, onMove }) {
  return <div className="mobile-controls" aria-label="Điều hướng mê cung">{controls.map(([direction, icon]) => <button key={direction} type="button" aria-label={`Đi ${direction}`} disabled={disabled} onClick={() => onMove(direction)}>{icon}</button>)}</div>
}
