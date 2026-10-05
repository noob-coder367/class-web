import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import * as announcementsService from './announcements.service.js'

const HOMEWORK_TABLE = 'homework_notices'
const HOMEWORK_SELECT = 'id,title,report_date,has_exam,exam_date,exam_subject,exam_content,experiment_content,homework_content,exam_announcement_id,announcement_short_id,exam_today_notified_at,exam_cleared_at,created_at,created_by,created_by_name'
function throwDb(error, operation) {
  if (error) throw new AppError(`${operation}: ${error.message || 'lỗi cơ sở dữ liệu.'}`, 500)
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  return {
    id,
    title: String(raw.title || '').trim() || 'Báo bài',
    report_date: raw.report_date ? String(raw.report_date).slice(0, 10) : null,
    has_exam: raw.has_exam === true,
    exam_date: raw.exam_date ? String(raw.exam_date).slice(0, 10) : null,
    exam_subject: String(raw.exam_subject || '').trim(),
    exam_content: String(raw.exam_content || '').trim(),
    experiment_content: String(raw.experiment_content || '').trim(),
    homework_content: String(raw.homework_content || '').trim(),
    exam_announcement_id: raw.exam_announcement_id ? String(raw.exam_announcement_id) : null,
    announcement_short_id: Number(raw.announcement_short_id) > 0 ? Number(raw.announcement_short_id) : null,
    exam_today_notified_at: raw.exam_today_notified_at ? String(raw.exam_today_notified_at) : null,
    exam_cleared_at: raw.exam_cleared_at ? String(raw.exam_cleared_at) : null,
    created_at: String(raw.created_at || new Date().toISOString()),
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_by_name: String(raw.created_by_name || 'Admin').trim() || 'Admin',
  }
}


function defaultTitleForDate(isoDate) {
  if (!isoDate) return 'Báo bài'
  const [y, m, d] = String(isoDate).split('-')
  if (!y || !m || !d) return 'Báo bài'
  return `Báo bài ngày ${d}/${m}/${y}`
}

function formatVNDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Hết ngày kiểm tra (00:00 ngày hôm sau theo local VN ≈ UTC+7) → hết hạn thông báo */
function examExpiryISO(examDateISO) {
  const [y, m, d] = String(examDateISO).slice(0, 10).split('-').map(Number)
  // 00:00 ngày hôm sau (VN) = 17:00 UTC ngày kiểm tra
  const expiry = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 7 * 60 * 60 * 1000)
  return expiry.toISOString()
}

function buildExamReminderContent({ examDate, subject, examContent }) {
  const today = new Date()
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  let whenPhrase
  if (examDate === todayISO) {
    whenPhrase = 'hôm nay'
  } else if (examDate === tomorrowISO) {
    whenPhrase = 'ngày mai'
  } else {
    whenPhrase = `ngày ${formatVNDate(examDate)}`
  }

  const subjectPart = subject ? ` môn ${subject}` : ''
  let text = `🚨 Bạn có bài kiểm tra${subjectPart} vào ${whenPhrase}!`
  if (examContent) {
    text += `\n\n${examContent}`
  }
  return text
}

function buildImportantHomeworkContent({ title, experimentContent, homeworkContent, reportDate }) {
  const parts = [`📚 ${title || 'Báo bài quan trọng'}`]
  if (reportDate) parts.push(`Ngày báo bài: ${formatVNDate(reportDate)}`)
  if (experimentContent) parts.push(`Thí nghiệm:\n${experimentContent}`)
  if (homeworkContent) parts.push(`Bài tập về nhà:\n${homeworkContent}`)
  return parts.join('\n\n')
}

/** Danh sách báo bài, mới nhất trước. Không tự xóa báo bài. */
export async function listHomeworkPage(options = {}) {
  const page = Math.min(10000, Math.max(1, Number.parseInt(options.page, 10) || 1))
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(options.pageSize, 10) || 100))
  let query = supabaseAdmin.from(HOMEWORK_TABLE).select(HOMEWORK_SELECT, { count: 'exact' }).order('created_at', { ascending: false })
  if (options.reportDate) query = query.eq('report_date', String(options.reportDate).slice(0, 10))
  if (options.hasExam === 'true' || options.hasExam === true) query = query.eq('has_exam', true)
  const from = (page - 1) * pageSize
  const { data, error, count } = await query.range(from, from + pageSize - 1)
  throwDb(error, 'Không thể tải danh sách báo bài')
  const items = (data || []).map(normalizeItem).filter(Boolean)
  return { items, pagination: { page, pageSize, total: count || 0, hasMore: from + items.length < (count || 0) } }
}

export async function listHomework(options = {}) {
  return (await listHomeworkPage(options)).items
}

function itemToDb(item) {
  return {
    id: item.id, title: item.title, report_date: item.report_date, has_exam: item.has_exam,
    exam_date: item.exam_date, exam_subject: item.exam_subject, exam_content: item.exam_content,
    experiment_content: item.experiment_content, homework_content: item.homework_content,
    exam_announcement_id: item.exam_announcement_id, announcement_short_id: item.announcement_short_id,
    exam_today_notified_at: item.exam_today_notified_at, exam_cleared_at: item.exam_cleared_at,
    created_at: item.created_at, created_by: item.created_by, created_by_name: item.created_by_name,
  }
}

/**
 * payload: {
 *   title?, report_date?, has_exam, exam_date?, exam_subject?, exam_content?,
 *   experiment_content?, homework_content?
 * }
 */
export async function createHomework(payload, profile) {
  const hasExam = payload?.has_exam === true
  const examContent = String(payload?.exam_content || '').trim()
  const examSubject = String(payload?.exam_subject || '').trim()
  const experimentContent = String(payload?.experiment_content || '').trim()
  const homeworkContent = String(payload?.homework_content || '').trim()

  let examDate = null
  if (hasExam) {
    if (!examContent) throw new AppError('Vui lòng nhập nội dung kiểm tra.')
    if (!examSubject) throw new AppError('Vui lòng chọn hoặc nhập môn kiểm tra.')
    if (!payload?.exam_date) throw new AppError('Vui lòng chọn ngày kiểm tra.')
    const t = new Date(String(payload.exam_date).slice(0, 10))
    if (Number.isNaN(t.getTime())) throw new AppError('Ngày kiểm tra không hợp lệ.')
    examDate = String(payload.exam_date).slice(0, 10)
  }

  if (!experimentContent && !homeworkContent && !(hasExam && examContent)) {
    throw new AppError('Vui lòng nhập ít nhất một nội dung (kiểm tra / thí nghiệm / BTVN).')
  }

  let reportDate = null
  if (payload?.report_date) {
    const t = new Date(String(payload.report_date).slice(0, 10))
    if (Number.isNaN(t.getTime())) {
      throw new AppError('Ngày báo bài không hợp lệ.')
    }
    reportDate = String(payload.report_date).slice(0, 10)
  } else {
    const now = new Date()
    reportDate = now.toISOString().slice(0, 10)
  }

  let title = String(payload?.title || '').trim()
  if (!title) title = defaultTitleForDate(reportDate)

  const homeworkId = randomUUID()

  let examAnnouncementId = null
  let announcementShortId = null
  if (hasExam && examDate) {
    const content = buildExamReminderContent({ examDate, subject: examSubject, examContent })
    const ann = await announcementsService.createExamReminderAnnouncement(
      { title, content, expires_at: examExpiryISO(examDate), source_homework_id: homeworkId },
      profile
    )
    examAnnouncementId = ann?.id || null
    announcementShortId = ann?.short_id || null
  } else if (experimentContent || homeworkContent) {
    // Báo bài thường (không phải exam reminder) → ô "Báo bài quan trọng".
    const ann = await announcementsService.createImportantHomeworkAnnouncement(
      {
        title,
        content: buildImportantHomeworkContent({ title, experimentContent, homeworkContent, reportDate }),
        source_homework_id: homeworkId,
      },
      profile
    )
    examAnnouncementId = ann?.id || null
    announcementShortId = ann?.short_id || null
  }

  const item = {
    id: homeworkId,
    title,
    report_date: reportDate,
    has_exam: hasExam,
    exam_date: hasExam ? examDate : null,
    exam_subject: hasExam ? examSubject : '',
    exam_content: hasExam ? examContent : '',
    experiment_content: experimentContent,
    homework_content: homeworkContent,
    exam_announcement_id: examAnnouncementId,
    announcement_short_id: announcementShortId,
    created_at: new Date().toISOString(),
    created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
  }

  const { error } = await supabaseAdmin.from(HOMEWORK_TABLE).insert(itemToDb(item))
  if (error) {
    if (examAnnouncementId) {
      try { await announcementsService.deleteAnnouncement(examAnnouncementId) } catch {}
    }
    throwDb(error, 'Không thể lưu báo bài')
  }
  return item
}

export async function deleteHomework(id) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã báo bài.', 400)
  const read = await supabaseAdmin.from(HOMEWORK_TABLE).select(HOMEWORK_SELECT).eq('id', targetId).maybeSingle()
  throwDb(read.error, 'Không thể đọc báo bài')
  if (!read.data) throw new AppError('Không tìm thấy báo bài.', 404)
  const found = normalizeItem(read.data)
  const removed = await supabaseAdmin.from(HOMEWORK_TABLE).delete().eq('id', targetId)
  throwDb(removed.error, 'Không thể xoá báo bài')
  if (found.exam_announcement_id) await announcementsService.deleteAnnouncement(found.exam_announcement_id)
  await announcementsService.deleteAnnouncementsByHomeworkId(targetId)
  return { id: targetId }
}

const PATCHABLE = new Set(['exam_announcement_id', 'exam_today_notified_at', 'exam_cleared_at'])

/** Cập nhật vài field hệ thống trên báo bài (scheduler nhắc kiểm tra). Không đụng nội dung bài. */
export async function patchHomework(id, fields) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã báo bài.', 400)
  const nextFields = {}
  for (const [key, value] of Object.entries(fields || {})) {
    if (PATCHABLE.has(key)) nextFields[key] = value == null ? null : String(value)
  }
  const result = await supabaseAdmin.from(HOMEWORK_TABLE).update(nextFields).eq('id', targetId).select(HOMEWORK_SELECT).maybeSingle()
  throwDb(result.error, 'Không thể cập nhật báo bài')
  if (!result.data) throw new AppError('Không tìm thấy báo bài.', 404)
  return normalizeItem(result.data)
}
