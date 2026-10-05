// Tuần học: Tuần 1 bắt đầu từ Thứ Hai 31/08/2026. Hôm nay (Thứ Hai 05/10/2026) là Tuần 6.
const SCHOOL_WEEK_START = new Date(2026, 7, 31)
SCHOOL_WEEK_START.setHours(0, 0, 0, 0)

function parseDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Số tuần học (Thứ Hai -> Chủ Nhật) của một ngày; trước tuần 1 thì tính là 1. */
export function getStudyWeekNumber(value = new Date()) {
  const date = parseDate(value)
  if (!date) return 1
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7)) // về Thứ Hai của tuần đó
  const elapsedDays = Math.round((date.getTime() - SCHOOL_WEEK_START.getTime()) / 86400000)
  return Math.max(1, Math.floor(elapsedDays / 7) + 1)
}

/**
 * Luôn có đủ Tuần 1..tuần hiện tại (kể cả tuần không có bài), mới nhất ở trên.
 * posts được xếp theo ngày do getDate(post) trả về; ngày không đọc được vào "Tuần chưa xác định".
 */
export function buildWeekFolders(posts, getDate, currentWeek = getStudyWeekNumber()) {
  const map = new Map()
  for (let n = 1; n <= currentWeek; n += 1) map.set(n, [])
  const unknown = []
  for (const post of posts) {
    const raw = getDate(post)
    const date = raw ? parseDate(raw) : null
    if (!date) { unknown.push(post); continue }
    const n = getStudyWeekNumber(date)
    if (!map.has(n)) map.set(n, [])
    map.get(n).push(post)
  }
  const folders = [...map.entries()]
    .sort(([a], [b]) => b - a)
    .map(([num, items]) => ({ key: String(num), num, label: `Tuần ${num}`, items }))
  if (unknown.length) folders.push({ key: 'unknown', num: 0, label: 'Tuần chưa xác định', items: unknown })
  return folders
}
