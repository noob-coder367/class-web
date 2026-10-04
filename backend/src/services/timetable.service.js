import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PATH = join(__dirname, '../data/timetable.default.json')

const DAY_IDS = ['t2', 't3', 't4', 't5', 't6', 't7']
const SESSION_IDS = ['morning', 'afternoon']
const DAY_LABELS = {
  t2: 'Thứ 2',
  t3: 'Thứ 3',
  t4: 'Thứ 4',
  t5: 'Thứ 5',
  t6: 'Thứ 6',
  t7: 'Thứ 7',
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function loadDefault() {
  return JSON.parse(readFileSync(DEFAULT_PATH, 'utf8'))
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function asText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function asTime(value, fallback) {
  const text = asText(value, fallback)
  return TIME_RE.test(text) ? text : fallback
}

/**
 * Khoảng áp dụng TKB: Thứ 2 → Thứ 7 của tuần hiện tại.
 * Chủ nhật: reset sang tuần sau (Thứ 2 → Thứ 7 tuần tới).
 */
export function getApplicationRange(now = new Date()) {
  const d = new Date(now)
  // dùng local date (server có thể UTC, nhưng logic tuần vẫn đúng tương đối)
  const day = d.getDay() // 0=CN, 1=T2, ..., 6=T7
  const monday = new Date(d)
  monday.setHours(0, 0, 0, 0)
  if (day === 0) {
    // Chủ nhật → tuần sau
    monday.setDate(d.getDate() + 1)
  } else {
    monday.setDate(d.getDate() - (day - 1))
  }
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { from: monday, to: saturday }
}

export function formatDateVN(date) {
  const d = date instanceof Date ? date : new Date(date)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeSession(raw, fallback) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const periodsSrc = Array.isArray(src.periods) && src.periods.length
    ? src.periods
    : fallback.periods

  const periods = periodsSrc.slice(0, 8).map((period, index) => {
    const fb = fallback.periods[index] || fallback.periods[fallback.periods.length - 1] || {
      id: index + 1,
      start: '07:00',
      end: '07:45',
    }
    const id = Number(period?.id) || index + 1
    const start = asTime(period?.start, fb.start)
    const end = asTime(period?.end, fb.end)
    const note = asText(period?.note, fb.note || '')
    return note ? { id, start, end, note } : { id, start, end }
  })

  const breaksSrc = Array.isArray(src.breaks) ? src.breaks : fallback.breaks
  const breaks = breaksSrc.slice(0, 4).map((item, index) => {
    const fb = fallback.breaks[index] || { after: 2, start: '08:30', end: '09:00', label: 'Giải lao' }
    return {
      after: Number(item?.after) || fb.after,
      start: asTime(item?.start, fb.start),
      end: asTime(item?.end, fb.end),
      label: asText(item?.label, fb.label) || fb.label,
    }
  })

  const grid = {}
  for (const dayId of DAY_IDS) {
    const col = Array.isArray(src.grid?.[dayId]) ? src.grid[dayId] : fallback.grid[dayId] || []
    grid[dayId] = periods.map((_, index) => asText(col[index], ''))
  }

  const session = {
    label: asText(src.label, fallback.label) || fallback.label,
    daysNote: asText(src.daysNote, fallback.daysNote) || fallback.daysNote,
    arrival: asTime(src.arrival, fallback.arrival),
    periods,
    breaks,
    grid,
  }

  if (src.flagCeremony === null) {
    session.flagCeremony = null
  } else if (src.flagCeremony || fallback.flagCeremony) {
    const fb = fallback.flagCeremony || { time: '06:45', note: '' }
    session.flagCeremony = {
      time: asTime(src.flagCeremony?.time, fb.time),
      note: asText(src.flagCeremony?.note, fb.note),
    }
  } else {
    session.flagCeremony = null
  }

  return session
}

function normalizeChangeNotice(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    active: raw.active === true,
    hasChanges: raw.hasChanges === true,
    from: asText(raw.from),
    to: asText(raw.to),
    summary: asText(raw.summary) || 'Chưa có sự thay đổi',
    lines: Array.isArray(raw.lines)
      ? raw.lines.map((l) => asText(l)).filter(Boolean).slice(0, 80)
      : [],
    createdAt: asText(raw.createdAt) || new Date().toISOString(),
  }
}

export function normalizeTimetable(raw) {
  const fallback = loadDefault()
  const src = raw && typeof raw === 'object' ? raw : {}

  const subjects = Array.isArray(src.subjects) && src.subjects.length
    ? [...new Set(src.subjects.map((item) => asText(item)).filter(Boolean))].slice(0, 80)
    : fallback.subjects

  return {
    className: asText(src.className, fallback.className) || fallback.className,
    effectiveFrom: asText(src.effectiveFrom, fallback.effectiveFrom) || fallback.effectiveFrom,
    subjects,
    days: fallback.days,
    morning: normalizeSession(src.morning, fallback.morning),
    afternoon: normalizeSession(src.afternoon, fallback.afternoon),
    changeNotice: normalizeChangeNotice(src.changeNotice),
    updatedAt: asText(src.updatedAt) || new Date().toISOString(),
  }
}

function sessionLabel(key) {
  return key === 'afternoon' ? 'Buổi chiều' : 'Buổi sáng'
}

/** So sánh grid 2 phiên bản → danh sách dòng thay đổi */
export function diffTimetable(prev, next) {
  const lines = []
  for (const sessionKey of SESSION_IDS) {
    const prevGrid = prev?.[sessionKey]?.grid || {}
    const nextGrid = next?.[sessionKey]?.grid || {}
    const label = sessionLabel(sessionKey)
    for (const dayId of DAY_IDS) {
      const prevCol = prevGrid[dayId] || []
      const nextCol = nextGrid[dayId] || []
      const maxLen = Math.max(prevCol.length, nextCol.length)
      for (let i = 0; i < maxLen; i++) {
        const a = asText(prevCol[i])
        const b = asText(nextCol[i])
        if (a === b) continue
        const dayLabel = DAY_LABELS[dayId] || dayId
        const from = a || '(trống)'
        const to = b || '(trống)'
        lines.push(`${label} · ${dayLabel} · Tiết ${i + 1}: ${from} → ${to}`)
      }
    }
  }
  return lines
}

function databaseError(message, error) {
  console.error(`[timetable] ${message}:`, error?.message || error)
  return new AppError(message, 500)
}

async function selectRelationalState() {
  const { data: timetableRows, error: timetableError } = await supabaseAdmin
    .from('timetables')
    .select('id, class_name, effective_from, subjects, days, updated_at')
    .order('id', { ascending: true })
    .limit(1)
  if (timetableError) throw databaseError('Không thể tải thời khoá biểu.', timetableError)

  const timetable = timetableRows?.[0]
  if (!timetable) return null

  const [sessionResult, periodResult, breakResult, entryResult, noticeResult] = await Promise.all([
    supabaseAdmin.from('timetable_sessions').select('session, label, days_note, arrival, has_flag_ceremony, flag_ceremony_configured, flag_ceremony_time, flag_ceremony_note').eq('timetable_id', timetable.id),
    supabaseAdmin.from('timetable_periods').select('session, period_id, start_time, end_time, note').eq('timetable_id', timetable.id).order('period_id', { ascending: true }),
    supabaseAdmin.from('timetable_breaks').select('session, after_period, start_time, end_time, label').eq('timetable_id', timetable.id).order('after_period', { ascending: true }),
    supabaseAdmin.from('timetable_entries').select('session, day_id, period_id, subject').eq('timetable_id', timetable.id).order('period_id', { ascending: true }),
    supabaseAdmin.from('timetable_change_notices').select('active, has_changes, date_from, date_to, summary, lines, created_at').eq('timetable_id', timetable.id).order('created_at', { ascending: false }).limit(1),
  ])
  for (const [result, message] of [
    [sessionResult, 'Không thể tải cấu hình phiên TKB.'],
    [periodResult, 'Không thể tải tiết học TKB.'],
    [breakResult, 'Không thể tải giờ nghỉ TKB.'],
    [entryResult, 'Không thể tải nội dung TKB.'],
    [noticeResult, 'Không thể tải thông báo TKB.'],
  ]) {
    if (result.error) throw databaseError(message, result.error)
  }

  const sessions = {}
  for (const row of sessionResult.data || []) {
    sessions[row.session] = {
      label: row.label,
      daysNote: row.days_note,
      arrival: row.arrival,
      flagCeremony: row.flag_ceremony_configured
        ? (row.has_flag_ceremony ? { time: row.flag_ceremony_time, note: row.flag_ceremony_note } : null)
        : undefined,
      periods: [],
      breaks: [],
      grid: {},
    }
  }
  for (const session of SESSION_IDS) {
    if (!sessions[session]) sessions[session] = { periods: [], breaks: [], grid: {} }
  }
  for (const row of periodResult.data || []) {
    if (!sessions[row.session]) continue
    sessions[row.session].periods.push({
      id: row.period_id,
      start: row.start_time,
      end: row.end_time,
      ...(row.note ? { note: row.note } : {}),
    })
  }
  for (const row of breakResult.data || []) {
    if (!sessions[row.session]) continue
    sessions[row.session].breaks.push({
      after: row.after_period,
      start: row.start_time,
      end: row.end_time,
      label: row.label,
    })
  }
  for (const session of SESSION_IDS) {
    for (const dayId of DAY_IDS) sessions[session].grid[dayId] = []
  }
  for (const row of entryResult.data || []) {
    if (!sessions[row.session] || !DAY_IDS.includes(row.day_id)) continue
    sessions[row.session].grid[row.day_id][Number(row.period_id) - 1] = row.subject
  }

  const notice = noticeResult.data?.[0]
  const raw = {
    className: timetable.class_name,
    effectiveFrom: timetable.effective_from,
    subjects: timetable.subjects,
    days: timetable.days,
    morning: sessions.morning,
    afternoon: sessions.afternoon,
    changeNotice: notice
      ? {
          active: notice.active,
          hasChanges: notice.has_changes,
          from: notice.date_from,
          to: notice.date_to,
          summary: notice.summary,
          lines: notice.lines,
          createdAt: notice.created_at,
        }
      : null,
    updatedAt: timetable.updated_at,
  }
  return { id: timetable.id, timetable: normalizeTimetable(raw) }
}

async function writeOrThrow(operation, message) {
  const { error } = await operation
  if (error) throw databaseError(message, error)
}

export async function getTimetable() {
  const state = await selectRelationalState()
  if (!state) return normalizeTimetable(loadDefault())
  return clone(state.timetable)
}

export async function saveTimetable(payload) {
  const previousState = await selectRelationalState()
  const prev = previousState?.timetable || normalizeTimetable(loadDefault())
  const next = normalizeTimetable(payload)
  next.updatedAt = new Date().toISOString()

  const lines = diffTimetable(prev, next)
  const range = getApplicationRange()
  const fromISO = toISODate(range.from)
  const toISO = toISODate(range.to)
  const hasChanges = lines.length > 0

  next.changeNotice = {
    active: true,
    hasChanges,
    from: fromISO,
    to: toISO,
    summary: hasChanges
      ? `Có ${lines.length} thay đổi so với bản trước.`
      : 'Chưa có sự thay đổi',
    lines,
    createdAt: new Date().toISOString(),
  }

  // Cập nhật effectiveFrom theo tuần hiện tại (giữ tương thích cũ)
  next.effectiveFrom = fromISO

  const root = {
    ...(previousState?.id ? { id: previousState.id } : {}),
    class_name: next.className,
    effective_from: next.effectiveFrom || null,
    subjects: next.subjects,
    days: next.days,
    updated_at: next.updatedAt,
  }
  const { data: rootRows, error: rootError } = await supabaseAdmin
    .from('timetables')
    .upsert(root, { onConflict: previousState?.id ? 'id' : 'class_name' })
    .select('id')
    .single()
  if (rootError || !rootRows?.id) throw databaseError('Không thể lưu thời khoá biểu.', rootError || new Error('Thiếu id thời khoá biểu'))
  const timetableId = rootRows.id

  await writeOrThrow(
    supabaseAdmin.from('timetable_entries').delete().eq('timetable_id', timetableId),
    'Không thể cập nhật nội dung TKB.',
  )
  await writeOrThrow(
    supabaseAdmin.from('timetable_periods').delete().eq('timetable_id', timetableId),
    'Không thể cập nhật tiết học TKB.',
  )
  await writeOrThrow(
    supabaseAdmin.from('timetable_breaks').delete().eq('timetable_id', timetableId),
    'Không thể cập nhật giờ nghỉ TKB.',
  )
  await writeOrThrow(
    supabaseAdmin.from('timetable_sessions').delete().eq('timetable_id', timetableId),
    'Không thể cập nhật cấu hình phiên TKB.',
  )
  await writeOrThrow(
    supabaseAdmin.from('timetable_change_notices').delete().eq('timetable_id', timetableId),
    'Không thể cập nhật thông báo TKB.',
  )

  const sessionRows = SESSION_IDS.map((session) => {
    const value = next[session]
    return {
      timetable_id: timetableId,
      session,
      label: value.label,
      days_note: value.daysNote,
      arrival: value.arrival,
      has_flag_ceremony: Boolean(value.flagCeremony),
      flag_ceremony_configured: true,
      flag_ceremony_time: value.flagCeremony?.time || null,
      flag_ceremony_note: value.flagCeremony?.note || null,
    }
  })
  await writeOrThrow(
    supabaseAdmin.from('timetable_sessions').insert(sessionRows),
    'Không thể lưu cấu hình phiên TKB.',
  )

  const periods = []
  const breaks = []
  const entries = []
  for (const session of SESSION_IDS) {
    for (const period of next[session].periods) {
      periods.push({
        timetable_id: timetableId,
        session,
        period_id: Number(period.id),
        start_time: period.start,
        end_time: period.end,
        note: period.note || null,
      })
    }
    for (const item of next[session].breaks) {
      breaks.push({
        timetable_id: timetableId,
        session,
        after_period: Number(item.after),
        start_time: item.start,
        end_time: item.end,
        label: item.label || 'Giải lao',
      })
    }
    for (const dayId of DAY_IDS) {
      next[session].grid[dayId].forEach((subject, index) => {
        entries.push({
          timetable_id: timetableId,
          session,
          day_id: dayId,
          period_id: index + 1,
          subject: String(subject ?? ''),
        })
      })
    }
  }
  if (periods.length) {
    await writeOrThrow(supabaseAdmin.from('timetable_periods').insert(periods), 'Không thể lưu tiết học TKB.')
  }
  if (breaks.length) {
    await writeOrThrow(supabaseAdmin.from('timetable_breaks').insert(breaks), 'Không thể lưu giờ nghỉ TKB.')
  }
  if (entries.length) {
    await writeOrThrow(supabaseAdmin.from('timetable_entries').insert(entries), 'Không thể lưu nội dung TKB.')
  }
  await writeOrThrow(
    supabaseAdmin.from('timetable_change_notices').insert({
      timetable_id: timetableId,
      active: next.changeNotice.active,
      has_changes: next.changeNotice.hasChanges,
      date_from: next.changeNotice.from || null,
      date_to: next.changeNotice.to || null,
      summary: next.changeNotice.summary,
      lines: next.changeNotice.lines,
      created_at: next.changeNotice.createdAt,
    }),
    'Không thể lưu thông báo TKB.',
  )

  return clone(next)
}

/** Admin tắt thông báo thay đổi TKB (ẩn ở cả TKB và Thông báo chung) */
export async function dismissChangeNotice() {
  const currentState = await selectRelationalState()
  const current = currentState?.timetable || normalizeTimetable(loadDefault())
  if (!current.changeNotice || !current.changeNotice.active) return clone(current)

  current.changeNotice = {
    ...current.changeNotice,
    active: false,
  }
  current.updatedAt = new Date().toISOString()

  if (!currentState) return clone(current)
  await writeOrThrow(
    supabaseAdmin
      .from('timetables')
      .update({ updated_at: current.updatedAt })
      .eq('id', currentState.id),
    'Không thể cập nhật thời khoá biểu.',
  )
  await writeOrThrow(
    supabaseAdmin
      .from('timetable_change_notices')
      .update({ active: false })
      .eq('timetable_id', currentState.id)
      .eq('active', true),
    'Không thể ẩn thông báo TKB.',
  )
  return clone(current)
}
