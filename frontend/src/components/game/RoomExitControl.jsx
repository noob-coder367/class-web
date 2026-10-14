import { useEffect, useId, useState } from 'react'
import { LogOut } from 'lucide-react'
import './room-exit.css'

export default function RoomExitControl({ onExit, detail, error = '', className = '' }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!open || busy) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, busy])

  const choose = async (close) => {
    if (busy) return
    setBusy(true)
    try {
      const succeeded = await onExit(close)
      if (succeeded !== false) setOpen(false)
    } catch {
      // Keep the prompt open; the parent surfaces the actionable error.
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button type="button" className={`room-exit-trigger ${className}`.trim()} onClick={() => setOpen(true)} aria-label="Thoát phòng" title="Thoát phòng" aria-expanded={open}>
      <LogOut size={16} aria-hidden="true" /><span className="room-exit-label">Thoát phòng</span>
    </button>
    {open && <div className="room-exit-overlay">
      <section className="room-exit-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Chủ phòng đang rời đi</h2>
        <p>Phòng chưa kết thúc. Bạn có muốn đóng phòng không?</p>
        <div className="room-exit-actions">
          <button className="room-exit-choice room-exit-keep" type="button" onClick={() => void choose(false)} disabled={busy}>Không, để phòng tiếp tục</button>
          <button className="room-exit-choice room-exit-close" type="button" onClick={() => void choose(true)} disabled={busy}>{busy ? 'Đang xử lý…' : 'Có, đóng phòng'}</button>
        </div>
        {detail && <small>{detail}</small>}
        {error && <p className="room-exit-error" role="alert">{error}</p>}
      </section>
    </div>}
  </>
}
