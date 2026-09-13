/**
 * Thang trạng thái uy tín — bản server của statusFor() trên ReputationBoard.jsx.
 * good (86–100) → warn1 (65–85) → warn2 (31–64) → warn3 (0–30).
 */

export const STATUS_LEVELS = Object.freeze({
  good: { level: 'good', label: 'Tốt', rank: 0 },
  warn1: { level: 'warn1', label: 'Cảnh báo cấp I', rank: 1 },
  warn2: { level: 'warn2', label: 'Cảnh báo cấp II', rank: 2 },
  warn3: { level: 'warn3', label: 'Cảnh báo cấp III', rank: 3 },
  unknown: { level: 'unknown', label: '—', rank: -1 },
})

export function statusFor(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return STATUS_LEVELS.unknown
  if (s >= 86) return STATUS_LEVELS.good
  if (s >= 65) return STATUS_LEVELS.warn1
  if (s >= 31) return STATUS_LEVELS.warn2
  return STATUS_LEVELS.warn3
}

/** true khi bậc mới "xấu hơn" bậc cũ (tụt ít nhất 1 bậc). */
export function isStatusDrop(from, to) {
  const a = Number(from?.rank)
  const b = Number(to?.rank)
  return Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b > a
}
