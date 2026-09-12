import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

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
    exam_content: String(raw.exam_content || '').trim(),
    experiment_content: String(raw.experiment_content || '').trim(),
    homework_content: String(raw.homework_content || '').trim(),
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

/** Danh sách báo bài, mới nhất trước. Không tự xóa. */
export async function listHomework() {
  const data = await loadAll()
  return data.items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

/**
 * payload: {
 *   title?, report_date?, has_exam, exam_content?, experiment_content?, homework_content?
 * }
 */
export async function createHomework(payload, profile) {
  const hasExam = payload?.has_exam === true
  const examContent = String(payload?.exam_content || '').trim()
  const experimentContent = String(payload?.experiment_content || '').trim()
  const homeworkContent = String(payload?.homework_content || '').trim()

  if (hasExam && !examContent) {
    throw new AppError('Vui lòng nhập nội dung kiểm tra.')
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

  const item = {
    id: randomUUID(),
    title,
    report_date: reportDate,
    has_exam: hasExam,
    exam_content: hasExam ? examContent : '',
    experiment_content: experimentContent,
    homework_content: homeworkContent,
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

  const next = data.items.filter((row) => row.id !== targetId)
  await saveAll(next)
  return { id: targetId }
}
