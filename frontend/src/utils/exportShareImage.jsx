import { toCanvas } from 'html-to-image'
import { createRoot } from 'react-dom/client'
import OfficialDocShareCard from '../components/share/OfficialDocShareCard.jsx'

function waitForImages(container) {
  const images = Array.from(container.querySelectorAll('img'))
  return Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve()
    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true })
      image.addEventListener('error', resolve, { once: true })
    })
  }))
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

async function waitForSerifFonts() {
  if (!document.fonts?.ready) return
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ])
}

function canvasToBlob(canvas, quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh công văn.'))), 'image/jpeg', quality)
  })
}

async function renderOfficialDocPages(post) {
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    zIndex: '-1',
    width: '21cm',
    height: 'auto',
    pointerEvents: 'none',
    overflow: 'visible',
    background: '#ffffff',
  })
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(<OfficialDocShareCard post={post} longDocument />)
    await nextPaint()
    await waitForSerifFonts()
    await waitForImages(host)
    await nextPaint()
    const node = host.firstElementChild
    const width = Math.ceil(node.offsetWidth || node.scrollWidth)
    const height = Math.ceil(node.scrollHeight)
    const pixelRatio = Math.max(2.2, 1600 / width)
    const rendered = await toCanvas(node, {
      width,
      height,
      pixelRatio,
      backgroundColor: '#ffffff',
      cacheBust: true,
      skipAutoScale: true,
      style: {
        margin: '0',
        opacity: '1',
        transform: 'none',
        left: '0',
        top: '0',
        overflow: 'visible',
        background: '#ffffff',
      },
    })
    const pageHeight = Math.max(1, Math.round(rendered.width * 297 / 210))
    const pageCount = Math.max(1, Math.ceil(rendered.height / pageHeight))
    const pages = []
    for (let page = 0; page < pageCount; page += 1) {
      const sourceY = page * pageHeight
      const currentHeight = Math.min(pageHeight, rendered.height - sourceY)
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = rendered.width
      pageCanvas.height = pageHeight
      const context = pageCanvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      context.drawImage(rendered, 0, sourceY, rendered.width, currentHeight, 0, 0, rendered.width, currentHeight)
      pages.push(await canvasToBlob(pageCanvas))
    }
    return pages
  } finally {
    root.unmount()
    host.remove()
  }
}

function safeFileStem(post) {
  const title = String(post?.title || 'thong-bao-lop').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return title || 'thong-bao-lop'
}

function safeFileName(post, index, total) {
  const suffix = total > 1 ? `-trang-${index + 1}` : ''
  return `${safeFileStem(post)}${suffix}.jpg`
}

export async function createOfficialDocJpegs(post) {
  return renderOfficialDocPages(post)
}

export async function createOfficialDocJpeg(post) {
  const pages = await createOfficialDocJpegs(post)
  return pages[0]
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadOfficialDocImage(post) {
  const pages = await createOfficialDocJpegs(post)
  pages.forEach((blob, index) => downloadBlob(blob, safeFileName(post, index, pages.length)))
  return { method: 'download', pages: pages.length }
}

export async function shareOfficialDocImage(post) {
  const pages = await createOfficialDocJpegs(post)
  const files = pages.map((blob, index) => new File([blob], safeFileName(post, index, pages.length), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  }))
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files }))) {
    try {
      await navigator.share({ title: post?.title || 'Thông báo lớp', text: 'Thông báo lớp 10A4', files })
      return { method: 'native-files', pages: files.length }
    } catch (error) {
      if (error?.name === 'AbortError') return { method: 'cancelled', pages: files.length }
    }
  }
  files.forEach((file, index) => downloadBlob(file, safeFileName(post, index, files.length)))
  return { method: 'download-fallback', pages: files.length }
}
