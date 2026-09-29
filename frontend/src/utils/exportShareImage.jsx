import { toCanvas } from 'html-to-image'
import { createRoot } from 'react-dom/client'
import OfficialDocShareCard from '../components/share/OfficialDocShareCard.jsx'

function waitForImages(container) {
  return Promise.all(Array.from(container.querySelectorAll('img')).map((image) => {
    if (image.complete) return Promise.resolve()
    return new Promise((resolve) => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }) })
  }))
}
function nextPaint() { return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))) }
async function waitForSerifFonts() {
  if (!document.fonts?.ready) return
  await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2000))])
}
function keepFooterTogether(node) {
  const footer = node.querySelector('.official-doc-footer')
  if (!footer) return
  const pageHeight = node.offsetWidth * 297 / 210
  const footerTop = footer.offsetTop
  const remaining = pageHeight - (footerTop % pageHeight)
  if (remaining < footer.offsetHeight + 8) {
    const currentMargin = parseFloat(getComputedStyle(footer).marginTop) || 0
    footer.style.marginTop = `${currentMargin + remaining + 10}px`
  }
}
function pageHasInk(canvas, startY, endY) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  for (let y = Math.max(0, startY); y < Math.min(canvas.height, endY); y += 8) {
    for (let x = 0; x < canvas.width; x += 8) {
      const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
      if (a > 0 && (r < 238 || g < 238 || b < 238)) return true
    }
  }
  return false
}
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
  const candidates = scores.filter((item) => item.ink <= maxInk && scores.filter((other) => Math.abs(other.y - item.y) <= 6).every((other) => other.ink <= maxInk))
  if (!candidates.length) return target
  return candidates.sort((a, b) => Math.abs(a.y - target) - Math.abs(b.y - target))[0].y
}
function canvasToBlob(canvas, quality = 0.95) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh công văn.'))), 'image/jpeg', quality))
}

async function renderOfficialDocPages(post) {
  const host = document.createElement('div')
  Object.assign(host.style, { position: 'fixed', left: '-12000px', top: '0', zIndex: '-1', width: '21cm', height: 'auto', pointerEvents: 'none', overflow: 'visible', background: '#ffffff' })
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(<OfficialDocShareCard post={post} longDocument />)
    await nextPaint(); await waitForSerifFonts(); await waitForImages(host); await nextPaint()
    const node = host.firstElementChild
    keepFooterTogether(node)
    await nextPaint()
    const width = Math.ceil(node.offsetWidth || node.scrollWidth)
    const height = Math.ceil(node.scrollHeight)
    const pixelRatio = Math.max(2.2, 1600 / width)
    const rendered = await toCanvas(node, { width, height, pixelRatio, backgroundColor: '#ffffff', cacheBust: true, skipAutoScale: true, style: { margin: '0', opacity: '1', transform: 'none', left: '0', top: '0', overflow: 'visible', background: '#ffffff' } })
    const pageHeight = Math.max(1, Math.round(rendered.width * 297 / 210))
    const scaleY = rendered.height / Math.max(1, node.scrollHeight)
    const breakpoints = Array.from(node.querySelectorAll('.official-doc-text, .official-doc-images, figure, tr, .official-doc-footer'))
      .map((element) => Math.round((element.offsetTop + element.offsetHeight) * scaleY))
      .filter((point, index, all) => all.indexOf(point) === index)
    const pages = []
    let sourceY = 0
    while (sourceY < rendered.height - 2 || !pages.length) {
      const end = Math.min(rendered.height, sourceY + pageHeight)
      const cut = end < rendered.height ? safeCutY(rendered, end, pageHeight, breakpoints) : end
      const currentHeight = cut - sourceY
      if (currentHeight <= 0) break
      if (pages.length > 0 && !pageHasInk(rendered, sourceY, cut)) { sourceY = cut; continue }
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = rendered.width; pageCanvas.height = pageHeight
      const context = pageCanvas.getContext('2d')
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      context.drawImage(rendered, 0, sourceY, rendered.width, currentHeight, 0, 0, rendered.width, currentHeight)
      pages.push(await canvasToBlob(pageCanvas))
      sourceY = cut
    }
    return pages
  } finally { root.unmount(); host.remove() }
}
function safeFileStem(post) {
  const title = String(post?.title || 'thong-bao-lop').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return title || 'thong-bao-lop'
}
function safeFileName(post, index, total) { return `${safeFileStem(post)}${total > 1 ? `-trang-${index + 1}` : ''}.jpg` }
export async function createOfficialDocJpegs(post) { return renderOfficialDocPages(post) }
export async function createOfficialDocJpeg(post) { return (await createOfficialDocJpegs(post))[0] }
export function downloadBlob(blob, fileName) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export async function downloadOfficialDocImage(post) { const pages = await createOfficialDocJpegs(post); pages.forEach((blob, index) => downloadBlob(blob, safeFileName(post, index, pages.length))); return { method: 'download', pages: pages.length } }
export async function shareOfficialDocImage(post) {
  const pages = await createOfficialDocJpegs(post)
  const files = pages.map((blob, index) => new File([blob], safeFileName(post, index, pages.length), { type: 'image/jpeg', lastModified: Date.now() }))
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files }))) {
    try { await navigator.share({ title: post?.title || 'Thông báo lớp', text: 'Thông báo lớp 10A4', files }); return { method: 'native-files', pages: files.length } } catch (error) { if (error?.name === 'AbortError') return { method: 'cancelled', pages: files.length } }
  }
  files.forEach((file, index) => downloadBlob(file, safeFileName(post, index, files.length)))
  return { method: 'download-fallback', pages: files.length }
}
