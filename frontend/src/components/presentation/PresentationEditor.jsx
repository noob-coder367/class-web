import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as presentationService from '../../services/presentationService.js'
import { presentationListPath, presentationViewPath } from '../../lib/routes.js'
import './PresentationEditor.css'

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
const blankSlide = () => ({ id: uid(), title: 'Slide mới', background: { type: 'solid', value: '#ffffff' }, transition: { type: 'fade', duration: .5, advance: 'click' }, elements: [] })
const newElement = (type) => type === 'shape'
  ? { id: uid(), type, x: 35, y: 35, width: 30, height: 22, rotation: 0, opacity: 1, zIndex: 1, shape: 'rectangle', style: { background: '#0b91a3', border: 'none', borderRadius: 12 } }
  : { id: uid(), type: 'text', x: 25, y: 38, width: 50, height: 14, rotation: 0, opacity: 1, zIndex: 1, text: 'Văn bản mới', style: { fontFamily: 'Be Vietnam Pro, sans-serif', fontSize: 28, fontWeight: 700, color: '#14324a', textAlign: 'center' }, animation: { entrance: 'fade', duration: .5, delay: 0 } }

export default function PresentationEditor({ presentationId = null }) {
  const navigate = useNavigate()
  const [meta, setMeta] = useState({ title: '', description: '', visibility: 'public', password: '', linkedClassRoomId: '' })
  const [slides, setSlides] = useState([blankSlide()])
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [future, setFuture] = useState([])
  const [status, setStatus] = useState('Chưa lưu')
  const [error, setError] = useState('')
  const dragRef = useRef(null)
  const saveTimer = useRef(null)
  const loaded = useRef(false)
  const current = slides[active]
  const selectedElement = current?.elements.find((item) => item.id === selected)

  useEffect(() => {
    if (!presentationId) return
    presentationService.getPresentation(presentationId).then(({ item }) => {
      setMeta({ title: item.title, description: item.description, visibility: item.visibility, password: '', linkedClassRoomId: item.linkedClassRoomId || '' })
      setSlides(item.slides)
      loaded.current = true
      setStatus('Đã tải')
    }).catch((err) => setError(err.message))
  }, [presentationId])

  const snapshot = () => ({ slides: JSON.parse(JSON.stringify(slides)), meta: { ...meta } })
  const commit = (nextSlides, nextMeta = meta) => {
    setHistory((prev) => [...prev.slice(-39), snapshot()])
    setFuture([])
    setSlides(nextSlides)
    setMeta(nextMeta)
    setStatus('Có thay đổi')
  }
  const changeSlide = (mutate) => commit(slides.map((slide, index) => index === active ? mutate(slide) : slide))
  const addElement = (type) => changeSlide((slide) => ({ ...slide, elements: [...slide.elements, newElement(type)] }))
  const updateElement = (patch) => changeSlide((slide) => ({ ...slide, elements: slide.elements.map((item) => item.id === selected ? { ...item, ...patch } : item) }))
  const removeSelected = () => { if (selected) { changeSlide((slide) => ({ ...slide, elements: slide.elements.filter((item) => item.id !== selected) })); setSelected(null) } }
  const undo = () => { const previous = history.at(-1); if (!previous) return; setFuture((prev) => [{ slides, meta }, ...prev]); setSlides(previous.slides); setMeta(previous.meta); setHistory((prev) => prev.slice(0, -1)); setStatus('Có thay đổi') }
  const redo = () => { const next = future[0]; if (!next) return; setHistory((prev) => [...prev, { slides, meta }]); setSlides(next.slides); setMeta(next.meta); setFuture((prev) => prev.slice(1)); setStatus('Có thay đổi') }
  const save = async (goAfter = false) => {
    if (!meta.title.trim()) { setError('Vui lòng nhập tên bài.'); return }
    setStatus('Đang lưu…'); setError('')
    try {
      const data = presentationId ? await presentationService.updatePresentation(presentationId, { ...meta, slides }) : await presentationService.createPresentation({ ...meta, slides })
      setStatus('Đã lưu ✓')
      if (!presentationId) navigate(`/tao-bai/${data.item.id}`, { replace: true })
      if (goAfter) navigate(presentationViewPath(data.item.id, true))
    } catch (err) { setStatus('Chưa lưu'); setError(err.message || 'Không lưu được bài.') }
  }
  useEffect(() => {
    if (!loaded.current && presentationId) return undefined
    if (status === 'Đã tải' || status === 'Đã lưu ✓' || status === 'Chưa lưu') return undefined
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => save(false), 900)
    return () => window.clearTimeout(saveTimer.current)
  }, [slides, meta])
  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  const onPointerDown = (event, element) => {
    event.stopPropagation(); setSelected(element.id)
    dragRef.current = { id: element.id, x: event.clientX, y: event.clientY, start: { x: element.x, y: element.y } }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const rect = event.currentTarget.closest('.presentation-canvas')?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(100, drag.start.x + ((event.clientX - drag.x) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, drag.start.y + ((event.clientY - drag.y) / rect.height) * 100))
    setSlides((prev) => prev.map((slide, i) => i === active ? { ...slide, elements: slide.elements.map((item) => item.id === drag.id ? { ...item, x, y } : item) } : slide))
    setStatus('Có thay đổi')
  }
  const onPointerUp = () => { dragRef.current = null }
  const addSlide = () => { commit([...slides, blankSlide()]); setActive(slides.length) }
  const duplicateSlide = () => { const copy = JSON.parse(JSON.stringify(current)); copy.id = uid(); copy.title = `${current.title} bản sao`; copy.elements.forEach((item) => { item.id = uid() }); commit([...slides.slice(0, active + 1), copy, ...slides.slice(active + 1)]); setActive(active + 1) }
  const deleteSlide = () => { if (slides.length <= 1) return; commit(slides.filter((_, i) => i !== active)); setActive(Math.max(0, active - 1)); setSelected(null) }

  return <div className="presentation-editor">
    <header className="presentation-editor-head"><button type="button" onClick={() => navigate(presentationListPath())}>←</button><input value={meta.title} onChange={(e) => { setMeta((prev) => ({ ...prev, title: e.target.value })); setStatus('Có thay đổi') }} placeholder="Tên bài thuyết trình" /><span className="presentation-save-status">{status}</span><button type="button" onClick={() => save(false)}>Lưu</button><button type="button" onClick={() => save(true)}>Trình chiếu</button></header>
    {error ? <p className="presentation-error">{error}</p> : null}
    <div className="presentation-editor-grid">
      <aside className="presentation-slides"><div className="presentation-panel-title">SLIDE</div><button type="button" onClick={addSlide}>+ Slide</button>{slides.map((slide, index) => <button type="button" key={slide.id} className={index === active ? 'is-active' : ''} onClick={() => { setActive(index); setSelected(null) }}><span>{index + 1}</span>{slide.title}</button>)}</aside>
      <main><div className="presentation-canvas" style={{ background: current?.background?.value || '#fff' }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>{current?.elements.map((element) => <div key={element.id} className={`presentation-element presentation-element--${element.type}${selected === element.id ? ' is-selected' : ''}`} onPointerDown={(e) => onPointerDown(e, element)} style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`, transform: `rotate(${element.rotation || 0}deg)`, opacity: element.opacity, zIndex: element.zIndex, ...element.style }}>{element.type === 'text' ? element.text : null}</div>)}</div><div className="presentation-bottom-toolbar"><button type="button" onClick={() => addElement('text')}>Text</button><button type="button" onClick={() => addElement('shape')}>Shape</button><button type="button" onClick={duplicateSlide}>Nhân bản slide</button><button type="button" onClick={deleteSlide}>Xóa slide</button><button type="button" onClick={undo} disabled={!history.length}>Undo</button><button type="button" onClick={redo} disabled={!future.length}>Redo</button></div></main>
      <aside className="presentation-properties"><div className="presentation-panel-title">THUỘC TÍNH</div><label>Tên slide<input value={current?.title || ''} onChange={(e) => changeSlide((slide) => ({ ...slide, title: e.target.value }))} /></label><label>Nền<input type="color" value={current?.background?.value || '#ffffff'} onChange={(e) => changeSlide((slide) => ({ ...slide, background: { type: 'solid', value: e.target.value } }))} /></label><hr /><label>Mô tả<textarea value={meta.description} onChange={(e) => { setMeta((prev) => ({ ...prev, description: e.target.value })); setStatus('Có thay đổi') }} /></label><label>Quyền riêng tư<select value={meta.visibility} onChange={(e) => { setMeta((prev) => ({ ...prev, visibility: e.target.value })); setStatus('Có thay đổi') }}><option value="public">Công khai</option><option value="private">Riêng tư</option></select></label>{meta.visibility === 'private' ? <label>Mật khẩu<input type="password" value={meta.password} onChange={(e) => setMeta((prev) => ({ ...prev, password: e.target.value }))} placeholder="Tối thiểu 4 ký tự" /></label> : null}<label>Liên kết mã phòng lớp<input value={meta.linkedClassRoomId} onChange={(e) => setMeta((prev) => ({ ...prev, linkedClassRoomId: e.target.value }))} placeholder="Tuỳ chọn" /></label>{selectedElement ? <div className="presentation-selected-properties"><strong>Phần tử đã chọn</strong><button type="button" onClick={removeSelected}>Xóa phần tử</button>{selectedElement.type === 'text' ? <label>Nội dung<textarea value={selectedElement.text} onChange={(e) => updateElement({ text: e.target.value })} /></label> : null}<label>Màu<input type="color" value={selectedElement.style?.color || selectedElement.style?.background || '#14324a'} onChange={(e) => updateElement({ style: { ...selectedElement.style, [selectedElement.type === 'shape' ? 'background' : 'color']: e.target.value } })} /></label></div> : <small>Chọn một phần tử trên canvas để chỉnh sửa.</small>}</aside>
    </div>
  </div>
}
