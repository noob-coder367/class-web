/**
 * Tiện ích ngày/tuần cho tab "Vệ sinh lớp".
 * Logic tính tuần (T2 → T7) phải khớp với backend
 * (backend/src/services/cleaningDuty.service.js) để tra đúng dữ liệu.
 */

export const DAY_IDS = ['t2', 't3', 't4', 't5', 't6', 't7']

export const DAY_LABELS = {
  t2: 'Thứ 2',
  t3: 'Thứ 3',
  t4: 'Thứ 4',
  t5: 'Thứ 5',
  t6: 'Thứ 6',
  t7: 'Thứ 7',
}

export const STATUS_LABELS = {
  pending: 'Chưa cập nhật',
  done: 'Đã dọn vệ sinh',
  not_done: 'Chưa dọn vệ sinh',
}

function ymdInTimeZone(date, timeZone = 'Asia/Ho_Chi_Minh') {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
}

function toMidnight(dateLike) {
  const d = typeof dateLike === 'string' ? new Date(`${dateLike}T00:00:00`) : new Date(dateLike)
  d.setHours(0, 0, 0, 0)
  return d
}

export function todayISO() {
  return ymdInTimeZone(new Date())
}

export function tomorrowISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return ymdInTimeZone(d)
}

function toISODate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Thứ 2 của tuần chứa `dateLike` (0=CN,1=T2,...6=T7). Chủ nhật lùi về T2 tuần trước. */
export function getWeekStart(dateLike = new Date()) {
  const d = toMidnight(dateLike)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function getWeekStartISO(dateLike) {
  return toISODate(getWeekStart(dateLike))
}

/** Mã thứ (t2..t7) của `dateLike`, hoặc null nếu là Chủ nhật (không có lịch trực). */
export function dayIdFor(dateLike) {
  const d = toMidnight(dateLike)
  const day = d.getDay()
  if (day === 0) return null
  return DAY_IDS[day - 1]
}

export function formatDateVN(value) {
  if (!value) return ''
  const [y, m, d] = String(value).split('-')
  if (!y || !m || !d) return String(value)
  return `${d}/${m}/${y}`
}

export function dayLabel(dayId) {
  return DAY_LABELS[dayId] || dayId
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.pending
}
