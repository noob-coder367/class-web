/**
 * Thang tình trạng uy tín — dùng chung backend (auto-post discipline)
 * và frontend (ReputationBoard).
 */
export function statusFor(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return { label: '—', level: 'unknown' }
  if (s >= 86) return { label: 'Tốt', level: 'good' }
  if (s >= 65) return { label: 'Cảnh báo cấp I', level: 'warn1' }
  if (s >= 31) return { label: 'Cảnh báo cấp II', level: 'warn2' }
  return { label: 'Cảnh báo cấp III', level: 'warn3' }
}

export function statusLabel(score) {
  return statusFor(score).label
}
