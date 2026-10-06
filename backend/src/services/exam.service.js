import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { env } from '../config/env.js'
import { AppError } from './auth.service.js'
import { enqueueGradingJob, validateAnswerKey } from './ai-grading/index.js'
import { requestRegrade } from './ai-grading/review.service.js'

/**
 * "Bài tập về nhà → Kiểm tra" và "Quản lý lớp → Kiểm tra".
 * Bảng: class_exams, class_exam_attempts, class_exam_submissions (+ intents)
 *       → supabase/migrations/202610050001_class_exams.sql
 * File nằm ở bucket private `classroom-data`:
 *   class-exams/images/…          ảnh đề (admin)
 *   class-exams/submissions/…     bài làm của học sinh
 * Cách lưu/xác minh file giống homeworkSubmission.service.js (signed upload URL → complete).
 */

const BUCKET = 'classroom-data'

// Giới hạn file học sinh nộp
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 //  10MB / ảnh
const MAX_PDF_BYTES = 30 * 1024 * 1024 //    30MB / PDF
const MAX_TOTAL_BYTES = 50 * 1024 * 1024 //  50MB / 1 người
const MAX_FILES = 20
// Giới hạn ảnh đề (admin)
const MAX_EXAM_IMAGES = 20
const SIGNED_VIEW_SECONDS = 6 * 60 * 60

const SUBMIT_TYPES = Object.freeze({
  jpg: { mime: 'image/jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', kind: 'image' },
  png: { mime: 'image/png', kind: 'image' },
  webp: { mime: 'image/webp', kind: 'image' },
  heic: { mime: 'image/heic', kind: 'image' },
  heif: { mime: 'image/heif', kind: 'image' },
  pdf: { mime: 'application/pdf', kind: 'pdf' },
})
const EXAM_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp'])

const asText = (v) => String(v ?? '').trim()

const GRADING_QUEUE_STATUSES = ['pending', 'processing', 'completed', 'needs_review', 'failed', 'rate_limited']

export function buildGradingQueueStatus({ examId, aiEnabled, hasAnswerKey, submissionCount, jobs = [] }) {
  const queue = Object.fromEntries(GRADING_QUEUE_STATUSES.map((status) => [status, 0]))
  for (const job of jobs) if (Object.hasOwn(queue, job.status)) queue[job.status] += 1
  queue.not_queued = Math.max(0, Number(submissionCount || 0) - jobs.length)
  const processing = queue.processing > 0
  return {
    exam_id: examId,
    ai_enabled: aiEnabled === true,
    has_answer_key: hasAnswerKey === true,
    submission_count: Number(submissionCount || 0),
    queue,
    worker_status: processing ? 'processing' : 'unavailable',
    usage: { available: false },
  }
}

export function selectGradingCandidates(submissions, jobs) {
  const bySubmission = new Map((jobs || []).map((job) => [String(job.submission_id), job]))
  const candidates = []
  const skipped = []
  for (const submission of submissions || []) {
    const job = bySubmission.get(String(submission.id))
    if (!job || ['failed', 'rate_limited', 'needs_review'].includes(job.status)) candidates.push({ submission, job: job || null })
    else skipped.push({ submission, job })
  }
  return { candidates, skipped }
}

function extOf(name) {
  const s = asText(name)
  return s.includes('.') ? s.split('.').pop().replace(/[^a-z0-9]/gi, '').toLowerCase() : ''
}

function phaseOf(row, nowMs = Date.now()) {
  if (nowMs < Date.parse(row.open_at)) return 'upcoming' // Sắp mở
  if (nowMs >= Date.parse(row.close_at)) return 'closed' //  Đã kết thúc
  return 'open' //                                          Đang mở
}

function dataError(error, fallback) {
  const message = String(error?.message || '')
  if (/class_exam/i.test(message) && /(does not exist|schema cache)/i.test(message)) {
    return new AppError('Tính năng kiểm tra chưa được cấu hình. Admin cần chạy 202610050001_class_exams.sql.', 503)
  }
  console.error('[exam] database operation failed', { code: error?.code || 'UNKNOWN', message: message.slice(0, 200) })
  return new AppError(`${fallback}. Vui lòng thử lại sau.`, 500)
}

async function removeStoragePaths(paths) {
  const list = (paths || []).filter(Boolean)
  if (!list.length) return
  try { await supabaseAdmin.storage.from(BUCKET).remove(list) } catch { /* best-effort */ }
}

async function signedUrl(path) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGNED_VIEW_SECONDS)
  if (error) throw new AppError('Không tạo được liên kết file.', 502)
  return data?.signedUrl || null
}

async function getExamRow(id) {
  const key = asText(id)
  if (!key) throw new AppError('Thiếu mã bài kiểm tra.', 400)
  const { data, error } = await supabaseAdmin.from('class_exams').select('*').eq('id', key).maybeSingle()
  if (error) throw dataError(error, 'Không tải được bài kiểm tra')
  if (!data) throw new AppError('Không tìm thấy bài kiểm tra.', 404)
  return data
}

async function getAttempt(examId, userId) {
  const { data, error } = await supabaseAdmin.from('class_exam_attempts')
    .select('started_at, deadline_at').eq('exam_id', examId).eq('user_id', userId).maybeSingle()
  if (error) throw dataError(error, 'Không đọc được lượt làm bài')
  return data || null
}

/** Thông tin công khai của đề (không có nội dung/ảnh đề). */
function mapExam(row) {
  return {
    id: row.id,
    title: row.title,
    duration_minutes: row.duration_minutes,
    open_at: row.open_at,
    close_at: row.close_at,
    phase: phaseOf(row),
    image_count: Array.isArray(row.images) ? row.images.length : 0,
    created_by_name: row.created_by_name || null,
    created_at: row.created_at,
  }
}

/* ------------------------------------------------------------------ */
/* Danh sách / chi tiết                                                */
/* ------------------------------------------------------------------ */
export async function listExams(profile) {
  const { data, error } = await supabaseAdmin.from('class_exams').select('*').order('open_at', { ascending: false }).limit(200)
  if (error) throw dataError(error, 'Không tải được danh sách bài kiểm tra')
  const rows = data || []
  const server_now = new Date().toISOString()
  if (!rows.length) return { items: [], server_now }
  const { data: summary, error: summaryError } = await supabaseAdmin.rpc('class_exam_summary', {
    p_exam_ids: rows.map((r) => r.id), p_user_id: profile?.id || null,
  })
  if (summaryError) throw dataError(summaryError, 'Không tải được tình trạng bài kiểm tra')
  const byId = new Map((summary || []).map((s) => [s.exam_id, s]))
  return {
    server_now,
    items: rows.map((row) => {
      const s = byId.get(row.id)
      return {
        ...mapExam(row),
        submitted_count: Number(s?.submitted_count) || 0,
        my_attempt: s?.my_started_at ? { started_at: s.my_started_at, deadline_at: s.my_deadline_at } : null,
        my_submission: s?.my_submitted_at ? { submitted_at: s.my_submitted_at, file_count: Number(s.my_file_count) || 0 } : null,
      }
    }),
  }
}

/** Chi tiết 1 đề. Nội dung + ảnh đề CHỈ trả khi đã bấm Bắt đầu (hoặc là người quản lý). */
export async function getExam(id, profile, { isManager = false } = {}) {
  const row = await getExamRow(id)
  const attempt = await getAttempt(row.id, profile.id)
  const canSeeContent = isManager || Boolean(attempt)
  const exam = mapExam(row)
  if (canSeeContent) {
    exam.content = row.content || ''
    exam.images = await Promise.all((Array.isArray(row.images) ? row.images : []).map(async (img) => ({
      name: img.name, url: await signedUrl(img.path),
    })))
  }
  const { data: sub, error } = await supabaseAdmin.from('class_exam_submissions')
    .select('id, submitted_at, files').eq('exam_id', row.id).eq('user_id', profile.id).maybeSingle()
  if (error) throw dataError(error, 'Không đọc được bài đã nộp')
  return {
    exam, attempt, server_now: new Date().toISOString(),
    my_submission: sub ? {
      id: sub.id,
      submitted_at: sub.submitted_at,
      files: (Array.isArray(sub.files) ? sub.files : []).map((f) => ({ name: f.name, size: f.size })),
    } : null,
  }
}

/* ------------------------------------------------------------------ */
/* Bắt đầu làm bài (đồng hồ chạy ở server)                             */
/* ------------------------------------------------------------------ */
export async function startExam(id, profile) {
  const row = await getExamRow(id)
  const { data, error } = await supabaseAdmin.rpc('class_exam_start', { p_exam_id: row.id, p_user_id: profile.id })
  if (error) {
    const m = String(error.message || '')
    if (m.includes('EXAM_NOT_OPEN')) throw new AppError('Bài kiểm tra chưa đến giờ mở.', 400)
    if (m.includes('EXAM_CLOSED')) throw new AppError('Bài kiểm tra đã kết thúc.', 400)
    throw dataError(error, 'Không bắt đầu được bài kiểm tra')
  }
  const attempt = Array.isArray(data) ? data[0] : data
  return { attempt: { started_at: attempt.started_at, deadline_at: attempt.deadline_at }, server_now: attempt.server_now || new Date().toISOString() }
}

/* ------------------------------------------------------------------ */
/* Nộp bài (học sinh)                                                  */
/* ------------------------------------------------------------------ */
function normalizeManifest(files) {
  const list = Array.isArray(files) ? files : []
  if (!list.length) throw new AppError('Chưa chọn ảnh hoặc file để nộp.')
  if (list.length > MAX_FILES) throw new AppError(`Mỗi lần nộp tối đa ${MAX_FILES} file.`)
  let total = 0
  const out = list.map((file) => {
    const name = asText(file?.name).slice(0, 180) || 'file'
    const ext = extOf(name)
    const type = SUBMIT_TYPES[ext]
    const size = Number(file?.size)
    if (!type) throw new AppError(`File "${name}" không được hỗ trợ. Chỉ nhận ảnh (JPG, PNG, WEBP, HEIC) và PDF.`, 400)
    if (!Number.isSafeInteger(size) || size < 1) throw new AppError(`File "${name}" bị rỗng.`, 400)
    const limit = type.kind === 'pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES
    if (size > limit) throw new AppError(`File "${name}" vượt quá ${type.kind === 'pdf' ? '30MB (PDF)' : '10MB (ảnh)'}.`, 400)
    total += size
    return { name, ext, mime: type.mime, size }
  })
  if (total > MAX_TOTAL_BYTES) throw new AppError('Tổng dung lượng bài nộp vượt quá 50MB.', 400)
  return out
}

async function assertCanSubmit(examId, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập để nộp bài.', 401)
  const exam = await getExamRow(examId)
  const attempt = await getAttempt(exam.id, profile.id)
  if (!attempt) throw new AppError('Bạn chưa bắt đầu làm bài này.', 400)
  if (Date.now() >= Date.parse(attempt.deadline_at)) throw new AppError('Đã hết thời gian làm bài.', 400)
  return exam
}

export async function createSubmissionUploadIntent(examId, files, profile) {
  const exam = await assertCanSubmit(examId, profile)
  const manifest = normalizeManifest(files)
  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (bucketError || !bucket) throw new AppError(`Kho dữ liệu "${BUCKET}" chưa được cấu hình trên Supabase.`, 503)

  const { data: intent, error: intentError } = await supabaseAdmin.from('class_exam_upload_intents')
    .insert({ exam_id: exam.id, user_id: profile.id }).select('id, expires_at').single()
  if (intentError) throw dataError(intentError, 'Không tạo được phiên tải file')
  const fileRows = manifest.map((file) => ({
    intent_id: intent.id,
    storage_path: `class-exams/submissions/${exam.id}/${profile.id}/${randomUUID()}.${file.ext}`,
    original_name: file.name, mime_type: file.mime, size_bytes: file.size,
  }))
  const { error: rowsError } = await supabaseAdmin.from('class_exam_upload_intent_files').insert(fileRows)
  if (rowsError) {
    await supabaseAdmin.from('class_exam_upload_intents').delete().eq('id', intent.id)
    throw dataError(rowsError, 'Không lưu được metadata file')
  }
  const signedFiles = []
  try {
    for (const file of fileRows) {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(file.storage_path, { upsert: false })
      if (error || !data?.token) throw new AppError('Không tạo được liên kết tải file an toàn.', 502)
      signedFiles.push({ path: file.storage_path, token: data.token, name: file.original_name, mime: file.mime_type })
    }
  } catch (error) {
    await supabaseAdmin.from('class_exam_upload_intents').delete().eq('id', intent.id)
    throw error
  }
  return { intent_id: intent.id, expires_at: intent.expires_at, files: signedFiles }
}

async function verifyObjects(items) {
  for (const file of items) {
    const slash = file.storage_path.lastIndexOf('/')
    const folder = file.storage_path.slice(0, slash)
    const filename = file.storage_path.slice(slash + 1)
    const { data: objects, error } = await supabaseAdmin.storage.from(BUCKET).list(folder, { search: filename, limit: 20 })
    if (error || !(objects || []).some((o) => o.name === filename && Number(o.metadata?.size) === Number(file.size_bytes))) {
      throw new AppError(`Không xác minh được file "${file.original_name}". Hãy thử tải lại.`, 400)
    }
  }
}

export async function completeSubmissionUpload(examId, intentId, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập để nộp bài.', 401)
  const { data: intent, error: intentError } = await supabaseAdmin.from('class_exam_upload_intents')
    .select('id, exam_id, user_id, expires_at').eq('id', asText(intentId))
    .eq('exam_id', asText(examId)).eq('user_id', profile.id).maybeSingle()
  if (intentError) throw dataError(intentError, 'Không đọc được phiên tải file')
  if (!intent || Date.parse(intent.expires_at) <= Date.now()) throw new AppError('Phiên tải file đã hết hạn. Hãy tải lại file.', 410)
  const { data: intentFiles, error: filesError } = await supabaseAdmin.from('class_exam_upload_intent_files')
    .select('storage_path, original_name, mime_type, size_bytes').eq('intent_id', intent.id).order('id')
  if (filesError) throw dataError(filesError, 'Không đọc được metadata file')
  if (!intentFiles?.length || intentFiles.length > MAX_FILES) throw new AppError('Danh sách file tải lên không hợp lệ.', 400)

  await verifyObjects(intentFiles)

  const { data: committed, error: commitError } = await supabaseAdmin.rpc('class_exam_commit_submission', {
    p_intent_id: intent.id, p_user_id: profile.id, p_user_name: asText(profile.username),
  })
  if (commitError) {
    const m = String(commitError.message || '')
    // Hết giờ / chưa bắt đầu: xoá file đã tải lên, không ghi nhận
    if (m.includes('EXAM_TIME_UP')) { await removeStoragePaths(intentFiles.map((f) => f.storage_path)); throw new AppError('Đã hết thời gian làm bài.', 400) }
    if (m.includes('EXAM_NOT_STARTED')) throw new AppError('Bạn chưa bắt đầu làm bài này.', 400)
    if (m.includes('UPLOAD_INTENT_EXPIRED')) throw new AppError('Phiên tải file đã hết hạn. Hãy tải lại file.', 410)
    console.error('[exam] atomic commit failed', { code: commitError.code })
    await removeStoragePaths(intentFiles.map((f) => f.storage_path))
    throw new AppError('Không lưu được bài nộp. Vui lòng thử lại sau.', 503)
  }
  const oldFiles = Array.isArray(committed?.old_files) ? committed.old_files : []
  await removeStoragePaths(oldFiles.map((f) => f.path)) // nộp lại → xoá file cũ
  // Never make the successful submission response depend on AI queue availability.
  try {
    const { data: submission, error } = await supabaseAdmin.from('class_exam_submissions')
      .select('id, files').eq('exam_id', examId).eq('user_id', profile.id).single()
    if (error) throw error
    await enqueueGradingJob({ submissionType: 'exam', submissionId: submission.id, userId: profile.id, examId, files: submission.files || [] })
  } catch (error) {
    console.error('[exam] AI grading enqueue failed', { message: String(error?.message || 'unknown').slice(0, 300) })
  }
  return { exam_id: examId, submitted_at: committed.submitted_at, file_count: Number(committed.file_count) || intentFiles.length }
}

export async function cancelSubmissionUpload(intentId, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập.', 401)
  const { data: intent, error } = await supabaseAdmin.from('class_exam_upload_intents')
    .select('id').eq('id', asText(intentId)).eq('user_id', profile.id).maybeSingle()
  if (error) throw dataError(error, 'Không thể hủy phiên tải file')
  if (!intent) throw new AppError('Không tìm thấy phiên tải file.', 404)
  const { data: files } = await supabaseAdmin.from('class_exam_upload_intent_files').select('storage_path').eq('intent_id', intent.id)
  await supabaseAdmin.from('class_exam_upload_intents').delete().eq('id', intent.id).eq('user_id', profile.id)
  await removeStoragePaths((files || []).map((f) => f.storage_path))
  return { id: asText(intentId), cancelled: true }
}

/* ------------------------------------------------------------------ */
/* Thống kê (mọi thành viên) + chi tiết bài nộp (người quản lý)        */
/* ------------------------------------------------------------------ */
export async function getExamStatus(id) {
  const exam = await getExamRow(id)
  const { data, error } = await supabaseAdmin.from('class_exam_submissions')
    .select('id, user_id, user_name, submitted_at, files').eq('exam_id', exam.id)
    .order('submitted_at', { ascending: false }).limit(500)
  if (error) throw dataError(error, 'Không tải được thống kê')
  return {
    exam: mapExam(exam),
    submissions: (data || []).map((r) => ({
      id: r.id, user_id: r.user_id, user_name: r.user_name || null, submitted_at: r.submitted_at,
      file_count: Array.isArray(r.files) ? r.files.length : 0,
    })),
  }
}

async function loadExamAnswerKey(examId) {
  const { data, error } = await supabaseAdmin.from('class_exam_questions')
    .select('id, question_number, question_text, max_score, expected_answer, rubric')
    .eq('exam_id', examId).order('question_number').limit(200)
  if (error) throw dataError(error, 'Không tải được answer key và rubric')
  if (!data?.length) return { rows: [], valid: false }
  try {
    return { rows: data, valid: Boolean(validateAnswerKey(data.map((row) => ({ question_id: row.id, ...row }))).length) }
  } catch {
    return { rows: data, valid: false }
  }
}

function mapAnswerKeyRows(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    question_number: row.question_number,
    question_text: row.question_text,
    max_score: row.max_score,
    expected_answer: row.expected_answer,
    rubric: Array.isArray(row.rubric) ? row.rubric : [],
  }))
}

export async function getExamAnswerKey(id) {
  const exam = await getExamRow(id)
  const answerKey = await loadExamAnswerKey(exam.id)
  return { exam_id: exam.id, questions: mapAnswerKeyRows(answerKey.rows) }
}

export async function saveExamAnswerKey(id, rawQuestions) {
  const exam = await getExamRow(id)
  const input = Array.isArray(rawQuestions) ? rawQuestions : []
  const questions = input.length
    ? validateAnswerKey(input.map((question) => ({
      ...question,
      question_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(question.question_id || question.id || ''))
        ? (question.question_id || question.id)
        : randomUUID(),
    })))
    : []

  const { error: deleteError } = await supabaseAdmin.from('class_exam_questions').delete().eq('exam_id', exam.id)
  if (deleteError) throw dataError(deleteError, 'Không xóa được answer key cũ')
  if (questions.length) {
    const { error: insertError } = await supabaseAdmin.from('class_exam_questions').insert(questions.map((question) => ({
      id: question.question_id,
      exam_id: exam.id,
      question_number: question.question_number,
      question_text: question.question_text,
      max_score: question.max_score,
      expected_answer: question.expected_answer,
      rubric: question.rubric,
    })))
    if (insertError) throw dataError(insertError, 'Không lưu được answer key và rubric')
  }
  return {
    exam_id: exam.id,
    questions: mapAnswerKeyRows(questions.map((question) => ({ id: question.question_id, ...question }))),
  }
}

async function loadExamSubmissions(examId) {
  const { data, error } = await supabaseAdmin.from('class_exam_submissions')
    .select('id, user_id, files').eq('exam_id', examId).order('submitted_at').limit(1000)
  if (error) throw dataError(error, 'Không tải được danh sách bài nộp')
  return data || []
}

async function loadExamJobs(examId) {
  const { data, error } = await supabaseAdmin.from('ai_grading_jobs')
    .select('id, submission_id, status, attempt_count, result').eq('exam_id', examId).limit(1000)
  if (error) throw dataError(error, 'Không tải được trạng thái hàng chờ AI')
  return data || []
}

export async function getExamGradingStatus(id) {
  const exam = await getExamRow(id)
  const [submissions, jobs, answerKey] = await Promise.all([
    loadExamSubmissions(exam.id), loadExamJobs(exam.id), loadExamAnswerKey(exam.id),
  ])
  return buildGradingQueueStatus({
    examId: exam.id,
    aiEnabled: env.AI_GRADING_ENABLED,
    hasAnswerKey: answerKey.valid,
    submissionCount: submissions.length,
    jobs,
  })
}

export async function startExamGrading(id, profile) {
  const exam = await getExamRow(id)
  if (!env.AI_GRADING_ENABLED) throw new AppError('AI grading hiện chưa được bật trên backend.', 503)
  const answerKey = await loadExamAnswerKey(exam.id)
  if (!answerKey.valid) throw new AppError('Chưa có answer key/rubric hợp lệ. AI chưa thể chấm.', 409)
  const [submissions, jobs] = await Promise.all([loadExamSubmissions(exam.id), loadExamJobs(exam.id)])
  const { candidates, skipped } = selectGradingCandidates(submissions, jobs)
  let enqueued = 0
  for (const { submission, job } of candidates) {
    if (job) await requestRegrade('exam', submission.id, profile)
    else await enqueueGradingJob({ submissionType: 'exam', submissionId: submission.id, userId: submission.user_id, examId: exam.id, files: submission.files || [] })
    enqueued += 1
  }
  return {
    enqueued,
    skipped: skipped.length,
    message: enqueued ? `Đã đưa ${enqueued} bài vào hàng chờ AI.` : 'Không có bài nào cần đưa vào hàng chờ AI.',
  }
}

export async function getSubmissionDetail(examId, userId) {
  const exam = await getExamRow(examId)
  const { data, error } = await supabaseAdmin.from('class_exam_submissions')
    .select('*').eq('exam_id', exam.id).eq('user_id', asText(userId)).maybeSingle()
  if (error) throw dataError(error, 'Không tải được bài nộp')
  if (!data) throw new AppError('Học sinh này chưa nộp bài.', 404)
  const files = await Promise.all((Array.isArray(data.files) ? data.files : []).map(async (f) => ({
    name: f.name, mime: f.mime, size: f.size,
    is_image: String(f.mime || '').startsWith('image/') && f.mime !== 'image/heic' && f.mime !== 'image/heif',
    url: await signedUrl(f.path),
  })))
  return {
    exam: mapExam(exam),
    submission: { id: data.id, user_id: data.user_id, user_name: data.user_name || null, submitted_at: data.submitted_at, files },
  }
}

/* ------------------------------------------------------------------ */
/* Quản lý (Admin / người có quyền homework)                           */
/* ------------------------------------------------------------------ */
/** Bước 1 tạo đề: xin link upload ảnh đề. Bước 2: gọi createExam kèm path đã upload. */
export async function createExamImageUploadUrls(files) {
  const list = Array.isArray(files) ? files : []
  if (!list.length) throw new AppError('Chưa chọn ảnh.')
  if (list.length > MAX_EXAM_IMAGES) throw new AppError(`Tối đa ${MAX_EXAM_IMAGES} ảnh đề.`)
  const uploads = []
  for (const file of list) {
    const name = asText(file?.name).slice(0, 180) || 'de.jpg'
    const ext = extOf(name)
    const size = Number(file?.size)
    if (!EXAM_IMAGE_EXT.has(ext)) throw new AppError(`Ảnh "${name}" không hợp lệ (chỉ JPG, PNG, WEBP).`)
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_IMAGE_BYTES) throw new AppError(`Ảnh "${name}" vượt quá 10MB.`)
    const path = `class-exams/images/${randomUUID()}.${ext}`
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false })
    if (error || !data?.token) throw new AppError('Không tạo được liên kết tải ảnh.', 502)
    uploads.push({ path, token: data.token, name, mime: SUBMIT_TYPES[ext].mime, size })
  }
  return { bucket: BUCKET, uploads }
}

export async function createExam(payload, profile) {
  const title = asText(payload?.title).slice(0, 200)
  if (!title) throw new AppError('Vui lòng nhập tiêu đề bài kiểm tra.')
  const content = asText(payload?.content).slice(0, 20000)
  const duration = Number.parseInt(payload?.duration_minutes, 10)
  if (!Number.isInteger(duration) || duration < 1 || duration > 600) throw new AppError('Thời gian làm bài phải từ 1 đến 600 phút.')
  const openMs = Date.parse(payload?.open_at)
  const closeMs = Date.parse(payload?.close_at)
  if (!Number.isFinite(openMs)) throw new AppError('Thời điểm bắt đầu mở đề không hợp lệ.')
  if (!Number.isFinite(closeMs)) throw new AppError('Hạn chót không hợp lệ.')
  if (closeMs <= openMs) throw new AppError('Hạn chót phải sau thời điểm bắt đầu mở đề.')
  if (closeMs <= Date.now()) throw new AppError('Hạn chót phải ở tương lai.')

  const rawImages = Array.isArray(payload?.images) ? payload.images : []
  if (rawImages.length > MAX_EXAM_IMAGES) throw new AppError(`Tối đa ${MAX_EXAM_IMAGES} ảnh đề.`)
  if (!content && !rawImages.length) throw new AppError('Cần nhập nội dung đề hoặc thêm ít nhất 1 ảnh đề.')
  const images = rawImages.map((img) => {
    const path = asText(img?.path)
    const ext = extOf(path)
    if (!/^class-exams\/images\/[0-9a-f-]{36}\.[a-z]+$/.test(path) || !EXAM_IMAGE_EXT.has(ext)) throw new AppError('Ảnh đề không hợp lệ.')
    return { path, name: asText(img?.name).slice(0, 180) || 'de', mime: SUBMIT_TYPES[ext].mime, size: Number(img?.size) || 0 }
  })
  await verifyObjects(images.map((i) => ({ storage_path: i.path, original_name: i.name, size_bytes: i.size })))

  const rawQuestions = Array.isArray(payload?.questions) ? payload.questions : []
  const questions = rawQuestions.length
    ? validateAnswerKey(rawQuestions.map((question) => ({ ...question, question_id: question.question_id || randomUUID() })))
    : []

  const { data, error } = await supabaseAdmin.from('class_exams').insert({
    title, content, images, duration_minutes: duration,
    open_at: new Date(openMs).toISOString(), close_at: new Date(closeMs).toISOString(),
    created_by: profile?.id || null, created_by_name: asText(profile?.username) || null,
  }).select('*').single()
  if (error) {
    await removeStoragePaths(images.map((i) => i.path))
    throw dataError(error, 'Không tạo được bài kiểm tra')
  }
  if (questions.length) {
    const { error: questionError } = await supabaseAdmin.from('class_exam_questions').insert(questions.map((question) => ({
      exam_id: data.id,
      question_number: question.question_number,
      question_text: question.question_text,
      max_score: question.max_score,
      expected_answer: question.expected_answer,
      rubric: question.rubric,
    })))
    if (questionError) {
      await supabaseAdmin.from('class_exams').delete().eq('id', data.id)
      await removeStoragePaths(images.map((i) => i.path))
      throw dataError(questionError, 'Không lưu được answer key và rubric')
    }
  }
  return { ...mapExam(data), submitted_count: 0, my_attempt: null, my_submission: null }
}

export async function deleteExam(id) {
  const row = await getExamRow(id)
  const paths = (Array.isArray(row.images) ? row.images : []).map((i) => i.path)
  let from = 0
  for (;;) {
    const { data: subs, error } = await supabaseAdmin.from('class_exam_submissions').select('files')
      .eq('exam_id', row.id).range(from, from + 99)
    if (error) throw dataError(error, 'Không đọc được bài nộp để dọn dẹp')
    for (const s of subs || []) if (Array.isArray(s.files)) paths.push(...s.files.map((f) => f.path))
    if (!subs || subs.length < 100) break
    from += 100
  }
  const { data: pending } = await supabaseAdmin.from('class_exam_upload_intents').select('id').eq('exam_id', row.id)
  if (pending?.length) {
    const { data: pf } = await supabaseAdmin.from('class_exam_upload_intent_files').select('storage_path').in('intent_id', pending.map((p) => p.id))
    paths.push(...(pf || []).map((f) => f.storage_path))
  }
  const { error } = await supabaseAdmin.from('class_exams').delete().eq('id', row.id)
  if (error) throw dataError(error, 'Không xóa được bài kiểm tra')
  await removeStoragePaths(paths)
  return { id: row.id }
}
