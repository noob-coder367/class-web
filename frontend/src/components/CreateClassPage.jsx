import { useEffect } from 'react'
import './CreateClassPage.css'

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5 L8 12 L15 19" />
    </svg>
  )
}

export default function CreateClassPage({ onBack }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onBack?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onBack])

  return (
    <div className="create-class-page" role="dialog" aria-modal="true" aria-label="Tạo lớp học">
      <button type="button" className="create-class-back" onClick={onBack}>
        <IconBack />
        Quay về
      </button>
    </div>
  )
}
