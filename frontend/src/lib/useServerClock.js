import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Đồng hồ theo giờ SERVER (không tin đồng hồ máy học sinh).
 * sync(server_now) mỗi lần API trả về; now() = giờ server ước tính; tick re-render mỗi intervalMs.
 */
export function useServerClock(intervalMs = 1000) {
  const offsetRef = useRef(0)
  const [, setTick] = useState(0)
  const sync = useCallback((serverNowIso) => {
    const t = Date.parse(serverNowIso)
    if (Number.isFinite(t)) offsetRef.current = t - Date.now()
  }, [])
  const now = useCallback(() => Date.now() + offsetRef.current, [])
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return useMemo(() => ({ sync, now }), [sync, now])
}
