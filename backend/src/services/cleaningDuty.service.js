import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

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

const STATUS_VALUES = new Set(['pending', 'done', 'not_done'])

function asText(value, fallback = '') {
  return String(value ?? fallback).trim()
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

  // Đảm bảo mỗi ngày trong tuần đều có 1 hàng trạng thái (mặc định 'pending'),
  // không ghi đè trạng thái đã có sẵn (ví dụ đã được đánh dấu 'done' trước đó).
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
  }))

  const { error } = await supabaseAdmin
    .from('cleaning_duty_status')
    .upsert(rows, { onConflict: 'duty_date', ignoreDuplicates: true })

  if (error) {
    // Không chặn luồng lưu lịch trực nếu bước "khởi tạo trạng thái" lỗi —
    // chỉ log để không ảnh hưởng trải nghiệm của LPLĐ/Admin.
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
        status: row?.status || 'pending',
        note: asText(row?.note),
        marked_by_name: row?.marked_by_name || null,
        marked_at: row?.marked_at || null,
      }
    }),
  }
}

/**
 * Cập nhật trạng thái vệ sinh của 1 ngày cụ thể. Chỉ Admin / LPLĐ.
 * Tự tạo hàng nếu ngày đó chưa từng có (ví dụ trực đột xuất, chưa có lịch tuần).
 */
export async function updateDayStatus(dutyDateRaw, payload, profile) {
  if (!isValidISODate(dutyDateRaw)) {
    throw new AppError('Ngày không hợp lệ.')
  }
  const status = String(payload?.status || '').trim()
  if (!STATUS_VALUES.has(status)) {
    throw new AppError('Trạng thái không hợp lệ. Chỉ nhận: pending, done, not_done.')
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
  return data
}
