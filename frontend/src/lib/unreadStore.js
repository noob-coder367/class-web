const KEY = 'classweb_unread_v1'

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { seen: {}, highlightUntil: {} }
    const parsed = JSON.parse(raw)
    return {
      seen: parsed.seen && typeof parsed.seen === 'object' ? parsed.seen : {},
      highlightUntil:
        parsed.highlightUntil && typeof parsed.highlightUntil === 'object'
          ? parsed.highlightUntil
          : {},
    }
  } catch {
    return { seen: {}, highlightUntil: {} }
  }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

/** Lấy timestamp lần cuối xem tab (ms). */
export function getLastSeen(tab) {
  const data = read()
  return Number(data.seen[tab]) || 0
}

export function markSeen(tab, at = Date.now()) {
  const data = read()
  data.seen[tab] = at
  // Bật highlight ~30s sau khi mở từ badge/push
  data.highlightUntil[tab] = at + 30_000
  write(data)
  window.dispatchEvent(new CustomEvent('classweb-unread-updated'))
}

export function isHighlightActive(tab) {
  const data = read()
  return Number(data.highlightUntil[tab] || 0) > Date.now()
}

export function countNewer(items, tab, getTime = (item) => item.created_at) {
  const last = getLastSeen(tab)
  if (!Array.isArray(items) || !last) {
    // Chưa từng xem: đếm tất cả trong 7 ngày gần nhất tối đa 9
    if (!Array.isArray(items)) return 0
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return items.filter((item) => {
      const t = new Date(getTime(item)).getTime()
      return Number.isFinite(t) && t > weekAgo
    }).length
  }
  return items.filter((item) => {
    const t = new Date(getTime(item)).getTime()
    return Number.isFinite(t) && t > last
  }).length
}

export function isItemNew(item, tab, getTime = (item) => item.created_at) {
  if (!isHighlightActive(tab)) return false
  const last = getLastSeen(tab)
  if (!last) return true
  const t = new Date(getTime(item)).getTime()
  return Number.isFinite(t) && t > last - 30_000
}
