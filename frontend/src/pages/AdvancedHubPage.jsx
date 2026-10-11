import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import { getUtilityRoster, saveUtilityRoster } from '../services/classRosterService.js'
import './AdvancedHubPage.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function parseNamesFromLines(lines) {
  const found = []
  const seen = new Set()
  const add = (stt, rawName) => {
    const name = String(rawName || '').replace(/^\\s*\\d+\\s*[-.)]?\\s*/, '').replace(/\\s+/g, ' ').replace(/[|;,:\\s-]+$/, '').trim()
    const number = Number(stt)
    if (!Number.isInteger(number) || number < 1 || !name || /^họ tên$/i.test(name) || /^họ và tên$/i.test(name)) return
    const key = number + ':' + name.toLocaleLowerCase('vi')
    if (seen.has(key) || found.some((item) => item.stt === number)) return
    seen.add(key)
    found.push({ stt: number, name })
  }
  for (const raw of lines) {
    const line = String(raw || '').replace(/[\\t|]+/g, ' ').replace(/\\s+/g, ' ').trim()
    if (!line || /^STT\\b/i.test(line) || /^DANH SÁCH/i.test(line)) continue
    // Standard legacy format: STT, class, full name, date of birth.
    const dateMatch = line.match(/^\\s*(\\d{1,3})\\s+(?:10[A-Z0-9]+)\\s+(.+?)\\s+(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})\\b/i)
    if (dateMatch) { add(dateMatch[1], dateMatch[2]); continue }
    // PDF text extraction can split table columns differently or omit the date.
    const classMatch = line.match(/^\\s*(\\d{1,3})\\s+(?:10[A-Z0-9]+)\\s+(.+)$/i)
    if (classMatch) {
      const name = classMatch[2].replace(/\\s+\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}.*$/, '').trim()
      if (name) add(classMatch[1], name)
      continue
    }
    // Some PDFs export the columns as "STT Name ..." without the class column.
    const simpleMatch = line.match(/^\\s*(\\d{1,3})[.)]?\\s+([\\p{L}][\\p{L}\\s.'’-]{2,}?)(?:\\s+\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})?\\s*$/u)
    if (simpleMatch && !/^(tổng|số lượng|lớp|ngày sinh|họ tên)\\b/i.test(simpleMatch[2])) add(simpleMatch[1], simpleMatch[2])
  }
  return found.sort((a, b) => a.stt - b.stt)
}
async function readPdfNames(file) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const rows = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const content = await (await pdf.getPage(pageNo)).getTextContent()
    const byY = new Map()
    for (const item of content.items) {
      const text = String(item.str || '').trim()
      if (!text) continue
      const y = Math.round(Number(item.transform?.[5] || 0) * 10) / 10
      const row = byY.get(y) || []
      row.push({ x: Number(item.transform?.[4] || 0), text })
      byY.set(y, row)
    }
    ;[...byY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, row]) => rows.push(row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ')))
  }
  let names = parseNamesFromLines(rows)
  // Second pass: join adjacent extracted rows when the PDF splits each table row vertically.
  if (!names.length) {
    const compact = rows.map((row) => String(row || '').replace(/\\s+/g, ' ').trim()).filter(Boolean)
    names = parseNamesFromLines(compact.map((row, index) => index + 1 < compact.length ? row + ' ' + compact[index + 1] : row))
  }
  if (!names.length) throw new Error('PDF đã mở được nhưng không tìm thấy tên học sinh. Hãy kiểm tra PDF có lớp, STT và chữ có thể bôi đen/copy được (không phải ảnh scan).')
  if (names.length > 100) names = names.slice(0, 100)
  return names
}

function Icon({ name }) {
  return name === 'money' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H20v14H5.5A2.5 2.5 0 0 1 3 16.5zM3 8h17M15 12h5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h8" /></svg>
}

export default function AdvancedHubPage({ view = 'roster' }) {
  const inputRef = useRef(null)
  const [roster, setRoster] = useState({ names: [], fileName: '', updatedAt: '' })
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('Đang tải danh sách lớp đã lưu…')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    getUtilityRoster().then((data) => {
      if (!live) return
      const next = data?.roster || { names: [], fileName: '', updatedAt: '' }
      setRoster(next)
      setStatus(next.names?.length ? 'ready' : 'empty')
      setMessage(next.names?.length ? 'Đã tải danh sách lớp đã lưu.' : 'Chưa có danh sách lớp. Hãy tải PDF để bắt đầu.')
    }).catch((error) => { if (live) { setStatus('error'); setMessage(error.message || 'Không thể đọc danh sách lớp.') } })
    return () => { live = false }
  }, [])
  const loadPdf = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setStatus('error'); setMessage('Vui lòng chọn file PDF.'); return }
    if (file.size > 30 * 1024 * 1024) { setStatus('error'); setMessage('PDF vượt quá giới hạn 30 MB.'); return }
    setBusy(true); setStatus('loading'); setMessage('Đang đọc PDF và lưu danh sách lên Supabase…')
    try {
      const names = await readPdfNames(file)
      const data = await saveUtilityRoster({ names, fileName: file.name })
      const next = data?.roster || { names, fileName: file.name, updatedAt: new Date().toISOString() }
      setRoster(next); setStatus('ready'); setMessage('Đã lưu danh sách lớp thành công. Tiền lớp sẽ sử dụng dữ liệu này.')
    } catch (error) { setStatus('error'); setMessage(error.message || 'Không đọc hoặc lưu được PDF.') }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }
  return <div className="advanced-hub">
    <aside className="advanced-sidebar">
      <Link to="/" className="advanced-brand"><span className="advanced-brand-mark">10A4</span><span><strong>Khu nâng cao</strong><small>QUẢN TRỊ LỚP</small></span></Link>
      <div className="advanced-nav-label">QUẢN LÝ LỚP</div>
      <Link className={view === 'money' ? 'advanced-nav-item active' : 'advanced-nav-item'} to="/tien-lop"><Icon name="money" /> <span>Tiền lớp</span></Link>
      <Link className={view !== 'money' ? 'advanced-nav-item active' : 'advanced-nav-item'} to="/nang-cao"><Icon name="roster" /> <span>Danh sách lớp</span></Link>
      <div className="advanced-sidebar-foot"><span className="advanced-status-dot" /> Chỉ quản trị viên</div>
    </aside>
    {view === 'money' ? <div className="advanced-money-content"><div className="advanced-mobile-heading">KHU NÂNG CAO · TIỀN LỚP</div><MoneyPageProxy /></div> : <main className="advanced-main">
      <header className="advanced-page-header"><div><span className="advanced-eyebrow">DỮ LIỆU LỚP HỌC</span><h1>Danh sách lớp</h1><p>Tải PDF danh sách học sinh. Hệ thống đọc tên theo mẫu cũ và lưu để Tiền lớp sử dụng.</p></div><div className="advanced-count"><strong>{roster.names?.length || 0}</strong><span>học sinh</span></div></header>
      <section className="roster-upload-card"><div className="roster-upload-icon"><Icon name="roster" /></div><div className="roster-upload-copy"><h2>Nguồn danh sách từ PDF</h2><p>{message}</p>{roster.fileName ? <div className="roster-file-meta"><span>PDF đã lưu</span><strong>{roster.fileName}</strong>{roster.updatedAt ? <small>{new Date(roster.updatedAt).toLocaleString('vi-VN')}</small> : null}</div> : null}</div><input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => loadPdf(event.target.files?.[0])} /><button type="button" className="roster-upload-button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? 'Đang xử lý…' : roster.names?.length ? 'Thay PDF' : 'Chọn PDF'}</button></section>
      <div className={'roster-feedback roster-feedback--' + status}>{status === 'ready' ? '✓ ' : status === 'error' ? '⚠ ' : ''}{message}</div>
      <section className="roster-table-card"><div className="roster-table-head"><div><h2>Học sinh đã trích xuất</h2><p>Danh sách được lưu trên Supabase, không mất khi tải lại trang.</p></div><span>{roster.names?.length || 0} dòng</span></div>{roster.names?.length ? <div className="roster-table-scroll"><table><thead><tr><th>STT</th><th>Họ và tên</th></tr></thead><tbody>{roster.names.map((student, index) => <tr key={student.stt + '-' + student.name}><td>{student.stt || index + 1}</td><td>{student.name}</td></tr>)}</tbody></table></div> : <div className="roster-empty"><Icon name="roster" /><strong>Chưa có dữ liệu</strong><span>Tải PDF danh sách lớp để hệ thống trích xuất học sinh.</span></div>}</section>
    </main>}
  </div>
}

function MoneyPageProxy() {
  const [Page, setPage] = useState(null)
  useEffect(() => { import('./ClassMoneyPage.jsx').then((module) => setPage(() => module.default)) }, [])
  return Page ? <Page /> : <div className="advanced-money-loading">Đang mở Tiền lớp…</div>
}
