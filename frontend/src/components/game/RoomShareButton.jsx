import { useState } from 'react'

export default function RoomShareButton({ className = '', label = 'Sao chép link' }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const url = window.location.href
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const input = document.createElement('textarea')
        input.value = url
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className={`room-share-link ${className}`.trim()} onClick={() => void copy()} aria-label="Sao chép link vào phòng">
      {copied ? 'Đã sao chép link' : label}
    </button>
  )
}
