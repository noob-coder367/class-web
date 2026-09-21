import { useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import './UtilityToolsPanel.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const TOOL_TYPES = [
  { value: 'names', label: 'Quay tên' },
  { value: 'rewards', label: 'Quay phần thưởng' },
]
const SPIN_MODES = [
  { value: 'wheel', label: 'Wheel', hint: 'Vòng quay may mắn' },
  { value: 'duck', label: 'Duck Race', hint: 'Đua vịt về đích' },
]

function IconWrench() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a4.1 4.1 0 0 0-5.35-5l2.2 2.2-3.18 3.18-2.2-2.2a4.1 4.1 0 0 0 5 5.35l7.6 7.6a2.1 2.1 0 1 0 2.97-2.97l-7.04-7.04Z" />
      <path d="m14 14 6.5 6.5M5.2 18.8l3.6-3.6M3.5 20.5l1.7-1.7" />
    </svg>
  )
}

function IconPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

function cleanName(value) {
  return String(value || '').replace(/^\s*\d+\s*[-.)]?\s*/, '').replace(/\s+/g, ' ').trim()
}

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
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const rows = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const content = await page.getTextContent()
    const byY = new Map()
    for (const item of content.items) {
      const text = String(item.str || '').trim()
      if (!text) continue
      const y = Math.round(Number(item.transform?.[5] || 0) * 10) / 10
      const row = byY.get(y) || []
      row.push({ x: Number(item.transform?.[4] || 0), text })
      byY.set(y, row)
    }
    ;[...byY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, row]) => {
      rows.push(row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '))
    })
  }
  const names = parseNamesFromLines(rows)
  if (!names.length) throw new Error('Không tìm thấy dòng tên theo mẫu STT – Lớp – Họ tên – Ngày sinh.')
  return names
}

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

function ToolTab({ tool, index, active, onSelect }) {
  return <button type="button" className={`utility-tab${active ? ' is-active' : ''}`} onClick={() => onSelect(index)}>{tool.label || `Tab ${index + 1}`}</button>
}

function UtilityWorkspace({ tool, onChange, onRemove }) {
  const [generated, setGenerated] = useState([])
  const [remaining, setRemaining] = useState([])
  const [winner, setWinner] = useState('')
  const [spinning, setSpinning] = useState(false)
  const items = tool.type === 'names' ? tool.names : tool.rewards
  const hasItems = items.length > 0

  const generate = () => {
    const next = shuffled(items)
    setGenerated(next)
    setRemaining(next)
    setWinner('')
  }

  const spin = () => {
    const pool = tool.removeWinners ? remaining : generated
    if (!pool.length || spinning) return
    setSpinning(true)
    window.setTimeout(() => {
      const result = pool[Math.floor(Math.random() * pool.length)]
      setWinner(result)
      if (tool.removeWinners) setRemaining((prev) => prev.filter((item) => item !== result))
      setSpinning(false)
    }, 650)
  }

  const updateRewards = (value) => onChange({ rewards: value.split(/\r?\n/).map((row) => row.trim()).filter(Boolean) })

  return (
    <section className="utility-workspace">
      <div className="utility-tab-head">
        <div>
          <label htmlFor={`tool-type-${tool.id}`}>Quay gì?</label>
          <select id={`tool-type-${tool.id}`} value={tool.type} onChange={(e) => onChange({ type: e.target.value, winner: '' })}>
            {TOOL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <button type="button" className="utility-remove-tab" onClick={onRemove}>Xóa tab</button>
      </div>

      {tool.type === 'names' ? (
        <div className="utility-source-card">
          <strong>Nguồn tên</strong>
          <p>{tool.names.length ? `Đã lọc ${tool.names.length} tên từ PDF${tool.fileName ? `: ${tool.fileName}` : ''}.` : 'Admin hãy thả PDF ở phần nguồn dữ liệu bên trên.'}</p>
          {tool.names.length ? <div className="utility-preview">{tool.names.slice(0, 12).map((item) => <span key={item.stt}>{item.stt}. {item.name}</span>)}{tool.names.length > 12 ? <span>… và {tool.names.length - 12} tên khác</span> : null}</div> : null}
        </div>
      ) : (
        <label className="utility-field utility-rewards-field">Danh sách phần thưởng (mỗi dòng một phần thưởng)
          <textarea value={tool.rewards.join('\n')} onChange={(e) => updateRewards(e.target.value)} placeholder="Ví dụ:\nKẹo\nĐiểm cộng\nMột tràng pháo tay" rows={5} />
        </label>
      )}

      <div className="utility-field"><span>Quay kiểu nào?</span><div className="utility-mode-grid">{SPIN_MODES.map((mode) => <label key={mode.value} className={`utility-mode${tool.mode === mode.value ? ' is-selected' : ''}`}><input type="radio" name={`mode-${tool.id}`} value={mode.value} checked={tool.mode === mode.value} onChange={() => onChange({ mode: mode.value })} /><strong>{mode.label}</strong><small>{mode.hint}</small></label>)}</div></div>
      <div className="utility-result-option"><span>Có kết quả trùng hay xóa các kết quả đã trúng không?</span><label className="utility-check"><input type="checkbox" checked={tool.removeWinners} onChange={(e) => onChange({ removeWinners: e.target.checked })} /> Có, xóa kết quả đã trúng</label><span className="utility-no">{tool.removeWinners ? 'Đang bật loại trùng' : 'Không, có thể trúng lại'}</span></div>
      <div className="utility-actions"><button type="button" className="utility-secondary" onClick={generate} disabled={!hasItems}>Tạo {tool.mode === 'wheel' ? 'vòng Wheel' : 'cuộc Duck Race'}</button><button type="button" className="utility-primary" onClick={spin} disabled={!generated.length || spinning}>{spinning ? 'Đang quay…' : 'Quay'}</button></div>
      <div className={`utility-stage utility-stage--${tool.mode}${spinning ? ' is-spinning' : ''}`} aria-live="polite">
        {winner ? <><span className="utility-winner-label">Kết quả</span><strong>{winner.name || winner}</strong>{tool.type === 'names' && winner.stt ? <small>STT {winner.stt}</small> : null}</> : <span>{generated.length ? 'Sẵn sàng — bấm Quay' : 'Hãy tạo vòng quay trước'}</span>}
      </div>
      {tool.removeWinners && generated.length ? <p className="utility-remaining">Còn lại: {remaining.length}/{generated.length}</p> : null}
    </section>
  )
}

export default function UtilityToolsPanel({ isAdmin = false }) {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [pdfState, setPdfState] = useState({ status: 'idle', message: '', names: [], fileName: '' })
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const [tools, setTools] = useState([{ id: 1, label: 'Tiện ích 1', type: 'names', mode: 'wheel', names: [], rewards: [], removeWinners: true }])

  const activeTool = tools[active]
  const readyNames = useMemo(() => pdfState.names, [pdfState.names])

  const loadPdf = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setPdfState((prev) => ({ ...prev, status: 'error', message: 'Vui lòng chọn file PDF.' }))
    setPdfState({ status: 'loading', message: 'Đang đọc và lọc tên từ PDF…', names: [], fileName: file.name })
    try {
      const names = await readPdfNames(file)
      setPdfState({ status: 'ready', message: `Đã lọc ${names.length} tên từ danh sách.`, names, fileName: file.name })
      setTools((prev) => prev.map((tool) => ({ ...tool, names })))
    } catch (error) {
      setPdfState({ status: 'error', message: error.message || 'Không đọc được PDF.', names: [], fileName: file.name })
    }
  }

  const updateActive = (patch) => setTools((prev) => prev.map((tool, index) => index === active ? { ...tool, ...patch } : tool))
  const addTab = () => { setTools((prev) => [...prev, { id: Date.now(), label: `Tiện ích ${prev.length + 1}`, type: 'names', mode: 'wheel', names: readyNames, rewards: [], removeWinners: true }]); setActive(tools.length) }
  const removeTab = () => { if (tools.length === 1) return; setTools((prev) => prev.filter((_, index) => index !== active)); setActive((prev) => Math.max(0, prev - 1)) }

  return (
    <div className="utility-tools-panel">
      <header className="utility-title-row"><div><span className="utility-kicker">CLASSROOM TOOLS</span><h2>Các công cụ</h2><p>Tiện ích quay ngẫu nhiên cho hoạt động trong lớp.</p></div><label className="utility-switch-label"><span>{enabled ? 'ON' : 'OFF'}</span><input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setOpen(e.target.checked) }} /><i aria-hidden="true" /></label></header>
      <div className="utility-first-card"><div><h3>Tiện ích quay ngẫu nhiên</h3><p>Quay tên từ danh sách PDF hoặc quay các phần thưởng do bạn nhập.</p></div><button type="button" className="utility-open-button" onClick={() => setOpen(true)} disabled={!enabled}>Mở công cụ</button></div>
      {isAdmin ? <div className="utility-pdf-card"><div><strong>Nguồn dữ liệu tên — chỉ admin</strong><p>{pdfState.message || 'Thả file PDF danh sách lớp vào đây để lọc STT và họ tên.'}</p></div><div className="utility-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadPdf(e.dataTransfer.files?.[0]) }} onClick={() => inputRef.current?.click()}><input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => loadPdf(e.target.files?.[0])} /><span>Thả PDF vào đây hoặc bấm để chọn</span></div>{pdfState.status === 'ready' ? <span className="utility-pdf-ok">✓ {pdfState.names.length} tên đã sẵn sàng</span> : null}</div> : null}
      {!enabled ? <div className="utility-off-note">Bật ON để hiện mini chat Tiện ích phụ ở góc màn hình.</div> : null}
      {enabled ? <button type="button" className="utility-mini-chat" aria-label="Mở Tiện ích phụ" onClick={() => setOpen((prev) => !prev)}><IconWrench /><span>Tiện ích</span></button> : null}
      {enabled && open ? <div className="utility-window" role="dialog" aria-label="Tiện ích quay ngẫu nhiên"><div className="utility-window-head"><strong><IconWrench /> Tiện ích phụ</strong><button type="button" onClick={() => setOpen(false)} aria-label="Đóng">×</button></div><div className="utility-tabs">{tools.map((tool, index) => <ToolTab key={tool.id} tool={tool} index={index} active={index === active} onSelect={setActive} />)}<button type="button" className="utility-add-tab" onClick={addTab} aria-label="Thêm tab"><IconPlus /></button></div>{activeTool ? <UtilityWorkspace tool={activeTool} onChange={updateActive} onRemove={removeTab} /> : null}</div> : null}
    </div>
  )
}

export { IconWrench }
