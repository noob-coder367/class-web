/**
 * Tiện ích ngày/tuần + status cho tab "Vệ sinh lớp".
 * Logic tính tuần (T2 → T7) phải khớp với backend
 * (backend/src/services/cleaningDuty.service.js).
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

/** Status hiển thị cho người dùng */
export const STATUS_LABELS = {
  preparing: 'Chuẩn bị làm',
  doing: 'Đang làm',
  done: 'Đã làm',
  not_clean: 'Chưa sạch!',
}

/** Map status cũ → mới (tương thích dữ liệu đã lưu) */
function normalizeStatus(raw) {
  const s = String(raw || '').trim()
  if (s === 'pending') return 'preparing'
  if (s === 'not_done') return 'not_clean'
  if (STATUS_LABELS[s]) return s
  return 'preparing'
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

/** Thứ 7 (cuối tuần trực) của tuần chứa `dateLike`. */
export function getWeekEndISO(dateLike = new Date()) {
  const start = getWeekStart(dateLike)
  start.setDate(start.getDate() + 5) // T2 + 5 = T7
  return toISODate(start)
}

/** Thứ 2 của tuần kế tiếp. */
export function getNextWeekStartISO(dateLike = new Date()) {
  const start = getWeekStart(dateLike)
  start.setDate(start.getDate() + 7)
  return toISODate(start)
}

/** Thứ 7 của tuần kế tiếp. */
export function getNextWeekEndISO(dateLike = new Date()) {
  const start = getWeekStart(dateLike)
  start.setDate(start.getDate() + 12) // T2 tuần sau + 5 = T7 tuần sau
  return toISODate(start)
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
  return STATUS_LABELS[normalizeStatus(status)] || STATUS_LABELS.preparing
}

/**
 * Tính trạng thái hiệu lực để hiển thị trên Ô 1.
 *
 * Quy tắc mặc định theo khung giờ hệ thống (Asia/Ho_Chi_Minh):
 * - Ngày đã qua (hôm qua trở về trước) → Đã làm
 * - Trong ngày hôm nay, trước 17:00 → Đang làm
 * - Từ 17:00 hôm nay trở đi → Đã làm
 * - Ngày mai / tương lai → Chuẩn bị làm
 *
 * Nếu Admin/LPLĐ đã đánh dấu thủ công (có marked_at),
 * ưu tiên status đã lưu (đặc biệt "Chưa sạch!").
 */
export function effectiveStatus(dutyDateISO, storedRow) {
  const stored = normalizeStatus(storedRow?.status)
  const hasManual = Boolean(storedRow?.marked_at)

  if (hasManual && (stored === 'not_clean' || stored === 'done' || stored === 'doing' || stored === 'preparing')) {
    return stored
  }

  const today = todayISO()
  if (!dutyDateISO) return 'preparing'

  if (dutyDateISO < today) return 'done'
  if (dutyDateISO > today) return 'preparing'

  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(nowParts.find((p) => p.type === 'hour')?.value || 0)
  const minute = Number(nowParts.find((p) => p.type === 'minute')?.value || 0)
  const totalMinutes = hour * 60 + minute

  if (totalMinutes >= 17 * 60) return 'done'
  return 'doing'
}
