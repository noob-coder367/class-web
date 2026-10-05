import { toCanvas } from 'html-to-image'
import { createRoot } from 'react-dom/client'
import ClassroomShareCard from '../components/share/ClassroomShareCard.jsx'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitForAssets(host) {
  await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => img.complete
    ? Promise.resolve()
    : new Promise((resolve) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }) })))
  if (document.fonts?.ready) await Promise.race([document.fonts.ready, wait(1500)])
}
function blobFromCanvas(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Không tạo được ảnh báo cáo.')), 'image/jpeg', 0.95))
}
function hasInk(canvas, start, end) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  for (let y = start; y < Math.min(end, canvas.height); y += 8) {
    for (let x = 0; x < canvas.width; x += 8) {
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
      if (a && (r < 238 || g < 238 || b < 238)) return true
    }
  }
  return false
}

// Tìm một dải trắng gần biên A4 để không cắt qua chữ hoặc hàng bảng.
function safeCutY(canvas, target, pageHeight, breakpoints = []) {
  const domCut = breakpoints
    .filter((point) => point > 24 && point < canvas.height - 24 && Math.abs(point - target) <= Math.round(pageHeight * 0.2))
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0]
  if (domCut) return domCut
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const radius = Math.min(Math.round(pageHeight * 0.18), 260)
  const from = Math.max(24, target - radius)
  const to = Math.min(canvas.height - 24, target + radius)
  const scores = []
  for (let y = from; y <= to; y += 2) {
    let ink = 0
    for (let x = 0; x < canvas.width; x += 6) {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
      if (r < 220 || g < 220 || b < 220) ink += 1
    }
    scores.push({ y, ink })
  }
  const maxInk = Math.max(3, Math.ceil(canvas.width / 90))
  const candidates = scores.filter((item) => item.ink <= maxInk && scores
    .filter((other) => Math.abs(other.y - item.y) <= 6)
    .every((other) => other.ink <= maxInk))
  if (!candidates.length) return target
  return candidates.sort((a, b) => Math.abs(a.y - target) - Math.abs(b.y - target))[0].y
}

async function renderPages(type, data, number) {
  const host = document.createElement('div')
  Object.assign(host.style, { position: 'fixed', left: '-12000px', top: '0', width: '21cm', height: 'auto', overflow: 'visible', background: '#fff', pointerEvents: 'none' })
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(<ClassroomShareCard type={type} data={data} number={number} />)
    await wait(80)
    await waitForAssets(host)
    await wait(80)
    const node = host.firstElementChild
    const width = Math.ceil(node.offsetWidth || node.scrollWidth)
    const height = Math.ceil(node.scrollHeight)
    const ratio = Math.max(2.2, 1600 / width)
    const source = await toCanvas(node, { width, height, pixelRatio: ratio, backgroundColor: '#fff', cacheBust: true, skipAutoScale: true, style: { overflow: 'visible', background: '#fff' } })
    const pageHeight = Math.round(source.width * 297 / 210)
    const scaleY = source.height / Math.max(1, node.scrollHeight)
    const breakpoints = Array.from(node.querySelectorAll('tr, p, li, figure, .official-doc-footer'))
      .map((element) => Math.round((element.offsetTop + element.offsetHeight) * scaleY))
      .filter((point, index, all) => all.indexOf(point) === index)
    const pages = []
    let y = 0
    while (y < source.height - 2 || !pages.length) {
      const end = Math.min(source.height, y + pageHeight)
      const cut = end < source.height ? safeCutY(source, end, pageHeight, breakpoints) : end
      const h = cut - y
      if (h <= 0) break
      if (pages.length > 0 && !hasInk(source, y, cut)) {
        y = cut
        continue
      }
      const canvas = document.createElement('canvas')
      canvas.width = source.width
      canvas.height = pageHeight
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(source, 0, y, source.width, h, 0, 0, source.width, h)
      pages.push(await blobFromCanvas(canvas))
      y = cut
    }
    return pages
  } finally { root.unmount(); host.remove() }
}
function stem(type) { return ({ timetable: 'tkb', rules: 'nql', violations: 'nql-danh-sach-vi-pham', rank: 'nql-bxh', cleaning: 'vsc', homework: 'btvn' })[type] || 'bao-cao-lop' }
export async function shareClassroomReport(type, data, number = 1) {
  const pages = await renderPages(type, data, number)
  const files = pages.map((blob, i) => new File([blob], `${stem(type)}-trang-${i + 1}.jpg`, { type: 'image/jpeg' }))
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
    try { await navigator.share({ title: 'Báo cáo lớp 10A4', text: 'Báo cáo Classroom', files }); return { method: 'native-files', pages: files.length } } catch (error) { if (error?.name === 'AbortError') return { method: 'cancelled' } }
  }
  files.forEach((file) => { const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })
  return { method: 'download-fallback', pages: files.length }
}
