import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { enqueueGradingJob } from './ai-grading/index.js'

/**
 * "Bài tập về nhà → Nộp bài".
 * Bảng: homework_assignments, homework_submissions (supabase/homework-submission-schema.sql).
 * File nộp nằm trong bucket classroom-data, thư mục homework-submissions/.
 */

const BUCKET = 'classroom-data'
const MAX_FILES = 10
const MAX_FILE_BYTES = 20 * 1024 * 1024
const TZ = 'Asia/Ho_Chi_Minh'

const MIME_BY_EXT = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
})

function asText(value) {
  return String(value ?? '').trim()
}

function isValidISODate(value) {
  const s = asText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

/** upcoming = chưa đến ngày nộp · open = đang nhận bài · closed = hết hạn */
function phaseOf(row) {
  const today = todayISO()
  const start = String(row.start_date).slice(0, 10)
  const end = String(row.end_date).slice(0, 10)
  if (today < start) return 'upcoming'
  if (today > end) return 'closed'
  return 'open'
}

function dataError(error, fallback) {
  const message = String(error?.message || '')
  if (/relation .*homework_(assignments|submissions).* does not exist/i.test(message)
    || /could not find the table ['"]?public\.homework_(assignments|submissions)['"]? in the schema cache/i.test(message)) {
    return new AppError('Tính năng nộp bài chưa được cấu hình. Admin cần chạy homework-submission-schema.sql.', 503)
  }
  console.error('[homework-submission] database operation failed', { code: error?.code || 'UNKNOWN' })
  return new AppError(`${fallback}. Vui lòng thử lại sau.`, 500)
}

function mapAssignment(row) {
  return {
    id: row.id,
    title: row.title,
    start_date: String(row.start_date).slice(0, 10),
    end_date: String(row.end_date).slice(0, 10),
    allow_resubmit: row.allow_resubmit === true,
    phase: phaseOf(row),
    created_by_name: row.created_by_name || null,
    created_at: row.created_at,
  }
}

async function getAssignmentRow(id) {
  const key = asText(id)
  if (!key) throw new AppError('Thiếu mã bài tập.', 400)
  const { data, error } = await supabaseAdmin
    .from('homework_assignments')
    .select('*')
    .eq('id', key)
    .maybeSingle()
  if (error) throw dataError(error, 'Không tải được bài tập')
  if (!data) throw new AppError('Không tìm thấy bài tập.', 404)
  return data
}

async function removeStoragePaths(paths) {
  const list = (paths || []).filter(Boolean)
  if (!list.length) return
  try {
    await supabaseAdmin.storage.from(BUCKET).remove(list)
  } catch {
    /* best-effort */
  }
}

export async function listAssignments(profile, { page = 1, pageSize = 50 } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const safeSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 50))
  const from = (safePage - 1) * safeSize
  const { data, error, count } = await supabaseAdmin
    .from('homework_assignments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + safeSize - 1)
  if (error) throw dataError(error, 'Không tải được danh sách bài tập')
  const rows = data || []
  if (!rows.length) return { items: [], pagination: { page: safePage, pageSize: safeSize, total: count || 0, hasMore: false } }
  const { data: summary, error: summaryError } = await supabaseAdmin.rpc('homework_assignment_summary', {
    p_assignment_ids: rows.map((row) => row.id), p_user_id: profile?.id || null,
  })
  if (summaryError) throw dataError(summaryError, 'Không tải được tình trạng bài nộp')
  const byId = new Map((summary || []).map((row) => [row.assignment_id, row]))
  let ownSubmissions = []
  if (profile?.id) {
    const { data: own, error: ownError } = await supabaseAdmin.from('homework_submissions')
      .select('id, assignment_id, submitted_at, files').in('assignment_id', rows.map((row) => row.id)).eq('user_id', profile.id).limit(200)
    if (ownError) throw dataError(ownError, 'Không tải được bài đã nộp')
    ownSubmissions = own || []
  }
  const ownByAssignment = new Map(ownSubmissions.map((row) => [row.assignment_id, row]))
  return {
    items: rows.map((row) => {
      const stats = byId.get(row.id)
      return { ...mapAssignment(row), submitted_count: Number(stats?.submitted_count) || 0,
        my_submission: ownByAssignment.has(row.id) ? {
          id: ownByAssignment.get(row.id).id,
          submitted_at: ownByAssignment.get(row.id).submitted_at,
          file_count: Array.isArray(ownByAssignment.get(row.id).files) ? ownByAssignment.get(row.id).files.length : 0,
        } : stats?.my_submitted_at ? { submitted_at: stats.my_submitted_at, file_count: Number(stats.my_file_count) || 0 } : null }
    }),
    pagination: { page: safePage, pageSize: safeSize, total: count || 0, hasMore: from + rows.length < (count || 0) },
  }
}

export async function createAssignment(payload, profile) {
  const title = asText(payload?.title).slice(0, 200)
  if (!title) throw new AppError('Vui lòng nhập tiêu đề bài tập.')
  if (!isValidISODate(payload?.start_date)) throw new AppError('Ngày bắt đầu nộp không hợp lệ.')
  if (!isValidISODate(payload?.end_date)) throw new AppError('Ngày kết thúc nộp không hợp lệ.')
  if (payload.end_date < payload.start_date) {
    throw new AppError('Ngày kết thúc nộp phải sau hoặc bằng ngày bắt đầu.')
  }

  const row = {
    title,
    start_date: payload.start_date,
    end_date: payload.end_date,
    allow_resubmit: payload?.allow_resubmit === true,
    created_by: profile?.id || null,
    created_by_name: asText(profile?.username) || null,
  }
  const { data, error } = await supabaseAdmin
    .from('homework_assignments')
    .insert(row)
    .select('*')
    .single()
  if (error) throw dataError(error, 'Không tạo được bài tập')
  return { ...mapAssignment(data), submitted_count: 0, my_submission: null }
}

export async function deleteAssignment(id) {
  const row = await getAssignmentRow(id)
  const paths = []
  let from = 0
  const batchSize = 100
  while (true) {
    const { data: subs, error: readError } = await supabaseAdmin
      .from('homework_submissions').select('files').eq('assignment_id', row.id)
      .range(from, from + batchSize - 1)
    if (readError) throw dataError(readError, 'Không đọc được file bài nộp để dọn dẹp')
    for (const submission of subs || []) {
      if (Array.isArray(submission.files)) paths.push(...submission.files.map((file) => file.path).filter(Boolean))
    }
    if (!subs || subs.length < batchSize) break
    from += batchSize
  }
  const { error } = await supabaseAdmin.from('homework_assignments').delete().eq('id', row.id)
  if (error) throw dataError(error, 'Không xóa được bài tập')
  await removeStoragePaths(paths)
  return { id: row.id }
}

function normalizeManifest(files) {
  const list = Array.isArray(files) ? files : []
  if (!list.length) throw new AppError('Chưa chọn ảnh hoặc file để nộp.')
  if (list.length > MAX_FILES) throw new AppError(`Mỗi lần nộp tối đa ${MAX_FILES} file.`)
  return list.map((file) => {
    const name = asText(file?.name).slice(0, 180) || 'file'
    const ext = name.includes('.') ? name.split('.').pop().replace(/[^a-z0-9]/gi, '').toLowerCase() : ''
    const mime = MIME_BY_EXT[ext]
    const size = Number(file?.size)
    if (!mime) throw new AppError(`File "${name}" không được hỗ trợ. Chỉ nhận ảnh, PDF, Word, Excel, PowerPoint, TXT.`, 400)
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_BYTES) throw new AppError(`File "${name}" vượt quá giới hạn 20MB hoặc rỗng.`, 400)
    return { name, ext, mime, size }
  })
}

async function assertSubmissionOpen(assignmentId, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập để nộp bài.', 401)
  const assignment = await getAssignmentRow(assignmentId)
  const phase = phaseOf(assignment)
  if (phase === 'upcoming') throw new AppError('Chưa đến ngày nộp bài.', 400)
  if (phase === 'closed') throw new AppError('Đã hết hạn nộp bài.', 400)
  const { data: existing, error } = await supabaseAdmin.from('homework_submissions')
    .select('id, files').eq('assignment_id', assignment.id).eq('user_id', profile.id).maybeSingle()
  if (error) throw dataError(error, 'Không kiểm tra được bài đã nộp')
  if (existing && assignment.allow_resubmit !== true) throw new AppError('Bài tập này không cho phép nộp lại.', 409)
  return { assignment, existing }
}

export async function createSubmissionUploadIntent(assignmentId, files, profile) {
  const { assignment } = await assertSubmissionOpen(assignmentId, profile)
  const manifest = normalizeManifest(files)
  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (bucketError || !bucket) throw new AppError(`Kho dữ liệu "${BUCKET}" chưa được cấu hình trên Supabase.`, 503)

  const { data: intent, error: intentError } = await supabaseAdmin.from('homework_upload_intents')
    .insert({ assignment_id: assignment.id, user_id: profile.id }).select('id, expires_at').single()
  if (intentError) throw dataError(intentError, 'Không tạo được phiên tải file')
  const fileRows = manifest.map((file) => ({
    intent_id: intent.id,
    storage_path: `homework-submissions/${assignment.id}/${profile.id}/${randomUUID()}.${file.ext}`,
    original_name: file.name, mime_type: file.mime, size_bytes: file.size,
  }))
  const { error: rowsError } = await supabaseAdmin.from('homework_upload_intent_files').insert(fileRows)
  if (rowsError) {
    await supabaseAdmin.from('homework_upload_intents').delete().eq('id', intent.id)
    throw dataError(rowsError, 'Không lưu được metadata file')
  }
  const signedFiles = []
  try {
    for (let i = 0; i < fileRows.length; i += 1) {
      const file = fileRows[i]
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(file.storage_path, { upsert: false })
      if (error || !data?.token || !data?.signedUrl) throw new AppError('Không tạo được liên kết tải file an toàn.', 502)
      signedFiles.push({ path: file.storage_path, token: data.token, signedUrl: data.signedUrl, name: file.original_name, mime: file.mime_type })
    }
  } catch (error) {
    await supabaseAdmin.from('homework_upload_intents').delete().eq('id', intent.id)
    throw error
  }
  return { intent_id: intent.id, expires_at: intent.expires_at, files: signedFiles }
}

export async function completeSubmissionUpload(assignmentId, intentId, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập để nộp bài.', 401)
  const { data: intent, error: intentError } = await supabaseAdmin.from('homework_upload_intents')
    .select('id, assignment_id, user_id, expires_at').eq('id', asText(intentId))
    .eq('assignment_id', asText(assignmentId)).eq('user_id', profile.id).maybeSingle()
  if (intentError) throw dataError(intentError, 'Không đọc được phiên tải file')
  if (!intent || Date.parse(intent.expires_at) <= Date.now()) throw new AppError('Phiên tải file đã hết hạn. Hãy tải lại file.', 410)
  const { data: intentFiles, error: filesError } = await supabaseAdmin.from('homework_upload_intent_files')
    .select('storage_path, original_name, mime_type, size_bytes').eq('intent_id', intent.id).order('id')
  if (filesError) throw dataError(filesError, 'Không đọc được metadata file')
  if (!intentFiles?.length || intentFiles.length > MAX_FILES) throw new AppError('Danh sách file tải lên không hợp lệ.', 400)

  for (const file of intentFiles) {
    const slash = file.storage_path.lastIndexOf('/')
    const folder = file.storage_path.slice(0, slash)
    const filename = file.storage_path.slice(slash + 1)
    const { data: objects, error } = await supabaseAdmin.storage.from(BUCKET).list(folder, { search: filename, limit: 20 })
    if (error || !(objects || []).some((object) => object.name === filename && Number(object.metadata?.size) === Number(file.size_bytes))) {
      throw new AppError(`Không xác minh được file "${file.original_name}". Hãy thử tải lại.`, 400)
    }
  }

  const assignment = await getAssignmentRow(assignmentId)
  const today = todayISO()
  const { data: committed, error: commitError } = await supabaseAdmin.rpc('homework_commit_submission', {
    p_intent_id: intent.id, p_user_id: profile.id,
    p_user_name: asText(profile.username), p_today: today,
  })
  if (commitError) {
    const message = String(commitError.message || '')
    if (message.includes('ASSIGNMENT_CLOSED')) throw new AppError('Đã hết hạn nộp bài.', 400)
    if (message.includes('RESUBMIT_NOT_ALLOWED')) throw new AppError('Bài tập này không cho phép nộp lại.', 409)
    if (message.includes('UPLOAD_INTENT_EXPIRED')) throw new AppError('Phiên tải file đã hết hạn. Hãy tải lại file.', 410)
    console.error('[homework-submission] atomic commit failed', { code: commitError.code })
    await removeStoragePaths(intentFiles.map((file) => file.storage_path))
    throw new AppError('Không lưu được bài nộp. Vui lòng thử lại sau.', 503)
  }
  const oldFiles = Array.isArray(committed?.old_files) ? committed.old_files : []
  await removeStoragePaths(oldFiles.map((file) => file.path))
  // AI grading is strictly best-effort and starts only after the DB commit.
  try {
    const { data: submission, error } = await supabaseAdmin.from('homework_submissions')
      .select('id, files').eq('assignment_id', assignment.id).eq('user_id', profile.id).single()
    if (error) throw error
    await enqueueGradingJob({ submissionType: 'homework', submissionId: submission.id, userId: profile.id, assignmentId: assignment.id, files: submission.files || [] })
  } catch (error) {
    console.error('[homework-submission] AI grading enqueue failed', { message: String(error?.message || 'unknown').slice(0, 300) })
  }
  return { assignment_id: assignment.id, submitted_at: committed.submitted_at, file_count: Number(committed.file_count) || intentFiles.length }
}

export async function cancelSubmissionUpload(intentId, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập.', 401)
  const { data: intent, error: intentError } = await supabaseAdmin.from('homework_upload_intents')
    .select('id').eq('id', asText(intentId)).eq('user_id', profile.id).maybeSingle()
  if (intentError) throw dataError(intentError, 'Không thể hủy phiên tải file')
  if (!intent) throw new AppError('Không tìm thấy phiên tải file.', 404)
  const { data: files, error } = await supabaseAdmin.from('homework_upload_intent_files')
    .select('storage_path').eq('intent_id', intent.id)
  if (error) throw dataError(error, 'Không thể hủy phiên tải file')
  const { error: deleteError } = await supabaseAdmin.from('homework_upload_intents')
    .delete().eq('id', intent.id).eq('user_id', profile.id)
  if (deleteError) throw dataError(deleteError, 'Không thể hủy phiên tải file')
  await removeStoragePaths((files || []).map((file) => file.storage_path))
  return { id: asText(intentId), cancelled: true }
}

/** Ai đã nộp — mọi thành viên xem được (không kèm file). */
export async function getAssignmentStatus(id, { page = 1, pageSize = 50 } = {}) {
  const assignment = await getAssignmentRow(id)
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const safeSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 50))
  const from = (safePage - 1) * safeSize
  const { data, error, count } = await supabaseAdmin
    .from('homework_submissions')
    .select('user_id, user_name, submitted_at, files', { count: 'exact' })
    .eq('assignment_id', assignment.id)
    .order('submitted_at', { ascending: false })
    .range(from, from + safeSize - 1)
  if (error) throw dataError(error, 'Không tải được tình trạng nộp bài')
  const rows = data || []
  return {
    assignment: mapAssignment(assignment),
    submissions: rows.map((row) => ({ id: row.id, user_id: row.user_id, user_name: row.user_name || null,
      submitted_at: row.submitted_at, file_count: Array.isArray(row.files) ? row.files.length : 0 })),
    pagination: { page: safePage, pageSize: safeSize, total: count || 0, hasMore: from + rows.length < (count || 0) },
  }
}

/** Chi tiết bài nộp của 1 học sinh (kèm link file) — chỉ Admin / LPHT. */
export async function getSubmissionDetail(assignmentId, userId) {
  const assignment = await getAssignmentRow(assignmentId)
  const { data, error } = await supabaseAdmin
    .from('homework_submissions')
    .select('*')
    .eq('assignment_id', assignment.id)
    .eq('user_id', asText(userId))
    .maybeSingle()
  if (error) throw dataError(error, 'Không tải được bài nộp')
  if (!data) throw new AppError('Học sinh này chưa nộp bài.', 404)

  const files = await Promise.all((Array.isArray(data.files) ? data.files : []).map(async (f) => {
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(f.path, 3600)
    if (signedError) throw new AppError('Không tạo được liên kết file.', 502)
    return {
      name: f.name,
      mime: f.mime,
      size: f.size,
      is_image: String(f.mime || '').startsWith('image/'),
      url: signed?.signedUrl || null,
    }
  }))

  return {
    assignment: mapAssignment(assignment),
    submission: {
      id: data.id,
      user_id: data.user_id,
      user_name: data.user_name || null,
      submitted_at: data.submitted_at,
      files,
    },
  }
}
