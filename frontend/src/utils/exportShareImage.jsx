import { toJpeg } from 'html-to-image'
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
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ])
}

async function renderOfficialDoc(post) {
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '-1',
    width: '1000px',
    pointerEvents: 'none',
    overflow: 'visible',
    background: '#ffffff',
  })
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(<OfficialDocShareCard post={post} />)
    await nextPaint()
    await waitForSerifFonts()
    await waitForImages(host)
    await nextPaint()
    const node = host.firstElementChild
    const width = 1000
    const height = Math.max(Math.ceil(node.scrollHeight), Math.ceil(node.offsetHeight))
    const dataUrl = await toJpeg(node, {
      quality: 0.8,
      pixelRatio: 1,
      backgroundColor: '#ffffff',
      cacheBust: true,
      width,
      height,
      skipAutoScale: true,
      style: {
        margin: '0',
        opacity: '1',
        transform: 'none',
        left: '0',
        top: '0',
        width: `${width}px`,
        height: `${height}px`,
        overflow: 'visible',
        background: '#ffffff',
      },
    })
    const response = await fetch(dataUrl)
    return await response.blob()
  } finally {
    root.unmount()
    host.remove()
  }
}

function safeFileName(post) {
  const title = String(post?.title || 'thong-bao-lop').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${title || 'thong-bao-lop'}.jpg`
}

export async function createOfficialDocJpeg(post) {
  return renderOfficialDoc(post)
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
  const blob = await createOfficialDocJpeg(post)
  downloadBlob(blob, safeFileName(post))
  return { method: 'download', fileName: safeFileName(post) }
}

export async function shareOfficialDocImage(post) {
  const blob = await createOfficialDocJpeg(post)
  const file = new File([blob], safeFileName(post), { type: 'image/jpeg', lastModified: Date.now() })
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ title: post?.title || 'Thông báo lớp', text: 'Thông báo lớp 10A4', files: [file] })
      return { method: 'native-file' }
    } catch (error) {
      if (error?.name === 'AbortError') return { method: 'cancelled' }
    }
  }
  downloadBlob(blob, file.name)
  return { method: 'download-fallback', fileName: file.name }
}
