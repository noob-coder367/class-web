import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as presentationService from '../../services/presentationService.js'
import * as classroomService from '../../services/classroomService.js'
import { classTabPath, presentationViewPath } from '../../lib/routes.js'
import SlideStage from './SlideStage.jsx'
import './PresentationEditor.css'

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const blankSlide = () => ({
  id: uid(),
  title: 'Slide mới',
  background: { type: 'solid', value: '#ffffff' },
  transition: { type: 'fade', duration: 0.5, advance: 'click' },
  elements: [],
})

const newElement = (type, extra = {}) => {
  if (type === 'shape') {
    return {
      id: uid(),
      type: 'shape',
      x: 35,
      y: 35,
      width: 30,
      height: 22,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      shape: extra.shape || 'rectangle',
      style: { background: '#0b91a3', border: 'none', borderRadius: extra.shape === 'circle' ? 999 : 12 },
      animation: { entrance: 'fade', duration: 0.5, delay: 0 },
    }
  }
  if (type === 'image') {
    return {
      id: uid(),
      type: 'image',
      x: 20,
      y: 18,
      width: 60,
      height: 50,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      src: extra.src || '',
      style: {},
      animation: { entrance: 'fade', duration: 0.5, delay: 0 },
    }
  }
  return {
    id: uid(),
    type: 'text',
    x: 25,
    y: 38,
    width: 50,
    height: 14,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    text: 'Văn bản mới',
    style: {
      fontFamily: 'Be Vietnam Pro, sans-serif',
      fontSize: 28,
      fontWeight: 700,
      color: '#14324a',
      textAlign: 'center',
    },
    animation: { entrance: 'fade', duration: 0.5, delay: 0 },
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Không đọc được tệp ảnh.'))
    reader.readAsDataURL(file)
  })
}

export default function PresentationEditor({ presentationId = null }) {
  const navigate = useNavigate()
  const [meta, setMeta] = useState({
    title: '',
    description: '',
    visibility: 'public',
    password: '',
    linkedClassRoomId: '',
  })
  const [slides, setSlides] = useState([blankSlide()])
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [future, setFuture] = useState([])
  const [status, setStatus] = useState('Chưa lưu')
  const [error, setError] = useState('')
  const [rooms, setRooms] = useState([])
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const dragRef = useRef(null)
  const saveTimer = useRef(null)
  const loaded = useRef(false)
  const fileRef = useRef(null)
  const current = slides[active]
  const selectedElement = current?.elements.find((item) => item.id === selected)

  useEffect(() => {
    classroomService
      .listClassSpace()
      .then((data) => setRooms(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setRooms([]))
  }, [])

  useEffect(() => {
    if (!presentationId) return
    presentationService
      .getPresentation(presentationId)
      .then(({ item }) => {
        setMeta({
          title: item.title,
          description: item.description,
          visibility: item.visibility,
          password: '',
          linkedClassRoomId: item.linkedClassRoomId || '',
        })
        setSlides(item.slides?.length ? item.slides : [blankSlide()])
        loaded.current = true
        setStatus('Đã tải')
      })
      .catch((err) => setError(err.message))
  }, [presentationId])

  const snapshot = () => ({ slides: JSON.parse(JSON.stringify(slides)), meta: { ...meta } })
  const commit = (nextSlides, nextMeta = meta) => {
    setHistory((prev) => [...prev.slice(-39), snapshot()])
    setFuture([])
    setSlides(nextSlides)
    setMeta(nextMeta)
    setStatus('Có thay đổi')
  }
  const changeSlide = (mutate) =>
    commit(slides.map((slide, index) => (index === active ? mutate(slide) : slide)))
  const addElement = (type, extra) =>
    changeSlide((slide) => ({
      ...slide,
      elements: [...slide.elements, newElement(type, extra)],
    }))
  const updateElement = (patch) =>
    changeSlide((slide) => ({
      ...slide,
      elements: slide.elements.map((item) => (item.id === selected ? { ...item, ...patch } : item)),
    }))
  const removeSelected = () => {
    if (!selected) return
    changeSlide((slide) => ({ ...slide, elements: slide.elements.filter((item) => item.id !== selected) }))
    setSelected(null)
  }
  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setFuture((prev) => [{ slides, meta }, ...prev])
    setSlides(previous.slides)
    setMeta(previous.meta)
    setHistory((prev) => prev.slice(0, -1))
    setStatus('Có thay đổi')
  }
  const redo = () => {
    const next = future[0]
    if (!next) return
    setHistory((prev) => [...prev, { slides, meta }])
    setSlides(next.slides)
    setMeta(next.meta)
    setFuture((prev) => prev.slice(1))
    setStatus('Có thay đổi')
  }

  const save = async (goAfter = false) => {
    if (!meta.title.trim()) {
      setError('Vui lòng nhập tên bài.')
      return
    }
    setStatus('Đang lưu…')
    setError('')
    try {
      const payload = {
        ...meta,
        linkedClassRoomId: meta.linkedClassRoomId || null,
        slides,
      }
      const data = presentationId
        ? await presentationService.updatePresentation(presentationId, payload)
        : await presentationService.createPresentation(payload)
      setStatus('Đã lưu ✓')
      loaded.current = true
      if (!presentationId) navigate(`/tao-bai/${data.item.id}`, { replace: true })
      if (goAfter) navigate(presentationViewPath(data.item.id, true))
    } catch (err) {
      setStatus('Chưa lưu')
      setError(err.message || 'Không lưu được bài.')
    }
  }

  useEffect(() => {
    if (!loaded.current && presentationId) return undefined
    if (status === 'Đã tải' || status === 'Đã lưu ✓' || status === 'Chưa lưu') return undefined
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => save(false), 1100)
    return () => window.clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, meta])

  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  const onPointerDown = (event, element) => {
    event.stopPropagation()
    setSelected(element.id)
    dragRef.current = {
      mode: 'move',
      id: element.id,
      x: event.clientX,
      y: event.clientY,
      start: { x: element.x, y: element.y, width: element.width, height: element.height },
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onResizePointerDown = (event, element) => {
    event.stopPropagation()
    setSelected(element.id)
    dragRef.current = {
      mode: 'resize',
      id: element.id,
      x: event.clientX,
      y: event.clientY,
      start: { x: element.x, y: element.y, width: element.width, height: element.height },
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const rect = event.currentTarget.closest('.presentation-canvas')?.getBoundingClientRect()
    if (!rect) return
    const dx = ((event.clientX - drag.x) / rect.width) * 100
    const dy = ((event.clientY - drag.y) / rect.height) * 100
    setSlides((prev) =>
      prev.map((slide, i) =>
        i === active
          ? {
              ...slide,
              elements: slide.elements.map((item) => {
                if (item.id !== drag.id) return item
                if (drag.mode === 'resize') {
                  return {
                    ...item,
                    width: Math.max(4, Math.min(100, drag.start.width + dx)),
                    height: Math.max(4, Math.min(100, drag.start.height + dy)),
                  }
                }
                return {
                  ...item,
                  x: Math.max(-10, Math.min(96, drag.start.x + dx)),
                  y: Math.max(-10, Math.min(96, drag.start.y + dy)),
                }
              }),
            }
          : slide
      )
    )
    setStatus('Có thay đổi')
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const addSlide = () => {
    commit([...slides, blankSlide()])
    setActive(slides.length)
    setSelected(null)
  }
  const duplicateSlide = () => {
    const copy = JSON.parse(JSON.stringify(current))
    copy.id = uid()
    copy.title = `${current.title} bản sao`
    copy.elements.forEach((item) => {
      item.id = uid()
    })
    commit([...slides.slice(0, active + 1), copy, ...slides.slice(active + 1)])
    setActive(active + 1)
  }
  const deleteSlide = () => {
    if (slides.length <= 1) return
    commit(slides.filter((_, i) => i !== active))
    setActive(Math.max(0, active - 1))
    setSelected(null)
  }
  const moveSlide = (dir) => {
    const next = active + dir
    if (next < 0 || next >= slides.length) return
    const copy = slides.slice()
    const [row] = copy.splice(active, 1)
    copy.splice(next, 0, row)
    commit(copy)
    setActive(next)
  }

  const shiftLayer = (dir) => {
    if (!selectedElement) return
    updateElement({ zIndex: Math.max(0, (selectedElement.zIndex || 1) + dir) })
  }

  const addImage = async (file) => {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const { url } = await presentationService.uploadPresentationImage({
        contentBase64: dataUrl,
        mimeType: file.type,
        filename: file.name,
      })
      addElement('image', { src: url })
    } catch (err) {
      setError(err.message || 'Không tải được ảnh.')
    } finally {
      setUploading(false)
    }
  }

  const linked = !!meta.linkedClassRoomId

  return (
    <div className="presentation-editor">
      <header className="presentation-editor-head">
        <button type="button" onClick={() => navigate(classTabPath('presentation'))}>
          ←
        </button>
        <input
          value={meta.title}
          onChange={(e) => {
            setMeta((prev) => ({ ...prev, title: e.target.value }))
            setStatus('Có thay đổi')
          }}
          placeholder="Tên bài thuyết trình"
        />
        <span className="presentation-save-status">{status}</span>
        <button type="button" onClick={() => setPreview(true)}>
          Xem trước
        </button>
        <button type="button" onClick={() => save(false)}>
          Lưu
        </button>
        <button type="button" onClick={() => save(true)}>
          Trình chiếu
        </button>
      </header>
      {error ? <p className="presentation-error">{error}</p> : null}
      <div className="presentation-editor-grid">
        <aside className="presentation-slides">
          <div className="presentation-panel-title">SLIDE</div>
          <button type="button" onClick={addSlide}>
            + Slide
          </button>
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              className={index === active ? 'is-active' : ''}
              onClick={() => {
                setActive(index)
                setSelected(null)
              }}
            >
              <span>{index + 1}</span>
              {slide.title}
            </button>
          ))}
          <div className="presentation-slide-order">
            <button type="button" onClick={() => moveSlide(-1)} disabled={active === 0}>
              Lên
            </button>
            <button type="button" onClick={() => moveSlide(1)} disabled={active === slides.length - 1}>
              Xuống
            </button>
          </div>
        </aside>
        <main>
          <SlideStage
            slide={current}
            selectedId={selected}
            interactive
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onResizePointerDown={onResizePointerDown}
          />
          <div className="presentation-bottom-toolbar">
            <button type="button" onClick={() => addElement('text')}>
              Text
            </button>
            <button type="button" onClick={() => addElement('shape', { shape: 'rectangle' })}>
              Hình chữ nhật
            </button>
            <button type="button" onClick={() => addElement('shape', { shape: 'circle' })}>
              Hình tròn
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Đang tải ảnh…' : 'Hình ảnh'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                addImage(file)
              }}
            />
            <button type="button" onClick={duplicateSlide}>
              Nhân bản slide
            </button>
            <button type="button" onClick={deleteSlide}>
              Xóa slide
            </button>
            <button type="button" onClick={undo} disabled={!history.length}>
              Undo
            </button>
            <button type="button" onClick={redo} disabled={!future.length}>
              Redo
            </button>
          </div>
        </main>
        <aside className="presentation-properties">
          <div className="presentation-panel-title">THUỘC TÍNH</div>
          <label>
            Tên slide
            <input
              value={current?.title || ''}
              onChange={(e) => changeSlide((slide) => ({ ...slide, title: e.target.value }))}
            />
          </label>
          <label>
            Nền
            <input
              type="color"
              value={current?.background?.type === 'solid' ? current?.background?.value || '#ffffff' : '#ffffff'}
              onChange={(e) =>
                changeSlide((slide) => ({ ...slide, background: { type: 'solid', value: e.target.value } }))
              }
            />
          </label>
          <hr />
          <label>
            Mô tả
            <textarea
              value={meta.description}
              onChange={(e) => {
                setMeta((prev) => ({ ...prev, description: e.target.value }))
                setStatus('Có thay đổi')
              }}
            />
          </label>
          <label>
            Liên kết phòng lớp
            <select
              value={meta.linkedClassRoomId}
              onChange={(e) => {
                setMeta((prev) => ({ ...prev, linkedClassRoomId: e.target.value }))
                setStatus('Có thay đổi')
              }}
            >
              <option value="">Không gắn phòng</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.title} {room.code ? `(${room.code})` : ''} {room.isPublic ? '' : '· riêng tư'}
                </option>
              ))}
            </select>
          </label>
          {linked ? (
            <small>
              Bài gắn phòng lớp sẽ dùng quyền/mật khẩu của phòng đó. Không đặt mật khẩu thứ hai.
            </small>
          ) : (
            <>
              <label>
                Quyền riêng tư
                <select
                  value={meta.visibility}
                  onChange={(e) => {
                    setMeta((prev) => ({ ...prev, visibility: e.target.value }))
                    setStatus('Có thay đổi')
                  }}
                >
                  <option value="public">Công khai với thành viên lớp</option>
                  <option value="private">Riêng tư</option>
                </select>
              </label>
              {meta.visibility === 'private' ? (
                <label>
                  Mật khẩu
                  <input
                    type="password"
                    value={meta.password}
                    onChange={(e) => {
                      setMeta((prev) => ({ ...prev, password: e.target.value }))
                      setStatus('Có thay đổi')
                    }}
                    placeholder="Tối thiểu 4 ký tự"
                  />
                </label>
              ) : null}
            </>
          )}
          {selectedElement ? (
            <div className="presentation-selected-properties">
              <strong>Phần tử đã chọn</strong>
              <button type="button" onClick={removeSelected}>
                Xóa phần tử
              </button>
              {selectedElement.type === 'text' ? (
                <label>
                  Nội dung
                  <textarea
                    value={selectedElement.text}
                    onChange={(e) => updateElement({ text: e.target.value })}
                  />
                </label>
              ) : null}
              {selectedElement.type === 'shape' ? (
                <label>
                  Kiểu hình
                  <select
                    value={selectedElement.shape || 'rectangle'}
                    onChange={(e) =>
                      updateElement({
                        shape: e.target.value,
                        style: {
                          ...selectedElement.style,
                          borderRadius: e.target.value === 'circle' ? 999 : 12,
                        },
                      })
                    }
                  >
                    <option value="rectangle">Chữ nhật</option>
                    <option value="circle">Tròn</option>
                    <option value="triangle">Tam giác</option>
                  </select>
                </label>
              ) : null}
              <label>
                Màu
                <input
                  type="color"
                  value={
                    selectedElement.style?.color || selectedElement.style?.background || '#14324a'
                  }
                  onChange={(e) =>
                    updateElement({
                      style: {
                        ...selectedElement.style,
                        [selectedElement.type === 'shape' ? 'background' : 'color']: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Xoay ({Math.round(selectedElement.rotation || 0)}°)
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={selectedElement.rotation || 0}
                  onChange={(e) => updateElement({ rotation: Number(e.target.value) })}
                />
              </label>
              <label>
                Lớp (z-index)
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={selectedElement.zIndex || 1}
                  onChange={(e) => updateElement({ zIndex: Number(e.target.value) })}
                />
              </label>
              <div className="presentation-layer-btns">
                <button type="button" onClick={() => shiftLayer(1)}>
                  Lên lớp
                </button>
                <button type="button" onClick={() => shiftLayer(-1)}>
                  Xuống lớp
                </button>
              </div>
            </div>
          ) : (
            <small>Chọn một phần tử trên canvas để chỉnh sửa. Kéo góc để đổi kích thước.</small>
          )}
        </aside>
      </div>

      {preview ? (
        <div className="presentation-preview-overlay" onClick={() => setPreview(false)}>
          <div className="presentation-preview-frame" onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>Xem trước</strong>
              <button type="button" onClick={() => setPreview(false)}>
                Đóng
              </button>
            </header>
            <SlideStage slide={current} className="presentation-player-slide" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
