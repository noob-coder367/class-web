import { supabaseAdmin } from '../src/config/supabaseClient.js'

const BUCKET = 'classroom-data'
const FILE_PATH = 'timetable.json'
const DAY_IDS = ['t2', 't3', 't4', 't5', 't6', 't7']

function fail(message, error) {
  console.error(message, error?.message || error)
  process.exit(1)
}

async function readTimetableFromStorage() {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(FILE_PATH)

  if (error) throw error
  if (!data) throw new Error('Storage trả về file rỗng.')

  const text = await data.text()
  return JSON.parse(text)
}

async function migrate() {
  console.log('1/6 Đọc timetable.json từ Storage...')
  const timetable = await readTimetableFromStorage()

  const className = String(timetable.className || '').trim()
  if (!className) throw new Error('timetable.json thiếu className.')

  console.log(`   Lớp: ${className}`)

  console.log('2/6 Tạo/cập nhật timetables...')
  const { data: timetableRow, error: timetableError } = await supabaseAdmin
    .from('timetables')
    .upsert({
      class_name: className,
      effective_from: timetable.effectiveFrom || null,
      subjects: Array.isArray(timetable.subjects) ? timetable.subjects : [],
      days: Array.isArray(timetable.days) ? timetable.days : [],
      updated_at: timetable.updatedAt || new Date().toISOString(),
    }, { onConflict: 'class_name' })
    .select('id')
    .single()

  if (timetableError) throw timetableError

  const timetableId = timetableRow.id

  // Xóa dữ liệu con cũ của đúng TKB này để migration có thể chạy lại an toàn.
  console.log('3/6 Đồng bộ periods + breaks...')
  const { error: deletePeriodsError } = await supabaseAdmin
    .from('timetable_periods')
    .delete()
    .eq('timetable_id', timetableId)
  if (deletePeriodsError) throw deletePeriodsError

  const { error: deleteBreaksError } = await supabaseAdmin
    .from('timetable_breaks')
    .delete()
    .eq('timetable_id', timetableId)
  if (deleteBreaksError) throw deleteBreaksError

  const periods = []
  const breaks = []

  for (const session of ['morning', 'afternoon']) {
    const src = timetable[session] || {}

    for (const period of Array.isArray(src.periods) ? src.periods : []) {
      periods.push({
        timetable_id: timetableId,
        session,
        period_id: Number(period.id),
        start_time: period.start,
        end_time: period.end,
        note: period.note || null,
      })
    }

    for (const item of Array.isArray(src.breaks) ? src.breaks : []) {
      breaks.push({
        timetable_id: timetableId,
        session,
        after_period: Number(item.after),
        start_time: item.start,
        end_time: item.end,
        label: item.label || 'Giải lao',
      })
    }
  }

  if (periods.length) {
    const { error } = await supabaseAdmin
      .from('timetable_periods')
      .insert(periods)
    if (error) throw error
  }

  if (breaks.length) {
    const { error } = await supabaseAdmin
      .from('timetable_breaks')
      .insert(breaks)
    if (error) throw error
  }

  console.log('4/6 Chuyển toàn bộ grid thành timetable_entries...')
  const { error: deleteEntriesError } = await supabaseAdmin
    .from('timetable_entries')
    .delete()
    .eq('timetable_id', timetableId)
  if (deleteEntriesError) throw deleteEntriesError

  const entries = []

  for (const session of ['morning', 'afternoon']) {
    const src = timetable[session] || {}
    const grid = src.grid && typeof src.grid === 'object' ? src.grid : {}

    for (const dayId of DAY_IDS) {
      const cells = Array.isArray(grid[dayId]) ? grid[dayId] : []

      cells.forEach((subject, index) => {
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

  if (entries.length) {
    const { error } = await supabaseAdmin
      .from('timetable_entries')
      .insert(entries)
    if (error) throw error
  }

  console.log('5/6 Chuyển changeNotice...')
  const { error: deleteNoticeError } = await supabaseAdmin
    .from('timetable_change_notices')
    .delete()
    .eq('timetable_id', timetableId)
  if (deleteNoticeError) throw deleteNoticeError

  const notice = timetable.changeNotice || {}
  const { error: noticeError } = await supabaseAdmin
    .from('timetable_change_notices')
    .insert({
      timetable_id: timetableId,
      active: Boolean(notice.active),
      has_changes: Boolean(notice.hasChanges),
      date_from: notice.dateFrom || null,
      date_to: notice.dateTo || null,
      summary: String(notice.summary || 'Chưa có sự thay đổi'),
      lines: Array.isArray(notice.lines) ? notice.lines : [],
      created_at: notice.createdAt || new Date().toISOString(),
    })

  if (noticeError) throw noticeError

  console.log('6/6 Kiểm tra số lượng dữ liệu...')
  const counts = {}

  for (const [table, label] of [
    ['timetable_periods', 'periods'],
    ['timetable_breaks', 'breaks'],
    ['timetable_entries', 'entries'],
    ['timetable_change_notices', 'change notices'],
  ]) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('timetable_id', timetableId)

    if (error) throw error
    counts[label] = count ?? 0
  }

  console.log('======================================')
  console.log('MIGRATION TIMETABLE HOÀN TẤT')
  console.log(`class: ${className}`)
  console.log(`timetable_id: ${timetableId}`)
  console.log(`periods: ${counts.periods}`)
  console.log(`breaks: ${counts.breaks}`)
  console.log(`entries: ${counts.entries}`)
  console.log(`change notices: ${counts['change notices']}`)
  console.log('Storage timetable.json vẫn được giữ nguyên.')
  console.log('======================================')
}

migrate().catch((error) => fail('Migration thất bại:', error))
