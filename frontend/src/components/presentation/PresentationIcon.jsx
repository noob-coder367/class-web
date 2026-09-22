const PATHS = {
  undo: 'M9 6 4 11l5 5M4 11h9a6 6 0 0 1 6 6',
  redo: 'm15 6 5 5-5 5m5-5h-9a6 6 0 0 0-6 6',
  save: 'M5 4h12l3 3v13H4V4h12v5H7V4M8 20v-6h8v6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13',
  copy: 'M8 8h11v12H8zM5 16H4V4h12v1',
  text: 'M5 5h14M12 5v14M8 19h8',
  image: 'M4 5h16v14H4zM6 16l4-4 3 3 2-2 3 3M8 9h.01',
  shape: 'M5 5h14v14H5z',
  present: 'M4 5h16v12H4zM8 21h8M12 17v4',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  layers: 'm4 8 8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4',
  lock: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3',
  unlock: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 7-2',
  moon: 'M20 15a8 8 0 1 1-9-11 7 7 0 0 0 9 11',
  search: 'm20 20-4-4M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13',
  chevron: 'm7 10 5 5 5-5',
}

export function PresentationIcon({ name, size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name] || PATHS.shape} /></svg>
}

export function IconAction({ icon, label, shortcut, onClick, disabled = false, active = false, children }) {
  const title = shortcut ? `${label} (${shortcut})` : label
  return <button type="button" className={`presentation-icon-action${active ? ' is-active' : ''}`} onClick={onClick} disabled={disabled} title={title} aria-label={title}><PresentationIcon name={icon} />{children || <span>{label}</span>}</button>
}
