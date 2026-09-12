import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import * as announcementsService from './announcements.service.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'homework.json'

let memoryCache = null

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

async function ensureDataBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(DATA_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(DATA_BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho dữ liệu lớp: ' + error.message, 502)
    }
  }
}

async function readStore() {
  const { data, error } = await supabaseAdmin.storage.from(DATA_BUCKET).download(DATA_PATH)
  if (error || !data) return { items: [] }
  try {
    const text = await data.text()
    const parsed = JSON.parse(text)
    return { items: Array.isArray(parsed.items) ? parsed.items : [] }
  } catch {
    return { items: [] }
  }
}

async function writeStore(store) {
  await ensureDataBucket()
  const body = Buffer.from(JSON.stringify(store, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(DATA_BUCKET).upload(DATA_PATH, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) {
    throw new AppError('Không lưu được báo bài: ' + error.message, 502)
  }
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
    created_at: String(raw.created_at || new Date().toISOString()),
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_by_name: String(raw.created_by_name || 'Admin').trim() || 'Admin',
  }
}

async function loadAll() {
  if (memoryCache) return clone(memoryCache)
  await ensureDataBucket()
  const store = await readStore()
  const items = store.items.map(normalizeItem).filter(Boolean)
  memoryCache = { items }
  return clone(memoryCache)
}

async function saveAll(items) {
  memoryCache = { items }
  await writeStore({ items })
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

/** Danh sách báo bài, mới nhất trước. Không tự xóa báo bài. */
export async function listHomework() {
  const data = await loadAll()
  return data.items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
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
  if (hasExam && examDate) {
    try {
      const content = buildExamReminderContent({
        examDate,
        subject: examSubject,
        examContent,
      })
      const ann = await announcementsService.createExamReminderAnnouncement(
        {
          content,
          expires_at: examExpiryISO(examDate),
          source_homework_id: homeworkId,
        },
        profile
      )
      examAnnouncementId = ann?.id || null
    } catch (err) {
      console.warn('[homework] không tạo được thông báo kiểm tra:', err.message)
    }
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
    created_at: new Date().toISOString(),
    created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
  }

  const data = await loadAll()
  const next = [item, ...data.items]
  await saveAll(next)
  return item
}

export async function deleteHomework(id) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã báo bài.', 400)

  const data = await loadAll()
  const found = data.items.find((row) => row.id === targetId)
  if (!found) throw new AppError('Không tìm thấy báo bài.', 404)

  // Xóa luôn thông báo kiểm tra liên quan trên tab Thông báo chung
  try {
    if (found.exam_announcement_id) {
      await announcementsService.deleteAnnouncement(found.exam_announcement_id).catch(() => {})
    }
    await announcementsService.deleteAnnouncementsByHomeworkId(targetId).catch(() => {})
  } catch (err) {
    console.warn('[homework] xóa thông báo kiểm tra liên quan thất bại:', err.message)
  }

  const next = data.items.filter((row) => row.id !== targetId)
  await saveAll(next)
  return { id: targetId }
}
