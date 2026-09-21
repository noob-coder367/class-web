/**
 * Chia sẻ nội dung bài đăng: ưu tiên Web Share API,
 * fallback copy link vào clipboard + toast/alert.
 *
 * @param {string|{ title?: string, text?: string, path?: string, fullText?: boolean }} title
 * @param {string} [text]
 * @param {string} [path]
 */
export async function shareHelper(title, text, path) {
  const opts = title && typeof title === 'object' ? title : { title, text, path }
  const shareTitle = String(opts.title || '').trim()
  const rawText = String(opts.text || '').replace(/\s+/g, ' ').trim()
  const snippet = (opts.fullText || rawText.length <= 15)
    ? rawText
    : `${rawText.slice(0, 15)}...`
  const routePath = String(opts.path || '').trim() || window.location.pathname
  const url = `${window.location.origin}${routePath.startsWith('/') ? routePath : `/${routePath}`}`

  const shareText = [shareTitle, snippet, url].filter(Boolean).join('\n')

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: shareTitle || 'Chia sẻ',
        text: shareText,
        url,
      })
      return { method: 'native' }
    } catch (err) {
      if (err?.name === 'AbortError') return { method: 'cancelled' }
    }
  }

  try {
    await copyToClipboard(url)
    showCopiedNotice('Đã sao chép liên kết vào clipboard')
    return { method: 'clipboard' }
  } catch {
    window.alert(`Không sao chép được liên kết. Hãy copy thủ công:\n${url}`)
    return { method: 'alert' }
  }
}

async function copyToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(input)
  if (!ok) throw new Error('copy failed')
}

function showCopiedNotice(message) {
  const existing = document.getElementById('classweb-share-toast')
  if (existing) existing.remove()

  const el = document.createElement('div')
  el.id = 'classweb-share-toast'
  el.setAttribute('role', 'status')
  el.textContent = message
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: '28px',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    background: '#14324a',
    color: '#fff',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.28)',
    maxWidth: '90vw',
    textAlign: 'center',
    fontFamily: 'inherit',
  })
  document.body.appendChild(el)
  window.setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el)
  }, 2800)
}

export default shareHelper
