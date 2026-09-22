import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import * as classroomService from '../services/classroomService.js'
import './UtilityToolsPanel.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const TOOL_TYPES = [{ value: 'names', label: 'Quay tên' }, { value: 'rewards', label: 'Quay phần thưởng' }]
const SPIN_MODES = [{ value: 'wheel', label: 'Wheel', hint: 'Vòng quay hình tròn' }, { value: 'duck', label: 'Duck Race', hint: 'Đua vịt 5 giây' }]

export function IconWrench() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a4.1 4.1 0 0 0-5.35-5l2.2 2.2-3.18 3.18-2.2-2.2a4.1 4.1 0 0 0 5 5.35l7.6 7.6a2.1 2.1 0 1 0 2.97-2.97l-7.04-7.04Z" /><path d="m14 14 6.5 6.5M5.2 18.8l3.6-3.6M3.5 20.5l1.7-1.7" /></svg> }
function IconPlus() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> }
function cleanName(value) { return String(value || '').replace(/^\s*\d+\s*[-.)]?\s*/, '').replace(/\s+/g, ' ').trim() }
function parseNamesFromLines(lines) {
  const found = []
  for (const raw of lines) {
    const line = String(raw || '').replace(/\s+/g, ' ').trim()
    if (!line || /^STT\b/i.test(line) || /^DANH SÁCH/i.test(line)) continue
    const match = line.match(/^\s*(\d{1,3})\s+(?:10[A-Z0-9]+)\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\b/i)
    if (!match) continue
    const name = cleanName(match[2])
    if (name && !found.some((item) => item.stt === Number(match[1]))) found.push({ stt: Number(match[1]), name })
  }
  return found.sort((a, b) => a.stt - b.stt)
}
async function readPdfNames(file) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const rows = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const content = await (await pdf.getPage(pageNo)).getTextContent(); const byY = new Map()
    for (const item of content.items) { const text = String(item.str || '').trim(); if (!text) continue; const y = Math.round(Number(item.transform?.[5] || 0) * 10) / 10; const row = byY.get(y) || []; row.push({ x: Number(item.transform?.[4] || 0), text }); byY.set(y, row) }
    ;[...byY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, row]) => rows.push(row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ')))
  }
  const names = parseNamesFromLines(rows); if (!names.length) throw new Error('Không tìm thấy dòng tên theo mẫu STT – Lớp – Họ tên – Ngày sinh.')
  return names
}
let audioCtx = null
function playUtilitySound(kind) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return
    audioCtx ||= new Ctx(); if (audioCtx.state === 'suspended') audioCtx.resume()
    const now = audioCtx.currentTime
    const notes = kind === 'win' ? [523, 659, 784, 1046] : [220, 180, 140]
    notes.forEach((freq, i) => { const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = kind === 'win' ? 'sine' : 'triangle'; osc.frequency.value = freq; gain.gain.setValueAtTime(0.0001, now + i * .12); gain.gain.exponentialRampToValueAtTime(.16, now + i * .12 + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + i * .12 + .15); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now + i * .12); osc.stop(now + i * .12 + .18) })
  } catch { /* âm thanh bị trình duyệt chặn thì bỏ qua */ }
}

function ToolTab({ tool, index, active, onSelect }) { return <button type="button" className={`utility-tab${active ? ' is-active' : ''}`} onClick={() => onSelect(index)}>{tool.label || `Tab ${index + 1}`}</button> }

function Celebration({ winner }) { return winner ? <div className="utility-celebration"><span>🎉</span><strong>Chúc mừng!</strong><b>{winner.name || winner}</b></div> : null }

function duckIdOf(item, index, seed = 0) {
  return `${String(item?.name || item)}-${index}-${seed}`
}

function applyDuckTransform(node, duck, field) {
  if (!node || !field) return
  const x = duck.x * field.clientWidth
  const y = duck.y * field.clientHeight
  node.style.transform = `translate3d(${x}px, ${y}px, 0)`
}

function PlayView({ tool, onEdit }) {
  const items = tool.type === 'names' ? tool.names : tool.rewards
  const [remaining, setRemaining] = useState(items)
  const [winner, setWinner] = useState(null)
  const [running, setRunning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [seed, setSeed] = useState(0)
  const [countdown, setCountdown] = useState(null)
  const [raceParticipants, setRaceParticipants] = useState([])
  const [rankings, setRankings] = useState([])
  const raceRef = useRef({ frame: 0, timers: [], cancelled: false, participants: [] })
  const fieldRef = useRef(null)
  const duckNodeRefs = useRef(new Map())
  const pool = tool.removeWinners ? remaining : items
  const ducks = raceParticipants.length
    ? raceParticipants
    : pool.map((item, index) => ({
        id: duckIdOf(item, index, 'idle'),
        item,
        x: 0.02,
        y: 0.18 + ((index + 0.5) / Math.max(pool.length, 1)) * 0.64,
      }))
  const racing = running && countdown === null

  const setDuckNode = (id, node) => {
    if (!id) return
    if (node) duckNodeRefs.current.set(id, node)
    else duckNodeRefs.current.delete(id)
  }

  const paintDucks = (list) => {
    const field = fieldRef.current
    if (!field) return
    for (const duck of list || []) {
      applyDuckTransform(duckNodeRefs.current.get(duck.id), duck, field)
    }
  }

  useEffect(() => () => {
    raceRef.current.cancelled = true
    if (raceRef.current.frame) window.cancelAnimationFrame(raceRef.current.frame)
    raceRef.current.timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  useLayoutEffect(() => {
    const live = raceRef.current.participants
    paintDucks(live?.length ? live : ducks)
  })

  useEffect(() => {
    const field = fieldRef.current
    if (!field || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      const live = raceRef.current.participants
      paintDucks(live?.length ? live : ducks)
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [raceParticipants, running])

  const finishDuckRace = (ordered, first) => {
    raceRef.current.participants = ordered
    setRaceParticipants(ordered)
    setRankings(ordered)
    setWinner(first.item)
    setRunning(false)
    paintDucks(ordered)
    playUtilitySound('win')
    if (tool.removeWinners) setRemaining((prev) => prev.filter((item) => item !== first.item))
    raceRef.current.frame = 0
  }

  const startDuckRace = () => {
    const startedAt = performance.now()
    const participants = pool.map((item, index) => ({
      id: duckIdOf(item, index, startedAt),
      item,
      x: 0.02,
      y: 0.18 + ((index + 0.5) / Math.max(pool.length, 1)) * 0.64,
      vx: 0.075 + Math.random() * 0.035,
      vy: (Math.random() - 0.5) * 0.02,
      baseSpeed: 0.105 + Math.random() * 0.035,
      phase: Math.random() * Math.PI * 2,
      wobble: 0.012 + Math.random() * 0.018,
      finished: false,
      finishTime: null,
    }))
    raceRef.current.cancelled = false
    raceRef.current.participants = participants
    raceRef.current.timers.forEach((timer) => window.clearTimeout(timer))
    raceRef.current.timers = []
    if (raceRef.current.frame) window.cancelAnimationFrame(raceRef.current.frame)
    raceRef.current.frame = 0
    setWinner(null); setRankings([]); setRaceParticipants(participants); setRunning(true); setCountdown(3)
    playUtilitySound('spin')
    let count = 3
    const countdownTimer = window.setInterval(() => {
      if (raceRef.current.cancelled) return window.clearInterval(countdownTimer)
      count -= 1
      setCountdown(count > 0 ? count : 'GO!')
      if (count <= 0) {
        window.clearInterval(countdownTimer)
        const goTimer = window.setTimeout(() => {
          setCountdown(null)
          const raceStart = performance.now()
          let previous = raceStart
          const updateRace = (now) => {
            if (raceRef.current.cancelled) return
            const dt = Math.min((now - previous) / 1000, 0.05)
            previous = now
            const elapsed = (now - raceStart) / 1000
            const next = participants.map((duck) => {
              if (duck.finished) return duck
              const rhythm = Math.sin(elapsed * (1.7 + duck.phase) + duck.phase) * duck.wobble
              const surge = Math.sin(elapsed * 0.9 + duck.phase * 2.1) > 0.82 ? 0.028 : 0
              const targetVx = duck.baseSpeed + rhythm + surge
              const vx = Math.max(0.045, duck.vx + (targetVx - duck.vx) * Math.min(1, dt * 3.5))
              const laneChange = Math.sin(elapsed * (0.9 + duck.phase * 0.15) + duck.phase) * 0.025
              const vy = Math.max(-0.055, Math.min(0.055, duck.vy + (laneChange - duck.vy) * Math.min(1, dt * 2.2)))
              const x = Math.min(1, duck.x + vx * dt)
              const y = Math.max(0.10, Math.min(0.90, duck.y + vy * dt))
              return x >= 1 ? { ...duck, x: 1, y, vx, vy, finished: true, finishTime: now } : { ...duck, x, y, vx, vy }
            })
            participants.splice(0, participants.length, ...next)
            raceRef.current.participants = next
            paintDucks(next)
            const finished = next.filter((duck) => duck.finished).sort((a, b) => a.finishTime - b.finishTime)
            if (finished.length) {
              const ordered = [...finished, ...next.filter((duck) => !duck.finished).sort((a, b) => b.x - a.x)]
              finishDuckRace(ordered, finished[0])
              return
            }
            // Không chọn người thắng theo timeout hoặc theo vị trí gần đích.
            // Race chỉ kết thúc khi một participant thật sự đạt finish line.
            raceRef.current.frame = window.requestAnimationFrame(updateRace)
          }
        }, 500)
        raceRef.current.timers.push(goTimer)
      }
    }, 700)
    raceRef.current.timers.push(countdownTimer)
  }

  const run = () => {
    if (!pool.length || running || countdown !== null) return
    if (tool.mode === 'duck') return startDuckRace()
    const picked = pool[Math.floor(Math.random() * pool.length)]
    const pickedIndex = pool.indexOf(picked)
    setWinner(null); setRunning(true); playUtilitySound('spin')
    const wheelSlice = 360 / pool.length
    setRotation((prev) => prev + 1440 + (360 - (pickedIndex * wheelSlice + wheelSlice / 2)))
    setSeed((value) => value + 1)
    window.setTimeout(() => { setWinner(picked); setRunning(false); if (tool.removeWinners) setRemaining((prev) => prev.filter((item) => item !== picked)); playUtilitySound('win') }, 4200)
  }

  const labels = pool.map((item) => item.name || item)
  const slice = 360 / Math.max(labels.length, 1)

  return (
    <section className="utility-play-view">
      <div className="utility-play-head">
        <div>
          <span className="utility-kicker">{tool.mode === 'wheel' ? 'WHEEL' : 'DUCK RACE'}</span>
          <h3>{tool.type === 'names' ? 'Quay tên' : 'Quay phần thưởng'}</h3>
        </div>
        <button type="button" className="utility-edit-button" onClick={onEdit}>Chỉnh sửa</button>
      </div>
      {tool.mode === 'wheel' ? (
        <div className="utility-wheel-wrap">
          <div className="utility-pointer" />
          <div
            className={`utility-wheel${running ? ' is-running' : ''}`}
            style={{
              transform: `rotate(${rotation}deg)`,
              background: `conic-gradient(${labels.map((_, i) => `hsl(${(i * 47) % 360} 75% 62%) ${i * slice}deg ${(i + 1) * slice}deg`).join(', ')})`,
            }}
          >
            {labels.map((label, i) => (
              <span key={`${label}-${i}`} className="utility-wheel-label" style={{ '--wheel-angle': `${i * slice + slice / 2}deg` }}>{label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="utility-race">
          <div className="utility-race-start">START</div>
          <div className="utility-race-finish">🏁</div>
          <div className="utility-race-field" ref={fieldRef}>
            {ducks.map((duck, i) => {
              const label = duck.item?.name || duck.item
              const rank = rankings.findIndex((row) => row.id === duck.id)
              return (
                <div
                  key={duck.id || `${label}-${i}`}
                  ref={(node) => setDuckNode(duck.id, node)}
                  className={`utility-duck-track${rank === 0 && !running ? ' is-race-winner' : ''}`}
                >
                  <div className={`utility-duck${rank === 0 && !running ? ' is-race-winner' : ''}${racing ? ' is-racing' : ''}`}>
                    <span className="utility-duck-visual">🦆</span>
                    <b>{rank >= 0 ? `${rank + 1}. ` : ''}{label}</b>
                  </div>
                </div>
              )
            })}
            <div className="utility-start-line" />
            <div className="utility-finish-line" />
          </div>
          {countdown !== null ? <div className="utility-countdown">{countdown}</div> : null}
        </div>
      )}
      <div className="utility-play-actions">
        <button type="button" className="utility-primary utility-spin-button" onClick={run} disabled={!pool.length || running || countdown !== null}>
          {running ? (tool.mode === 'duck' ? 'Đang đua…' : 'Đang xoay…') : tool.mode === 'duck' ? 'Bắt đầu đua' : 'Xoay'}
        </button>
        {tool.removeWinners ? <span>Còn lại: {remaining.length}/{items.length}</span> : <span>Có thể trúng lại</span>}
      </div>
      <Celebration winner={winner} />
      {!pool.length ? <p className="utility-empty">Đã hết kết quả để quay.</p> : null}
    </section>
  )
}

function ConfigureView({ tool, onChange, onRemove, onCreate }) {
  const items = tool.type === 'names' ? tool.names : tool.rewards
  return <section className="utility-workspace"><div className="utility-tab-head"><div><label htmlFor={`tool-type-${tool.id}`}>Quay gì?</label><select id={`tool-type-${tool.id}`} value={tool.type} onChange={(e) => onChange({ type: e.target.value })}>{TOOL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><button type="button" className="utility-remove-tab" onClick={onRemove}>Xóa tab</button></div>
    {tool.type === 'names' ? <div className="utility-source-card"><strong>Nguồn tên</strong><p>{tool.names.length ? `Đã lọc ${tool.names.length} tên từ PDF${tool.fileName ? `: ${tool.fileName}` : ''}.` : 'Admin hãy thả PDF ở phần nguồn dữ liệu bên trên.'}</p>{tool.names.length ? <div className="utility-preview">{tool.names.slice(0, 12).map((item) => <span key={item.stt}>{item.stt}. {item.name}</span>)}{tool.names.length > 12 ? <span>… và {tool.names.length - 12} tên khác</span> : null}</div> : null}</div> : <label className="utility-field utility-rewards-field">Danh sách phần thưởng (mỗi dòng một phần thưởng)<textarea value={tool.rewards.join('\n')} onChange={(e) => onChange({ rewards: e.target.value.split(/\r?\n/).map((row) => row.trim()).filter(Boolean) })} placeholder="Ví dụ:\nKẹo\nĐiểm cộng\nMột tràng pháo tay" rows={5} /></label>}
    <div className="utility-field"><span>Quay kiểu nào?</span><div className="utility-mode-grid">{SPIN_MODES.map((mode) => <label key={mode.value} className={`utility-mode${tool.mode === mode.value ? ' is-selected' : ''}`}><input type="radio" name={`mode-${tool.id}`} checked={tool.mode === mode.value} onChange={() => onChange({ mode: mode.value })} /><strong>{mode.label}</strong><small>{mode.hint}</small></label>)}</div></div>
    <div className="utility-result-option"><span>Có kết quả trùng hay xóa các kết quả đã trúng không?</span><label className="utility-check"><input type="checkbox" checked={tool.removeWinners} onChange={(e) => onChange({ removeWinners: e.target.checked })} /> Có, xóa kết quả đã trúng</label><span className="utility-no">{tool.removeWinners ? 'Đang bật loại trùng' : 'Không, có thể trúng lại'}</span></div>
    <button type="button" className="utility-primary utility-create-button" onClick={onCreate} disabled={!items.length}>Tạo vòng quay</button>
  </section>
}

export default function UtilityToolsPanel({ isAdmin = false, isPage = false }) {
  const [enabled, setEnabled] = useState(false); const [open, setOpen] = useState(false); const [pdfState, setPdfState] = useState({ status: 'idle', message: '', names: [], fileName: '' }); const [active, setActive] = useState(0); const inputRef = useRef(null)
  const [dock, setDock] = useState({ side: 'right', y: 24 }); const dragRef = useRef(null)
  const [storedRoster, setStoredRoster] = useState({ names: [], fileName: '', updatedAt: '' })
  const makeTool = (id, names = []) => ({ id, label: `Tiện ích ${id}`, type: 'names', mode: 'wheel', names, rewards: [], removeWinners: true, created: false })
  const [tools, setTools] = useState([makeTool(1)]); const activeTool = tools[active]
  useEffect(() => {
    let cancelled = false
    classroomService.getUtilityRoster().then((data) => {
      if (cancelled || !data?.roster?.names?.length) return
      const roster = data.roster
      setStoredRoster(roster)
      setPdfState({ status: 'ready', message: `Đã tải ${roster.names.length} tên đã lưu từ Supabase.`, names: roster.names, fileName: roster.fileName })
      setTools((prev) => prev.map((tool) => ({ ...tool, names: roster.names, fileName: roster.fileName })))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  const loadPdf = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfState((prev) => ({ ...prev, status: 'error', message: 'Vui lòng chọn file PDF.' }))
      return
    }
    setPdfState({ status: 'loading', message: 'Đang đọc và lưu danh sách PDF…', names: [], fileName: file.name })
    try {
      const names = await readPdfNames(file)
      const data = await classroomService.saveUtilityRoster({ names, fileName: file.name })
      const roster = data?.roster || { names, fileName: file.name }
      setStoredRoster(roster)
      setPdfState({ status: 'ready', message: `Đã lưu ${names.length} tên vào Supabase.`, names, fileName: file.name })
      setTools((prev) => prev.map((tool) => ({ ...tool, names, fileName: file.name })))
    } catch (error) {
      setPdfState((prev) => ({ ...prev, status: 'error', message: error.message || 'Không đọc hoặc lưu được PDF.' }))
    }
  }
  const updateActive = (patch) => setTools((prev) => prev.map((tool, index) => index === active ? { ...tool, ...patch } : tool))
  const addTab = () => { setTools((prev) => [...prev, makeTool(prev.length + 1, pdfState.names)]); setActive(tools.length) }
  const removeTab = () => { if (tools.length === 1) return; setTools((prev) => prev.filter((_, index) => index !== active)); setActive((prev) => Math.max(0, prev - 1)) }
  const toggle = (value) => { setEnabled(value); setOpen(value); if (!value) { setTools([makeTool(1)]); setPdfState({ status: storedRoster.names.length ? 'ready' : 'idle', message: storedRoster.names.length ? `Đã lưu ${storedRoster.names.length} tên.` : '', names: storedRoster.names, fileName: storedRoster.fileName }); setActive(0) } else if (storedRoster.names.length) { setTools([makeTool(1, storedRoster.names)]) } }
  const onPointerDown = (event) => { if (event.button !== undefined && event.button !== 0) return; event.currentTarget.setPointerCapture?.(event.pointerId); dragRef.current = { startX: event.clientX, startY: event.clientY, moved: false, y: dock.y } }
  const onPointerMove = (event) => { if (!dragRef.current) return; const dy = event.clientY - dragRef.current.startY; if (Math.abs(event.clientX - dragRef.current.startX) + Math.abs(dy) > 6) dragRef.current.moved = true; setDock((prev) => ({ ...prev, y: Math.max(12, Math.min(window.innerHeight - 72, dragRef.current.y + dy)) })) }
  const onPointerUp = (event) => { if (!dragRef.current) return; const wasMoved = dragRef.current.moved; dragRef.current = null; if (wasMoved) { setDock((prev) => ({ side: event.clientX < window.innerWidth / 2 ? 'left' : 'right', y: prev.y })); return } setDock((prev) => ({ side: 'right', y: prev.y < window.innerHeight / 2 ? 18 : Math.max(18, window.innerHeight - 78) })); setOpen((prev) => !prev) }
  const floatingStyle = dock.side === 'right' ? { right: 16, top: dock.y } : { left: 16, top: dock.y }
  const body = <>{isAdmin ? <div className="utility-pdf-card"><div><strong>Nguồn tên — đã lưu trên Supabase</strong><p>{pdfState.message || 'Chưa có PDF. Hãy thả file danh sách lớp vào đây.'}</p></div><div className="utility-pdf-actions"><input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => loadPdf(e.target.files?.[0])} />{pdfState.status === 'ready' ? <><span className="utility-pdf-file">{pdfState.fileName}</span><button type="button" className="utility-pdf-change" onClick={() => inputRef.current?.click()}>Đổi PDF</button></> : <div className="utility-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadPdf(e.dataTransfer.files?.[0]) }} onClick={() => inputRef.current?.click()}><span>Thả PDF vào đây hoặc bấm để chọn</span></div>}</div>{pdfState.status === 'ready' ? <span className="utility-pdf-ok">✓ {pdfState.names.length} tên đã sẵn sàng</span> : null}</div> : null}{!enabled ? <div className="utility-off-note">Bật ON để hiện mini chat Tiện ích phụ ở góc màn hình.</div> : null}</>
  return <div className={`utility-tools-panel${isPage ? ' utility-tools-panel--page' : ' utility-tools-panel--floating'}`}><header className="utility-title-row"><div><span className="utility-kicker">CLASSROOM TOOLS</span><h2>Các công cụ</h2><p>Tiện ích quay ngẫu nhiên cho hoạt động trong lớp.</p></div><label className="utility-switch-label"><span>{enabled ? 'ON' : 'OFF'}</span><input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} /><i aria-hidden="true" /></label></header><div className="utility-first-card"><div><h3>Tiện ích quay ngẫu nhiên</h3><p>Chọn yêu cầu, tạo vòng quay rồi mới bắt đầu chơi.</p></div><button type="button" className="utility-open-button" onClick={() => setOpen(true)} disabled={!enabled}>Mở công cụ</button></div>{body}{enabled ? <button type="button" className="utility-mini-chat" style={floatingStyle} aria-label="Mở Tiện ích phụ" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}><IconWrench /><span>Tiện ích</span></button> : null}{enabled && open ? <div className="utility-window" role="dialog" aria-label="Tiện ích quay ngẫu nhiên"><div className="utility-window-head"><strong><IconWrench /> Tiện ích phụ</strong><button type="button" onClick={() => setOpen(false)} aria-label="Đóng">×</button></div><div className="utility-tabs">{tools.map((tool, index) => <ToolTab key={tool.id} tool={tool} index={index} active={index === active} onSelect={setActive} />)}<button type="button" className="utility-add-tab" onClick={addTab} aria-label="Thêm tab"><IconPlus /></button></div>{activeTool ? (activeTool.created ? <PlayView tool={activeTool} onEdit={() => updateActive({ created: false })} /> : <ConfigureView tool={activeTool} onChange={updateActive} onRemove={removeTab} onCreate={() => updateActive({ created: true })} />) : null}</div> : null}</div>
}
