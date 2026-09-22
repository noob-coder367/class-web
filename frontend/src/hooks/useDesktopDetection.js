import { useEffect, useState } from 'react'

function detectDesktop() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  const width = window.innerWidth
  const finePointer = window.matchMedia('(pointer: fine)').matches
  const hover = window.matchMedia('(hover: hover)').matches
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const touchPoints = Number(navigator.maxTouchPoints || 0)
  // Laptop 2-in-1 vẫn được coi là desktop khi đang có pointer chính xác + hover.
  // Touch-first tablet/mobile luôn bị chặn, kể cả khi viewport rộng.
  return width >= 960 && finePointer && hover && !coarsePointer && touchPoints === 0
}

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(detectDesktop)

  useEffect(() => {
    const update = () => setIsDesktop(detectDesktop())
    const queries = ['(pointer: fine)', '(pointer: coarse)', '(hover: hover)']
      .map((query) => window.matchMedia(query))
    queries.forEach((query) => query.addEventListener?.('change', update))
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    update()
    return () => {
      queries.forEach((query) => query.removeEventListener?.('change', update))
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return isDesktop
}
