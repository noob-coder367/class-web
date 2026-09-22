import { useEffect, useMemo, useState } from 'react'

export function PresenterView({ slides, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => { const timer = setInterval(() => setElapsed((value) => value + 1), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { const onKey = (event) => { if (event.key === 'ArrowRight' || event.key === ' ') setIndex((value) => Math.min(slides.length - 1, value + 1)); if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1)); if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [onClose, slides.length])
  const slide = slides[index]
  return <div className="presentation-presenter-view"><div className="presentation-presenter-main"><div className="presentation-presenter-slide" style={{ background: slide?.background?.value || '#fff' }}>{slide?.elements?.filter((item) => item.visible !== false).map((element) => <div key={element.id} className={`presenter-element presenter-${element.type}`} style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`, color: element.style?.color, background: element.type === 'shape' ? element.style?.background : undefined }}>{element.type === 'text' ? element.text : element.type === 'image' && element.src ? <img src={element.src} alt="" /> : null}</div>)}</div><div className="presentation-presenter-controls"><button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</button><span>{index + 1} / {slides.length}</span><button type="button" onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}>Next</button><button type="button" onClick={onClose}>Exit</button></div></div><aside className="presentation-presenter-notes"><strong>Presenter View</strong><span>Elapsed {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span><h4>{slide?.title}</h4><p>{slide?.notes || 'No speaker notes for this slide.'}</p><small>Next: {slides[index + 1]?.title || 'End of presentation'}</small></aside></div>
}

export function ExportPanel({ onExport, onPrint, onClose }) {
  return <div className="presentation-export-overlay"><section className="presentation-export-panel"><header><strong>Export Presentation</strong><button type="button" onClick={onClose}>Close</button></header><p>Export the current slide using the real canvas renderer.</p><div className="presentation-export-actions"><button type="button" onClick={() => onExport('png')}>PNG</button><button type="button" onClick={() => onExport('jpg')}>JPG</button><button type="button" onClick={() => onExport('pdf')}>PDF / Print</button></div><button type="button" onClick={onPrint}>Print Presentation</button></section></div>
}

export function ReviewPanel({ slides, comments = [], onAddComment, onClose }) {
  const [text, setText] = useState('')
  const count = useMemo(() => comments.length, [comments])
  return <div className="presentation-review-overlay"><section className="presentation-review-panel"><header><strong>Review & Comments ({count})</strong><button type="button" onClick={onClose}>Close</button></header><div className="presentation-comment-list">{comments.length ? comments.map((comment) => <article key={comment.id}><strong>Slide {comment.slide + 1}</strong><p>{comment.text}</p></article>) : <small>No comments yet.</small>}</div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={`Comment on slide ${slides.length ? 1 : 0}…`} /><button type="button" disabled={!text.trim()} onClick={() => { onAddComment(text.trim()); setText('') }}>Add Comment</button></section></div>
}
