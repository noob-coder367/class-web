/** Hàm dùng chung cho Kiểm tra (học sinh + admin). */
export const EXAM_MAX_IMAGE = 10 * 1024 * 1024
export const EXAM_MAX_PDF = 30 * 1024 * 1024
export const EXAM_MAX_TOTAL = 50 * 1024 * 1024
export const EXAM_MAX_FILES = 20
export const EXAM_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf']
export const EXAM_PREVIEW_EXT = ['jpg', 'jpeg', 'png', 'webp']
export const EXAM_FILE_ACCEPT = EXAM_ALLOWED_EXT.map((e) => `.${e}`).join(',')

export function extOf(name) {
  const s = String(name || '')
  return s.includes('.') ? s.split('.').pop().toLowerCase() : ''
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

const pad = (n) => String(n).padStart(2, '0')

/** "19:55 02-10" (giờ:phút ngày-tháng) đúng kiểu giao diện mẫu */
export function formatShort(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}-${pad(d.getMonth() + 1)}`
}

export function formatFull(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN')
}

/** 7_200_000 ms → "02:00:00" */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** upcoming (Sắp mở) · open (Đang mở) · closed (Đã kết thúc) — tính theo giờ SERVER (offset). */
export function phaseOf(exam, nowMs) {
  if (nowMs < Date.parse(exam.open_at)) return 'upcoming'
  if (nowMs >= Date.parse(exam.close_at)) return 'closed'
  return 'open'
}

export const PHASE_LABEL = { upcoming: 'Sắp mở', open: 'Đang mở', closed: 'Đã kết thúc' }

/** Kiểm tra file học sinh chọn. Trả về chuỗi lỗi hoặc ''. */
export function validateSubmitFile(file) {
  const ext = extOf(file.name)
  if (!EXAM_ALLOWED_EXT.includes(ext)) return `File "${file.name}" không được hỗ trợ (chỉ ảnh JPG/PNG/WEBP/HEIC và PDF).`
  const isPdf = ext === 'pdf'
  if (file.size > (isPdf ? EXAM_MAX_PDF : EXAM_MAX_IMAGE)) return `File "${file.name}" vượt quá ${isPdf ? '30MB (PDF)' : '10MB (ảnh)'}.`
  return ''
}

/** Vietnamese given-name sort, giống Quản lý lớp */
export function compareByGivenName(a, b) {
  const key = (n) => { const p = String(n || '').trim().split(/\s+/).filter(Boolean); return p.length ? p[p.length - 1].toLocaleLowerCase('vi') : '' }
  const by = key(a).localeCompare(key(b), 'vi', { sensitivity: 'base' })
  return by !== 0 ? by : String(a || '').localeCompare(String(b || ''), 'vi', { sensitivity: 'base' })
}

/** <input type="datetime-local"> value (giờ máy) */
export function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
