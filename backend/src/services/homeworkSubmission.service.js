import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

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
  return new AppError(`${fallback}: ${message || 'lỗi không xác định'}`, 500)
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

export async function listAssignments(profile) {
  const { data, error } = await supabaseAdmin
    .from('homework_assignments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw dataError(error, 'Không tải được danh sách bài tập')
  const rows = data || []
  if (!rows.length) return []

  const { data: subs, error: subError } = await supabaseAdmin
    .from('homework_submissions')
    .select('assignment_id, user_id, submitted_at, files')
    .in('assignment_id', rows.map((r) => r.id))
  if (subError) throw dataError(subError, 'Không tải được danh sách bài nộp')

  const countBy = {}
  const mineBy = {}
  for (const sub of subs || []) {
    countBy[sub.assignment_id] = (countBy[sub.assignment_id] || 0) + 1
    if (profile?.id && sub.user_id === profile.id) {
      mineBy[sub.assignment_id] = {
        submitted_at: sub.submitted_at,
        file_count: Array.isArray(sub.files) ? sub.files.length : 0,
      }
    }
  }

  return rows.map((row) => ({
    ...mapAssignment(row),
    submitted_count: countBy[row.id] || 0,
    my_submission: mineBy[row.id] || null,
  }))
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
  const { data: subs } = await supabaseAdmin
    .from('homework_submissions')
    .select('files')
    .eq('assignment_id', row.id)
  const paths = (subs || []).flatMap((s) => (Array.isArray(s.files) ? s.files.map((f) => f.path) : []))
  const { error } = await supabaseAdmin.from('homework_assignments').delete().eq('id', row.id)
  if (error) throw dataError(error, 'Không xóa được bài tập')
  await removeStoragePaths(paths)
  return { id: row.id }
}

function stripDataUrl(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^data:[^;,]+;base64,(.+)$/s)
  return match ? match[1].replace(/\s+/g, '') : raw.replace(/\s+/g, '')
}

function decodeFile(file) {
  const originalName = asText(file?.name).slice(0, 180) || 'file'
  const ext = originalName.includes('.')
    ? originalName.split('.').pop().replace(/[^a-z0-9]/gi, '').toLowerCase()
    : ''
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    throw new AppError(`File "${originalName}" không được hỗ trợ. Chỉ nhận ảnh, PDF, Word, Excel, PowerPoint, TXT.`, 400)
  }
  const encoded = stripDataUrl(file?.contentBase64)
  if (!encoded) throw new AppError(`File "${originalName}" không có dữ liệu.`, 400)
  const buffer = Buffer.from(encoded, 'base64')
  if (!buffer.length) throw new AppError(`File "${originalName}" trống.`, 400)
  if (buffer.length > MAX_FILE_BYTES) {
    throw new AppError(`File "${originalName}" vượt quá giới hạn 20MB.`, 400)
  }
  return { originalName, ext, mime, buffer }
}

export async function submitAssignment(assignmentId, files, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập để nộp bài.', 401)
  const assignment = await getAssignmentRow(assignmentId)

  const phase = phaseOf(assignment)
  if (phase === 'upcoming') throw new AppError('Chưa đến ngày nộp bài.', 400)
  if (phase === 'closed') throw new AppError('Đã hết hạn nộp bài.', 400)

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('homework_submissions')
    .select('id, files')
    .eq('assignment_id', assignment.id)
    .eq('user_id', profile.id)
    .maybeSingle()
  if (existingError) throw dataError(existingError, 'Không kiểm tra được bài đã nộp')
  if (existing && assignment.allow_resubmit !== true) {
    throw new AppError('Bài tập này không cho phép nộp lại.', 409)
  }

  const list = Array.isArray(files) ? files : []
  if (!list.length) throw new AppError('Chưa chọn ảnh hoặc file để nộp.')
  if (list.length > MAX_FILES) throw new AppError(`Mỗi lần nộp tối đa ${MAX_FILES} file.`)
  const decoded = list.map(decodeFile)

  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (bucketError || !bucket) {
    throw new AppError(`Kho dữ liệu "${BUCKET}" chưa được cấu hình trên Supabase.`, 503)
  }

  const uploaded = []
  const meta = []
  try {
    for (const file of decoded) {
      const path = `homework-submissions/${assignment.id}/${profile.id}/${randomUUID()}.${file.ext}`
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, file.buffer, { contentType: file.mime, upsert: false })
      if (uploadError) {
        throw new AppError('Không tải được file lên Supabase Storage: ' + uploadError.message, 502)
      }
      uploaded.push(path)
      meta.push({ path, name: file.originalName, mime: file.mime, size: file.buffer.length })
    }

    const submittedAt = new Date().toISOString()
    const { error: saveError } = await supabaseAdmin
      .from('homework_submissions')
      .upsert(
        [{
          assignment_id: assignment.id,
          user_id: profile.id,
          user_name: asText(profile.username) || null,
          files: meta,
          submitted_at: submittedAt,
        }],
        { onConflict: 'assignment_id,user_id' }
      )
    if (saveError) throw dataError(saveError, 'Không lưu được bài nộp')

    // Nộp lại: xóa file của lần nộp trước
    if (existing && Array.isArray(existing.files)) {
      await removeStoragePaths(existing.files.map((f) => f.path))
    }
    return { assignment_id: assignment.id, submitted_at: submittedAt, file_count: meta.length }
  } catch (err) {
    await removeStoragePaths(uploaded)
    throw err
  }
}

/** Ai đã nộp — mọi thành viên xem được (không kèm file). */
export async function getAssignmentStatus(id) {
  const assignment = await getAssignmentRow(id)
  const { data, error } = await supabaseAdmin
    .from('homework_submissions')
    .select('user_id, user_name, submitted_at, files')
    .eq('assignment_id', assignment.id)
  if (error) throw dataError(error, 'Không tải được tình trạng nộp bài')
  return {
    assignment: mapAssignment(assignment),
    submissions: (data || []).map((row) => ({
      user_id: row.user_id,
      user_name: row.user_name || null,
      submitted_at: row.submitted_at,
      file_count: Array.isArray(row.files) ? row.files.length : 0,
    })),
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
      user_id: data.user_id,
      user_name: data.user_name || null,
      submitted_at: data.submitted_at,
      files,
    },
  }
}
