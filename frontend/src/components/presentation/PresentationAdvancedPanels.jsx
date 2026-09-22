import { useMemo, useState } from 'react'

export const THEMES = [
  { id: 'ocean', name: 'Ocean', primary: '#0b91a3', accent: '#70d7d6', background: '#f4fbfc' },
  { id: 'academic', name: 'Academic', primary: '#14324a', accent: '#d39b45', background: '#fffaf1' },
  { id: 'technology', name: 'Technology', primary: '#6d5dfc', accent: '#27d3c2', background: '#f6f5ff' },
  { id: 'minimal', name: 'Minimal', primary: '#334155', accent: '#94a3b8', background: '#ffffff' },
  { id: 'dark', name: 'Dark', primary: '#d6e6eb', accent: '#70d7d6', background: '#102b3d' },
]

export const LAYOUTS = ['Blank', 'Title Slide', 'Title + Content', 'Two Columns', 'Image + Text', 'Quote', 'Conclusion']

export function SlideSorter({ slides, active, onSelect, onDuplicate, onDelete, onReorder, onClose }) {
  const [dragIndex, setDragIndex] = useState(null)
  return <div className="presentation-sorter-overlay"><div className="presentation-sorter"><header><div><strong>Slide Sorter</strong><span>{slides.length} slides · drag to reorder</span></div><button type="button" onClick={onClose}>Close</button></header><div className="presentation-sorter-grid">{slides.map((slide, index) => <article key={slide.id} className={active === index ? 'is-active' : ''} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) onReorder(dragIndex, index); setDragIndex(null) }}><button type="button" className="presentation-sorter-card" onClick={() => { onSelect(index); onClose() }}><span>{index + 1}</span><div style={{ background: slide.background?.value || '#fff' }}>{slide.elements?.map((element) => <i key={element.id} className={`sorter-element sorter-${element.type}`} style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`, background: element.style?.background || 'transparent', color: element.style?.color || '#14324a' }}>{element.type === 'text' ? element.text?.slice(0, 10) : ''}</i>)}</div><strong>{slide.title || `Slide ${index + 1}`}</strong></button><footer><button type="button" onClick={() => onDuplicate(index)}>Duplicate</button><button type="button" onClick={() => onDelete(index)}>Delete</button></footer></article>)}</div></div></div>
}

export function ThemeGallery({ onApply, onClose }) {
  return <div className="presentation-gallery"><div className="presentation-gallery-head"><strong>Design themes</strong><button type="button" onClick={onClose}>Close</button></div><div className="presentation-theme-grid">{THEMES.map((theme) => <button type="button" key={theme.id} onClick={() => onApply(theme)}><div className="presentation-theme-preview" style={{ background: theme.background }}><span style={{ background: theme.primary }} /><i style={{ background: theme.accent }} /><b style={{ color: theme.primary }}>Aa</b></div><strong>{theme.name}</strong></button>)}</div></div>
}

export function ContextualToolbar({ element, onUpdate, onDelete }) {
  if (!element) return null
  const type = element.type === 'text' ? 'Text Format' : element.type === 'image' ? 'Image Format' : 'Shape Format'
  return <div className="presentation-contextual-toolbar"><strong>{type}</strong>{element.type === 'text' ? <><button type="button" onClick={() => onUpdate({ style: { ...element.style, fontWeight: element.style?.fontWeight >= 800 ? 400 : 800 } })}>Bold</button><button type="button" onClick={() => onUpdate({ style: { ...element.style, fontStyle: element.style?.fontStyle === 'italic' ? 'normal' : 'italic' } })}>Italic</button><button type="button" onClick={() => onUpdate({ style: { ...element.style, textDecoration: element.style?.textDecoration ? 'none' : 'underline' } })}>Underline</button><input type="color" title="Text color" value={element.style?.color || '#14324a'} onChange={(event) => onUpdate({ style: { ...element.style, color: event.target.value } })} /></> : <><label>Opacity <input type="range" min="0" max="1" step=".05" value={element.opacity ?? 1} onChange={(event) => onUpdate({ opacity: Number(event.target.value) })} /></label><button type="button" onClick={onDelete}>Delete</button></>}</div>
}

export function AnimationPane({ slide, onUpdate }) {
  const items = useMemo(() => (slide?.elements || []).filter((element) => element.visible !== false), [slide])
  return <section className="presentation-animation-pane"><div className="presentation-panel-title">ANIMATION PANE</div>{items.length ? items.map((element, index) => <div className="presentation-animation-row" key={element.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{element.text?.slice(0, 18) || element.type}</strong><select value={element.animation?.entrance || 'fade'} onChange={(event) => onUpdate(element.id, { animation: { ...element.animation, entrance: event.target.value } })}><option value="appear">Appear</option><option value="fade">Fade</option><option value="zoom">Zoom</option><option value="fly-in">Fly In</option><option value="bounce">Bounce</option><option value="rotate">Rotate</option><option value="flip">Flip</option></select><select value={element.animation?.start || 'on-click'} onChange={(event) => onUpdate(element.id, { animation: { ...element.animation, start: event.target.value } })}><option value="on-click">On Click</option><option value="with-previous">With Previous</option><option value="after-previous">After Previous</option></select></div>) : <small>Chọn object có animation để quản lý tại đây.</small>}</section>
}
