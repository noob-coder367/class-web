import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { randomUUID } from 'node:crypto'

/**
 * Dữ liệu "Lịch trực vệ sinh" do LPLĐ (Lớp phó Lao động) + Admin quản lý.
 * Tính năng MỚI, độc lập hoàn toàn với timetable/homework/rules/events cũ
 * (bảng riêng: cleaning_duty_schedule, cleaning_duty_status — xem
 * supabase/cleaning-duty-schema.sql). Không sửa/động tới các service khác.
 */

export const DAY_IDS = ['t2', 't3', 't4', 't5', 't6', 't7']
export const DAY_LABELS = Object.freeze({
  t2: 'Thứ 2',
  t3: 'Thứ 3',
  t4: 'Thứ 4',
  t5: 'Thứ 5',
  t6: 'Thứ 6',
  t7: 'Thứ 7',
})

/**
 * Status lưu DB:
 * - preparing  → Chuẩn bị làm
 * - doing      → Đang làm
 * - done       → Đã làm
 * - not_clean  → Chưa sạch!
 *
 * Giữ tương thích ngược với dữ liệu cũ: pending → preparing, not_done → not_clean.
 */
const STATUS_VALUES = new Set(['preparing', 'doing', 'done', 'not_clean', 'pending', 'not_done'])
const MEDIA_BUCKET = 'classroom-data'
const MAX_PHOTOS_PER_UPLOAD = 20
const MAX_PHOTO_BYTES = 15 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const MIME_BY_EXT = Object.freeze({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif' })
const STORAGE_UPLOAD_TIMEOUT_MS = 100_000

function asText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function withTimeout(promise, timeoutMs, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AppError(message, 504)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function namesEqual(a, b) {
  const x = asText(a)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
  const y = asText(b)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
  return Boolean(x) && x === y
}

/** Chuẩn hoá 1 ngày bất kỳ về Date lúc 00:00 local. */
function toMidnight(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Thứ 2 của tuần chứa `date` (0=CN, 1=T2, ... 6=T7). */
export function getWeekStart(date = new Date()) {
  const d = toMidnight(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // CN lùi về T2 tuần trước
  d.setDate(d.getDate() + diff)
  return d
}

/** Ngày dương lịch cụ thể ứng với 1 mã thứ (t2..t7) trong tuần có `weekStart`. */
export function dateForDay(weekStart, dayId) {
  const idx = DAY_IDS.indexOf(dayId)
  if (idx === -1) throw new AppError('Mã thứ không hợp lệ.')
  const d = toMidnight(weekStart)
  d.setDate(d.getDate() + idx)
  return d
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  return !Number.isNaN(new Date(value).getTime())
}

function normalizeStatus(raw) {
  const s = String(raw || '').trim()
  if (s === 'pending') return 'preparing'
  if (s === 'not_done') return 'not_clean'
  if (STATUS_VALUES.has(s)) return s
  return 'preparing'
}

function mediaDataError(error, fallback) {
  const message = String(error?.message || '')
  if (/relation .* does not exist|undefined table|schema cache/i.test(message)) {
    return new AppError('Tính năng ảnh và đánh giá trực nhật chưa được cấu hình. Admin cần chạy cleaning-duty-media-schema.sql.', 503)
  }
  return new AppError(`${fallback}: ${message || 'lỗi không xác định'}`, 500)
}

function normalizeDaySlot(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const assignees = Array.isArray(src.assignees)
    ? [...new Set(src.assignees.map((n) => asText(n)).filter(Boolean))].slice(0, 20)
    : []
  return {
    assignees,
    note: asText(src.note).slice(0, 300),
  }
}

function normalizeDays(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const days = {}
  for (const dayId of DAY_IDS) {
    days[dayId] = normalizeDaySlot(src[dayId])
  }
  return days
}

/**
 * Lấy lịch trực của 1 tuần (mặc định tuần hiện tại). Trả về khung rỗng
 * (chưa phân công) nếu tuần đó chưa có dữ liệu — không throw lỗi.
 */
export async function getSchedule(weekStartRaw) {
  const weekStart = weekStartRaw && isValidISODate(weekStartRaw)
    ? toMidnight(weekStartRaw)
    : getWeekStart()
  const weekStartISO = toISODate(weekStart)

  const { data, error } = await supabaseAdmin
    .from('cleaning_duty_schedule')
    .select('*')
    .eq('week_start', weekStartISO)
    .maybeSingle()

  if (error) throw new AppError('Không tải được lịch trực vệ sinh: ' + error.message, 500)

  return {
    week_start: weekStartISO,
    days: normalizeDays(data?.days),
    note: asText(data?.note),
    updated_at: data?.updated_at || null,
  }
}

/** Danh sách các tuần gần nhất đã có lịch (mặc định 8 tuần), mới nhất trước. */
export async function listSchedules(limit = 8) {
  const { data, error } = await supabaseAdmin
    .from('cleaning_duty_schedule')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 8, 1), 52))

  if (error) throw new AppError('Không tải được danh sách lịch trực: ' + error.message, 500)

  return (data || []).map((row) => ({
    week_start: row.week_start,
    days: normalizeDays(row.days),
    note: asText(row.note),
    updated_at: row.updated_at,
  }))
}

/**
 * Tạo mới / ghi đè lịch trực của 1 tuần. Chỉ Admin / LPLĐ gọi được
 * (chặn ở middleware requireCapability('cleaningDuty')).
 */
export async function saveSchedule(payload, profile) {
  const weekStartRaw = payload?.week_start
  if (!weekStartRaw || !isValidISODate(weekStartRaw)) {
    throw new AppError('Ngày bắt đầu tuần (week_start) không hợp lệ.')
  }
  // Luôn quy về đúng Thứ 2 của tuần chứa ngày được gửi lên, tránh lưu lệch tuần.
  const weekStart = getWeekStart(weekStartRaw)
  const weekStartISO = toISODate(weekStart)
  const days = normalizeDays(payload?.days)
  const note = asText(payload?.note).slice(0, 500)

  const row = {
    week_start: weekStartISO,
    days,
    note,
    updated_by: profile?.id || null,
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from('cleaning_duty_schedule')
    .select('id')
    .eq('week_start', weekStartISO)
    .maybeSingle()

  if (readError) throw new AppError('Không đọc được lịch trực hiện có.', 500)

  let result
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('cleaning_duty_schedule')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle()
    if (error) throw new AppError('Cập nhật lịch trực thất bại: ' + error.message, 500)
    result = data
  } else {
    const { data, error } = await supabaseAdmin
      .from('cleaning_duty_schedule')
      .insert([{ ...row, created_by: profile?.id || null }])
      .select('*')
      .maybeSingle()
    if (error) throw new AppError('Tạo lịch trực thất bại: ' + error.message, 500)
    result = data
  }

  // Đảm bảo mỗi ngày trong tuần đều có 1 hàng trạng thái (mặc định 'preparing'),
  // không ghi đè trạng thái đã có sẵn.
  await ensureStatusRowsForWeek(weekStart)

  return {
    week_start: weekStartISO,
    days: normalizeDays(result?.days),
    note: asText(result?.note),
    updated_at: result?.updated_at,
  }
}

async function ensureStatusRowsForWeek(weekStart) {
  const rows = DAY_IDS.map((dayId) => ({
    duty_date: toISODate(dateForDay(weekStart, dayId)),
    week_start: toISODate(weekStart),
    day_of_week: dayId,
    status: 'preparing',
  }))

  const { error } = await supabaseAdmin
    .from('cleaning_duty_status')
    .upsert(rows, { onConflict: 'duty_date', ignoreDuplicates: true })

  if (error) {
    console.warn('[cleaningDuty] khởi tạo trạng thái ngày thất bại:', error.message)
  }
}

/** Trạng thái vệ sinh của các ngày trong 1 tuần (mặc định tuần hiện tại). */
export async function getWeekStatus(weekStartRaw) {
  const weekStart = weekStartRaw && isValidISODate(weekStartRaw)
    ? toMidnight(weekStartRaw)
    : getWeekStart()
  const weekStartISO = toISODate(weekStart)

  const { data, error } = await supabaseAdmin
    .from('cleaning_duty_status')
    .select('*')
    .eq('week_start', weekStartISO)
    .order('duty_date', { ascending: true })

  if (error) throw new AppError('Không tải được trạng thái vệ sinh: ' + error.message, 500)

  const byDay = {}
  for (const row of data || []) {
    byDay[row.day_of_week] = row
  }

  return {
    week_start: weekStartISO,
    days: DAY_IDS.map((dayId) => {
      const row = byDay[dayId]
      return {
        day_of_week: dayId,
        duty_date: row?.duty_date || toISODate(dateForDay(weekStart, dayId)),
        status: normalizeStatus(row?.status),
        note: asText(row?.note),
        marked_by_name: row?.marked_by_name || null,
        marked_at: row?.marked_at || null,
      }
    }),
  }
}

/**
 * Cập nhật trạng thái vệ sinh của 1 ngày cụ thể. Chỉ Admin / LPLĐ.
 * Tự tạo hàng nếu ngày đó chưa từng có.
 */
export async function updateDayStatus(dutyDateRaw, payload, profile) {
  if (!isValidISODate(dutyDateRaw)) {
    throw new AppError('Ngày không hợp lệ.')
  }
  const status = normalizeStatus(payload?.status)
  if (!['preparing', 'doing', 'done', 'not_clean'].includes(status)) {
    throw new AppError('Trạng thái không hợp lệ. Chỉ nhận: preparing, doing, done, not_clean.')
  }

  const dutyDate = toMidnight(dutyDateRaw)
  const dayIndex = ((dutyDate.getDay() + 6) % 7) // 0=T2 ... 5=T7, 6=CN
  if (dayIndex > 5) {
    throw new AppError('Chỉ ghi nhận vệ sinh từ Thứ 2 đến Thứ 7.')
  }
  const dayOfWeek = DAY_IDS[dayIndex]
  const weekStart = getWeekStart(dutyDate)

  const row = {
    duty_date: toISODate(dutyDate),
    week_start: toISODate(weekStart),
    day_of_week: dayOfWeek,
    status,
    note: asText(payload?.note).slice(0, 300),
    marked_by: profile?.id || null,
    marked_by_name: asText(profile?.username) || null,
    marked_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('cleaning_duty_status')
    .upsert([row], { onConflict: 'duty_date' })
    .select('*')
    .maybeSingle()

  if (error) throw new AppError('Cập nhật trạng thái vệ sinh thất bại: ' + error.message, 500)
  return {
    ...data,
    status: normalizeStatus(data?.status),
  }
}

function validateDutyTarget(weekStartRaw, dutyDateRaw, dayIdRaw) {
  const weekStart = weekStartRaw && isValidISODate(weekStartRaw) ? getWeekStart(weekStartRaw) : getWeekStart()
  const weekStartISO = toISODate(weekStart)
  if (!isValidISODate(dutyDateRaw)) throw new AppError('Ngày trực không hợp lệ.')
  const dutyDate = toMidnight(dutyDateRaw)
  const dayId = dayIdRaw || DAY_IDS[((dutyDate.getDay() + 6) % 7)]
  if (!DAY_IDS.includes(dayId) || toISODate(dateForDay(weekStart, dayId)) !== toISODate(dutyDate)) {
    throw new AppError('Ngày trực không thuộc tuần đã chọn.')
  }
  return { weekStartISO, dutyDateISO: toISODate(dutyDate), dayId }
}

async function ensureMediaBucket() {
  const { data, error } = await supabaseAdmin.storage.getBucket(MEDIA_BUCKET)
  if (error || !data) throw new AppError(`Kho dữ liệu "${MEDIA_BUCKET}" chưa được cấu hình trên Supabase.`, 503)
}

export async function listDutyPhotos(weekStartRaw, dutyDateRaw, dayIdRaw) {
  const target = validateDutyTarget(weekStartRaw, dutyDateRaw, dayIdRaw)
  await ensureMediaBucket()
  const { data, error } = await supabaseAdmin.from('cleaning_duty_photos').select('id, week_start, duty_date, day_of_week, storage_path, original_name, mime_type, size_bytes, uploaded_by, uploaded_by_name, created_at')
    .eq('week_start', target.weekStartISO).eq('duty_date', target.dutyDateISO).order('created_at', { ascending: false })
  if (error) throw mediaDataError(error, 'Không tải được ảnh trực nhật')
  const items = await Promise.all((data || []).map(async (row) => {
    const { data: signed, error: signedError } = await supabaseAdmin.storage.from(MEDIA_BUCKET).createSignedUrl(row.storage_path, 3600)
    if (signedError) throw new AppError('Không tạo được liên kết ảnh trực nhật.', 502)
    return { ...row, url: signed?.signedUrl || null }
  }))
  return { ...target, items }
}

export async function uploadDutyPhotos({ weekStart, dutyDate, dayId, files }, profile) {
  const target = validateDutyTarget(weekStart, dutyDate, dayId)
  const list = Array.isArray(files) ? files : []
  if (!list.length) throw new AppError('Chưa chọn ảnh trực nhật.')
  if (list.length > MAX_PHOTOS_PER_UPLOAD) throw new AppError(`Mỗi lượt chỉ được tải tối đa ${MAX_PHOTOS_PER_UPLOAD} ảnh.`)
  for (const file of list) {
    const ext = String(file.originalname || '').split('.').pop().toLowerCase()
    const mimeType = String(file.mimetype || '').toLowerCase() || MIME_BY_EXT[ext]
    if (!IMAGE_TYPES.has(mimeType)) throw new AppError('Chỉ nhận file ảnh hợp lệ (JPG, PNG, WEBP, GIF, HEIC).', 400)
    if (Number(file.size) > MAX_PHOTO_BYTES) throw new AppError('Mỗi ảnh không được vượt quá 15MB.')
  }
  await ensureMediaBucket()
  const uploaded = []
  try {
    for (const file of list) {
      const ext = String(file.originalname || '').split('.').pop().replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
      const storagePath = `cleaning-duty/${target.weekStartISO}/${target.dayId}/${randomUUID()}.${ext}`
      const mimeType = String(file.mimetype || '').toLowerCase() || MIME_BY_EXT[ext]
      console.info('[cleaning-upload] storage start', { fileCount: list.length, index: uploaded.length + 1, size: file.size, mimeType, path: storagePath })
      const { error: uploadError } = await withTimeout(
        supabaseAdmin.storage.from(MEDIA_BUCKET).upload(storagePath, file.buffer, { contentType: mimeType, upsert: false }),
        STORAGE_UPLOAD_TIMEOUT_MS,
        'Supabase Storage phản hồi quá lâu. Vui lòng thử lại với ảnh nhỏ hơn hoặc mạng ổn định hơn.'
      )
      if (uploadError) throw new AppError('Không tải được ảnh lên Supabase Storage: ' + uploadError.message, 502)
      console.info('[cleaning-upload] storage success', { path: storagePath, size: file.size })
      uploaded.push({ storage_path: storagePath, original_name: asText(file.originalname).slice(0, 180) || 'image', mime_type: mimeType, size_bytes: file.size, week_start: target.weekStartISO, duty_date: target.dutyDateISO, day_of_week: target.dayId, uploaded_by: profile?.id || null, uploaded_by_name: asText(profile?.username) || null })
    }
    const { data, error } = await supabaseAdmin.from('cleaning_duty_photos').insert(uploaded).select('*')
    if (error) throw mediaDataError(error, 'Ảnh đã tải lên nhưng không lưu được metadata')
    console.info('[cleaning-upload] metadata success', { fileCount: data?.length || 0 })
    return { items: data || [] }
  } catch (err) {
    await supabaseAdmin.storage.from(MEDIA_BUCKET).remove(uploaded.map((item) => item.storage_path)).catch(() => {})
    throw err
  }
}

export async function deleteDutyPhoto(id) {
  const { data: row, error: readError } = await supabaseAdmin.from('cleaning_duty_photos').select('id, storage_path').eq('id', String(id || '')).maybeSingle()
  if (readError) throw mediaDataError(readError, 'Không đọc được metadata ảnh')
  if (!row) throw new AppError('Không tìm thấy ảnh trực nhật.', 404)
  const { error: storageError } = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([row.storage_path])
  if (storageError) throw new AppError('Không xóa được file ảnh trong Storage: ' + storageError.message, 502)
  const { error } = await supabaseAdmin.from('cleaning_duty_photos').delete().eq('id', row.id)
  if (error) throw mediaDataError(error, 'Đã xóa file ảnh nhưng chưa xóa được metadata')
  return { id: row.id }
}

export async function getDutyReview(weekStartRaw, dutyDateRaw, dayIdRaw, profile) {
  const target = validateDutyTarget(weekStartRaw, dutyDateRaw, dayIdRaw)
  const { data, error } = await supabaseAdmin.from('cleaning_duty_reviews').select('*').eq('week_start', target.weekStartISO).eq('duty_date', target.dutyDateISO).eq('updated_by', profile?.id || '').maybeSingle()
  if (error) throw mediaDataError(error, 'Không tải được đánh giá trực nhật')
  return { ...target, review: data || { rating: 0, comment: '' } }
}

export async function saveDutyReview(weekStartRaw, dutyDateRaw, dayIdRaw, payload, profile) {
  const target = validateDutyTarget(weekStartRaw, dutyDateRaw, dayIdRaw)
  const rating = Number(payload?.rating)
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) throw new AppError('Mức đánh giá phải từ 0 đến 5 sao.')
  const row = { ...target, rating, comment: asText(payload?.comment).slice(0, 1000), updated_by: profile?.id || null, updated_by_name: asText(profile?.username) || null, updated_at: new Date().toISOString() }
  const { data, error } = await supabaseAdmin.from('cleaning_duty_reviews').upsert([row], { onConflict: 'week_start,duty_date,updated_by' }).select('*').maybeSingle()
  if (error) throw mediaDataError(error, 'Không lưu được đánh giá trực nhật')
  return { ...target, review: data }
}

/**
 * Đổi tên người trực (tài khoản giả → tài khoản thật) trên mọi tuần đã lưu.
 * Nếu ngày đã có tên mới thì gộp, không tạo bản trùng.
 */
export async function remapAssigneeName(oldName, newName) {
  const from = asText(oldName)
  const to = asText(newName)
  if (!from || !to) return { changed: 0 }

  const { data, error } = await supabaseAdmin
    .from('cleaning_duty_schedule')
    .select('id, days')

  if (error) throw new AppError('Không tải được lịch trực để đồng bộ: ' + error.message, 500)

  let changed = 0
  for (const row of data || []) {
    const days = normalizeDays(row.days)
    let dirty = false
    for (const dayId of DAY_IDS) {
      const current = days[dayId].assignees || []
      if (!current.some((name) => namesEqual(name, from))) continue
      const next = []
      const seen = new Set()
      for (const name of current) {
        const mapped = namesEqual(name, from) ? to : name
        const key = mapped.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        next.push(mapped)
      }
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        days[dayId].assignees = next
        dirty = true
      }
    }
    if (!dirty) continue
    const { error: updateError } = await supabaseAdmin
      .from('cleaning_duty_schedule')
      .update({ days })
      .eq('id', row.id)
    if (updateError) {
      throw new AppError('Không đồng bộ được lịch trực vệ sinh: ' + updateError.message, 500)
    }
    changed += 1
  }

  return { changed }
}
