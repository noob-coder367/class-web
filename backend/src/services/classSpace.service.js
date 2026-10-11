import { randomUUID, createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { isAdminRole } from '../lib/roles.js'

const IMAGE_BUCKET = 'class-space-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function hashPassword(raw) {
  return createHash('sha256').update(String(raw || '')).digest('hex')
}

// Mã phòng: 6 chữ số, sinh ngẫu nhiên và đảm bảo không trùng với phòng khác
// (kể cả phòng riêng tư / công khai / đang ẩn trong lớp), dùng để vào phòng
// nhanh từ ô nhập mã ở đầu trang, không phụ thuộc việc phòng có hiện trong
// danh sách "Lớp học" hay không.
function generateRoomCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
}


async function ensureImageBucket() {
  const { data, error } =
    await supabaseAdmin.storage.getBucket(IMAGE_BUCKET)

  if (error || !data) {
    throw new AppError(
      `Kho ảnh "${IMAGE_BUCKET}" chưa được cấu hình trên Supabase.`,
      500
    )
  }
}

function publicImageUrl(path) {
  const { data } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

function throwDatabaseError(error, operation) {
  if (!error) return
  console.error(`[class-space] ${operation} failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  })
  throw new AppError(`Không thể ${operation} dữ liệu lớp học.`, 503)
}

async function readRelationalItems({ id, profileId } = {}) {
  let rootQuery = supabaseAdmin.from('class_spaces').select('*').order('created_at', { ascending: false })
  if (id) rootQuery = rootQuery.eq('id', id)
  rootQuery = rootQuery.range(0, id ? 0 : 99)
  const roots = await rootQuery
  throwDatabaseError(roots.error, 'đọc')
  const rows = roots.data || []
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const baseQueries = [
    supabaseAdmin.from('class_space_questions').select('class_space_id, position, question').in('class_space_id', ids).order('position').range(0, 999),
    supabaseAdmin.from('class_space_editors').select('class_space_id, user_id, email, username').in('class_space_id', ids).range(0, 1999),
    supabaseAdmin.from('class_space_results').select('class_space_id, user_id, user_name, correct, total, duration_ms, completed_at').in('class_space_id', ids).order('correct', { ascending: false }).order('duration_ms', { ascending: true, nullsFirst: false }).order('completed_at', { ascending: true }).range(0, 99),
  ]
  if (profileId) baseQueries.push(
    supabaseAdmin.from('class_space_results').select('class_space_id, user_id, user_name, correct, total, duration_ms, completed_at').in('class_space_id', ids).eq('user_id', String(profileId)).range(0, 99),
    supabaseAdmin.from('class_space_attempts').select('class_space_id, user_id, started_at').in('class_space_id', ids).eq('user_id', String(profileId)).range(0, 99),
  )
  const [questions, editors, results, ownResults, ownAttempts] = await Promise.all([
    ...baseQueries,
    ...Array.from({ length: Math.max(0, 5 - baseQueries.length) }, () => Promise.resolve({ data: [], error: null })),
  ])
  throwDatabaseError(questions.error, 'đọc câu hỏi')
  throwDatabaseError(editors.error, 'đọc editor')
  throwDatabaseError(results.error, 'đọc kết quả')
  throwDatabaseError(ownResults.error, 'đọc kết quả cá nhân')
  throwDatabaseError(ownAttempts.error, 'đọc lượt làm bài')
  const byId = (values) => {
    const map = new Map()
    for (const value of values || []) {
      const list = map.get(value.class_space_id) || []
      list.push(value)
      map.set(value.class_space_id, list)
    }
    return map
  }
  const questionMap = byId(questions.data), editorMap = byId(editors.data)
  const resultMap = byId([...(results.data || []), ...(ownResults.data || [])])
  const attemptMap = byId(ownAttempts.data)
  return rows.map((row) => {
    const rawResults = Object.fromEntries((resultMap.get(row.id) || []).map((result) => [result.user_id, {
      userId: result.user_id, userName: result.user_name, correct: result.correct, total: result.total,
      durationMs: result.duration_ms, completedAt: result.completed_at,
    }]))
    const rawAttempts = Object.fromEntries((attemptMap.get(row.id) || []).map((attempt) => [attempt.user_id, { startedAt: attempt.started_at }]))
    return normalizeItem({
      id: row.id, code: row.code, title: row.title, cover: row.cover,
      backdropType: row.backdrop_type, backdropTheme: row.backdrop_theme, backdropImage: row.backdrop_image,
      isPublic: row.is_public, visibleInClass: row.visible_in_class, passwordHash: row.password_hash, password: row.password,
      shuffle: row.shuffle, allowRetry: row.allow_retry, allowMultiTry: row.allow_multi_try,
      autoAdvanceMultiTry: row.auto_advance_multi_try, showEssayHints: row.show_essay_hints,
      enableLeaderboard: row.enable_leaderboard,
      questions: (questionMap.get(row.id) || []).sort((a, b) => a.position - b.position).map((question) => question.question),
      questionCount: Number(row.question_count) || 0, results: rawResults, attempts: rawAttempts,
      editors: (editorMap.get(row.id) || []).map((editor) => ({ userId: editor.user_id, email: editor.email, username: editor.username })),
      ownerId: row.owner_id, ownerName: row.owner_name, createdAt: row.created_at, updatedAt: row.updated_at,
    })
  }).filter(Boolean)
}

async function loadRoom(id, profileId) {
  const items = await readRelationalItems({ id, profileId })
  const item = items[0] || null
  if (item && !item.code) {
    item.code = generateRoomCode()
    await saveItem(item, item.updatedAt)
  }
  return item
}

async function saveItem(item, expectedUpdatedAt = null) {
  const result = await supabaseAdmin.rpc('replace_class_space', { p_item: item, p_expected_updated_at: expectedUpdatedAt })
  if (result.error?.message?.includes('CLASS_SPACE_STALE')) throw new AppError('Phòng học đã được người khác cập nhật. Hãy tải lại trước khi lưu.', 409)
  throwDatabaseError(result.error, 'ghi')
  if (typeof result.data === 'string' && result.data) item.code = result.data
}

async function readUtilityRoster() {
  const [meta, members] = await Promise.all([
    supabaseAdmin.from('utility_rosters').select('file_name, updated_at').eq('id', 'default').maybeSingle(),
    supabaseAdmin.from('utility_roster_members').select('student_number, name, position').eq('roster_id', 'default').order('position').range(0, 99),
  ])
  throwDatabaseError(meta.error, 'đọc metadata danh sách PDF')
  throwDatabaseError(members.error, 'đọc danh sách PDF')
  return {
    names: (members.data || []).map((row, index) => ({ stt: row.student_number || index + 1, name: row.name })),
    fileName: String(meta.data?.file_name || ''), updatedAt: String(meta.data?.updated_at || ''),
  }
}

async function writeUtilityRoster(roster) {
  const result = await supabaseAdmin.rpc('replace_utility_roster', {
    p_file_name: roster.fileName, p_updated_at: roster.updatedAt, p_names: roster.names,
  })
  throwDatabaseError(result.error, 'ghi danh sách PDF')
}

function normalizeBackdrop(raw) {
  const type = raw?.backdropType === 'theme' || raw?.backdropType === 'image' ? raw.backdropType : ''
  const theme = String(raw?.backdropTheme || '').trim()
  const image = String(raw?.backdropImage || '')
  const allowedThemes = new Set([
    'sky',
    'ocean',
    'sunset',
    'night',
    'forest',
    'aurora',
    'sakura',
    'desert',
    'lavender',
    'rain',
    'galaxy',
    'meadow',
  ])
  if (type === 'theme' && allowedThemes.has(theme)) {
    return { backdropType: 'theme', backdropTheme: theme, backdropImage: '' }
  }
  if (type === 'image' && image) {
    return { backdropType: 'image', backdropTheme: '', backdropImage: image }
  }
  return { backdropType: '', backdropTheme: '', backdropImage: '' }
}

function normalizeResults(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const list = Array.isArray(src) ? src : Object.values(src)
  const out = {}
  for (const row of list) {
    const userId = String(row?.userId || '').trim()
    if (!userId) continue
    const total = Math.max(0, Math.floor(Number(row.total) || 0))
    const correct = Math.max(0, Math.min(total, Math.floor(Number(row.correct) || 0)))
    const durationMs =
      row.durationMs === null || row.durationMs === undefined
        ? null
        : Math.max(0, Math.floor(Number(row.durationMs)) || 0)
    out[userId] = {
      userId,
      userName: String(row.userName || 'Ẩn danh').trim() || 'Ẩn danh',
      correct,
      total,
      durationMs,
      completedAt: String(row.completedAt || new Date().toISOString()),
    }
  }
  return out
}

// Mốc thời gian bắt đầu làm bài của từng người (theo userId) — do SERVER ghi nhận
// khi gọi startClassSpaceAttempt, không lấy theo thời gian client tự gửi lên, để
// tránh gian lận (client sửa lại durationMs). Trường này không public ra API.
function normalizeAttempts(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const [userId, row] of Object.entries(src)) {
    const startedAt = String(row?.startedAt || '').trim()
    if (!userId || !startedAt) continue
    out[String(userId)] = { startedAt }
  }
  return out
}

function normalizeEditors(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  return raw
    .map((entry) => ({
      userId: String(entry?.userId || '').trim(),
      email: String(entry?.email || '').trim().toLowerCase(),
      username: String(entry?.username || '').trim(),
    }))
    .filter((entry) => {
      if (!entry.userId || !entry.email || seen.has(entry.userId)) return false
      seen.add(entry.userId)
      return true
    })
}

function isOwnerOf(item, profile) {
  return !!profile?.id && String(profile.id) === String(item?.ownerId || '')
}

function canEditClassSpace(item, profile) {
  if (isOwnerOf(item, profile)) return true
  const userId = String(profile?.id || '')
  return !!userId && normalizeEditors(item?.editors).some((editor) => editor.userId === userId)
}

async function resolveEditorsByEmail(rawEmails, ownerId) {
  if (!Array.isArray(rawEmails)) return null
  const emails = [...new Set(rawEmails
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean))]
  if (emails.length > 20) throw new AppError('Mỗi phòng chỉ được cấp tối đa 20 tài khoản editor.', 400)
  if (!emails.length) return []

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, email')
    .in('email', emails)
  if (error) throw new AppError('Không kiểm tra được tài khoản editor.', 500)
  const byEmail = new Map((data || []).map((profile) => [String(profile.email || '').toLowerCase(), profile]))
  const missing = emails.filter((email) => !byEmail.has(email))
  if (missing.length) throw new AppError(`Không tìm thấy tài khoản Google: ${missing.join(', ')}`, 404)

  return emails
    .map((email) => byEmail.get(email))
    .filter((profile) => String(profile.id) !== String(ownerId))
    .map((profile) => ({
      userId: String(profile.id),
      email: String(profile.email || '').trim().toLowerCase(),
      username: String(profile.username || '').trim(),
    }))
}

function scoreTotalOf(questions) {
  if (!Array.isArray(questions)) return 0
  let total = 0
  for (const entry of questions) {
    if (entry?.kind === 'truefalse') {
      total += (entry.question?.statements || []).filter((s) => String(s.content || '').trim()).length
    } else {
      total += 1
    }
  }
  return total
}

function myResultOf(item, profile) {
  const id = profile?.id ? String(profile.id) : ''
  if (!id || !item?.results) return null
  const row = item.results[id]
  if (!row) return null
  return {
    correct: row.correct,
    total: row.total,
    durationMs: row.durationMs ?? null,
    completedAt: row.completedAt,
  }
}

function buildLeaderboard(item) {
  // Quy chế xếp hạng:
  // 1) Điểm (correct) cao hơn xếp trên.
  // 2) Bằng điểm: thời gian làm bài (durationMs) ngắn hơn xếp trên.
  // 3) Bằng cả điểm và thời gian: hoàn thành (completedAt) sớm hơn xếp trên.
  // durationMs do BACKEND tự tính (xem submitClassSpaceResult), không lấy giá trị
  // client tự gửi lên, nên không dùng completedAt để thay cho thời gian làm bài.
  const rows = Object.values(item?.results || {}).sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct
    const da = a.durationMs == null ? Infinity : a.durationMs
    const db = b.durationMs == null ? Infinity : b.durationMs
    if (da !== db) return da - db
    return String(a.completedAt || '').localeCompare(String(b.completedAt || ''))
  })
  let lastKey = null
  let lastRank = 0
  return rows.map((row, index) => {
    const key = `${row.correct}|${row.durationMs ?? 'x'}|${row.completedAt || ''}`
    const rank = key === lastKey ? lastRank : index + 1
    lastKey = key
    lastRank = rank
    return { ...row, rank }
  })
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const isPublic = raw.isPublic !== false
  const backdrop = normalizeBackdrop(raw)
  return {
    id,
    code: String(raw.code || '').trim(),
    title: String(raw.title || '').trim() || 'Lớp học',
    cover: String(raw.cover || ''),
    ...backdrop,
    isPublic,
    // Có hiện phòng trong danh sách "Lớp học" hay không — mặc định hiện.
    // Phòng đang ẩn vẫn vào được bằng mã phòng (xem getClassSpaceByCode).
    visibleInClass: raw.visibleInClass !== false,
    passwordHash: isPublic ? '' : String(raw.passwordHash || ''),
    // Mật khẩu 6 số dạng đọc được — CHỈ để chủ phòng xem/chỉnh lại trong màn
    // hình chỉnh sửa (xem toFullPayload). Phòng cũ tạo trước khi có trường này
    // chỉ có passwordHash nên password sẽ rỗng cho tới khi chủ phòng đặt lại.
    password: isPublic ? '' : String(raw.password || ''),
    shuffle: raw.shuffle === true,
    allowRetry: raw.allowRetry !== false,
    allowMultiTry: raw.allowMultiTry === true,
    autoAdvanceMultiTry: raw.autoAdvanceMultiTry === true,
    showEssayHints: raw.showEssayHints !== false,
    enableLeaderboard: raw.enableLeaderboard === true,
    questions: Array.isArray(raw.questions) ? raw.questions : [],
    questionCount: Number.isFinite(Number(raw.questionCount)) ? Number(raw.questionCount) : (Array.isArray(raw.questions) ? raw.questions.length : 0),
    results: normalizeResults(raw.results),
    attempts: normalizeAttempts(raw.attempts),
    editors: normalizeEditors(raw.editors),
    ownerId: raw.ownerId ? String(raw.ownerId) : '',
    ownerName: String(raw.ownerName || 'Ẩn danh').trim() || 'Ẩn danh',
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : new Date().toISOString(),
  }
}


function toPublicMeta(item, profile) {
  // Danh sách lưới "Lớp học": KHÔNG gửi passwordHash, results đầy đủ hay toàn bộ câu hỏi ra ngoài.
  const mine = myResultOf(item, profile)
  return {
    id: item.id,
    code: item.code,
    title: item.title,
    cover: item.cover,
    isPublic: item.isPublic,
    visibleInClass: item.visibleInClass !== false,
    shuffle: item.shuffle,
    allowRetry: item.allowRetry !== false,
    allowMultiTry: item.allowMultiTry === true,
    showEssayHints: item.showEssayHints !== false,
    enableLeaderboard: item.enableLeaderboard === true,
    questionCount: item.questionCount ?? item.questions.length,
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    canEdit: canEditClassSpace(item, profile),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    myResult: mine,
  }
}

function toFullPayload(item, profile) {
  // Dùng khi người xem đã được phép vào lớp (public / đúng chủ / đúng mật khẩu).
  // Không lộ passwordHash, results đầy đủ hay attempts (mốc thời gian nội bộ) ra ngoài.
  const { passwordHash, password, results, attempts, editors, ...rest } = item
  // Mật khẩu đọc được chỉ gửi cho CHỦ phòng (để hiện trong màn hình chỉnh sửa).
  const isOwner = isOwnerOf(item, profile)
  return {
    ...rest,
    ...(isOwner ? { password: item.isPublic ? '' : password || '' } : {}),
    questions: item.questions,
    canEdit: canEditClassSpace(item, profile),
    canManageEditors: isOwner,
    ...(isOwner ? { editors: item.editors } : {}),
    myResult: myResultOf(item, profile),
    leaderboard: item.enableLeaderboard ? buildLeaderboard(item) : [],
  }
}

function answerHasContent(answer) {
  return !!(String(answer?.content || '').trim() || answer?.imagePreview)
}

function assertQuestionsHaveCorrectAnswers(questions) {
  if (!Array.isArray(questions) || !questions.length) return
  questions.forEach((entry, i) => {
    const n = i + 1
    const kind = entry?.kind
    const q = entry?.question
    if (kind === 'quiz') {
      const answers = q?.answers || []
      const ok = answers.some((a) => a.isCorrect && answerHasContent(a))
      if (!ok) {
        throw new AppError(
          `Câu ${n}: trắc nghiệm phải có ít nhất 1 đáp án đúng (không được để trống).`,
          400
        )
      }
    } else if (kind === 'essay') {
      const answers = q?.answers || []
      const ok = answers.some((a) => a.isCorrect && String(a.content || '').trim())
      if (!ok) {
        throw new AppError(
          `Câu ${n}: tự luận phải có ít nhất 1 đáp án đúng (không được để trống).`,
          400
        )
      }
    } else if (kind === 'truefalse') {
      const filled = (q?.statements || []).filter((s) => String(s.content || '').trim())
      if (!filled.length) {
        throw new AppError(`Câu ${n}: đúng/sai phải có ít nhất 1 ý (không được để trống).`, 400)
      }
    }
  })
}


export async function createClassSpaceImageUploadUrl(payload) {
  const mime = String(payload?.mimeType || '').toLowerCase()
  const ext = ALLOWED_MIME[mime]
  const sizeBytes = Number(payload?.sizeBytes)
  if (!ext) throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.')
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) throw new AppError('Mỗi ảnh tối đa 10MB.')
  await ensureImageBucket()
  const safeName = String(payload?.filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
  const path = `uploads/${randomUUID()}-${safeName}.${ext}`
  const result = await supabaseAdmin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path, { upsert: false })
  if (result.error) throw new AppError('Không tạo được liên kết tải ảnh.', 502)
  return { bucket: IMAGE_BUCKET, path, token: result.data.token, signedUrl: result.data.signedUrl, mimeType: mime, sizeBytes }
}

export async function completeClassSpaceImageUpload(payload) {
  const path = String(payload?.path || '')
  const mime = String(payload?.mimeType || '').toLowerCase()
  const ext = ALLOWED_MIME[mime]
  const sizeBytes = Number(payload?.sizeBytes)
  if (!ext || !path.startsWith('uploads/') || path.includes('..') || path.split('/').length !== 2 || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) {
    throw new AppError('Thông tin ảnh tải lên không hợp lệ.', 400)
  }
  const name = path.split('/').pop()
  const { data, error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).list('uploads', { limit: 100, search: name })
  if (error) throw new AppError('Không thể xác minh ảnh trên Storage.', 502)
  const object = (data || []).find((row) => row.name === name)
  if (!object) throw new AppError('Ảnh chưa được tải lên Storage.', 400)
  if (Number.isFinite(Number(object.metadata?.size)) && Number(object.metadata.size) !== sizeBytes) throw new AppError('Kích thước ảnh không khớp.', 400)
  return { url: publicImageUrl(path) }
}

export async function listClassSpace(profile, query = {}) {
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page, 10) || 1))
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 50))
  const from = (page - 1) * pageSize
  let request = supabaseAdmin.from('class_spaces').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (!isAdminRole(profile?.role)) {
    const owner = String(profile?.id || '').replace(/[(),]/g, '')
    request = request.or(owner ? `visible_in_class.eq.true,owner_id.eq.${owner}` : 'visible_in_class.eq.true')
  }
  const result = await request.range(from, from + pageSize - 1)
  throwDatabaseError(result.error, 'đọc danh sách lớp học')
  const rows = result.data || []
  const ids = rows.map((row) => row.id)
  let ownResults = []
  if (ids.length && profile?.id) {
    const own = await supabaseAdmin.from('class_space_results').select('class_space_id,user_id,user_name,correct,total,duration_ms,completed_at')
      .in('class_space_id', ids).eq('user_id', String(profile.id)).range(0, 99)
    throwDatabaseError(own.error, 'đọc kết quả cá nhân')
    ownResults = own.data || []
  }
  const resultByRoom = new Map(ownResults.map((row) => [row.class_space_id, row]))
  const items = rows.map((row) => {
    const mine = resultByRoom.get(row.id)
    const meta = normalizeItem({
      id: row.id, code: row.code, title: row.title, cover: row.cover, backdropType: row.backdrop_type,
      backdropTheme: row.backdrop_theme, backdropImage: row.backdrop_image, isPublic: row.is_public,
      visibleInClass: row.visible_in_class, passwordHash: row.password_hash, password: row.password,
      shuffle: row.shuffle, allowRetry: row.allow_retry, allowMultiTry: row.allow_multi_try,
      autoAdvanceMultiTry: row.auto_advance_multi_try, showEssayHints: row.show_essay_hints,
      enableLeaderboard: row.enable_leaderboard, questionCount: row.question_count, questions: [],
      results: mine ? { [mine.user_id]: { userId: mine.user_id, userName: mine.user_name, correct: mine.correct, total: mine.total,
        durationMs: mine.duration_ms, completedAt: mine.completed_at } } : {}, attempts: {}, editors: [],
      ownerId: row.owner_id, ownerName: row.owner_name, createdAt: row.created_at, updatedAt: row.updated_at,
    })
    return toPublicMeta(meta, profile)
  })
  Object.defineProperty(items, 'pagination', { enumerable: false, value: { page, pageSize, total: result.count || 0, hasMore: from + items.length < (result.count || 0) } })
  return items
}

export async function listClassSpaceCreators() {
  const result = await supabaseAdmin.rpc('list_class_space_creators')
  throwDatabaseError(result.error, 'đọc danh sách người tạo lớp')
  return (result.data || []).map((row) => ({ ownerId: row.owner_id, ownerName: row.owner_name, singleRoom: row.single_room === true }))
}

/** Tra cứu phòng theo mã 6 số — áp dụng cho mọi phòng (công khai/riêng tư,
 * đang hiện hay đang ẩn trong lớp). Chỉ trả về thông tin công khai (giống
 * toPublicMeta) để luồng vào phòng ở client tái dùng được logic hiện có
 * (enterClass): phòng riêng tư vẫn phải nhập đúng mật khẩu mới vào được. */
export async function getClassSpaceByCode(code, profile) {
  const target = String(code || '').trim()
  if (!/^\d{6}$/.test(target)) {
    throw new AppError('Mã phòng không đúng hoặc không tồn tại.', 404)
  }
  const result = await supabaseAdmin.from('class_spaces').select('id').eq('code', target).maybeSingle()
  throwDatabaseError(result.error, 'tra cứu mã phòng')
  const item = result.data ? await loadRoom(result.data.id, profile?.id) : null
  if (!item) throw new AppError('Mã phòng không đúng hoặc không tồn tại.', 404)
  return toPublicMeta(item, profile)
}

/** Xem trước mã phòng sẽ được cấp cho phòng mới (chỉ để hiển thị lúc soạn
 * phòng) — mã thật sự được sinh và đảm bảo không trùng lại một lần nữa ngay
 * lúc tạo phòng (createClassSpace), tránh trường hợp hiếm hai người tạo
 * phòng cùng lúc bị trùng mã. */
export async function previewNextClassSpaceCode() {
  return generateRoomCode()
}

export async function getClassSpaceById(id, { password, profile } = {}) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const item = await loadRoom(targetId, profile?.id)
  if (!item) throw new AppError('Không tìm thấy lớp học.', 404)

  if (item.isPublic || canEditClassSpace(item, profile)) return toFullPayload(item, profile)

  if (!password) {
    const err = new AppError('Lớp học riêng tư, vui lòng nhập mật khẩu.', 401)
    err.code = 'PASSWORD_REQUIRED'
    throw err
  }
  if (hashPassword(password) !== item.passwordHash) {
    const err = new AppError('Mật khẩu không đúng.', 403)
    err.code = 'WRONG_PASSWORD'
    throw err
  }
  return toFullPayload(item, profile)
}

export async function createClassSpace(payload, profile) {
  const title = String(payload?.title || '').trim()
  if (!title) throw new AppError('Vui lòng nhập tiêu đề lớp học.', 400)
  const isPublic = payload?.isPublic !== false
  if (!isPublic && String(payload?.password || '').length !== 6) {
    throw new AppError('Lớp riêng tư cần mật khẩu đủ 6 chữ số.', 400)
  }
  const questions = Array.isArray(payload?.questions) ? payload.questions : []
  if (questions.length > 1000) throw new AppError('Mỗi phòng tối đa 1.000 câu hỏi.', 400)
  assertQuestionsHaveCorrectAnswers(questions)
  const now = new Date().toISOString()
  // The database allocates the final unique six-digit code inside the create transaction.
  const code = generateRoomCode()
  const item = normalizeItem({
    id: randomUUID(),
    code,
    title,
    cover: payload?.cover || '',
    backdropType: payload?.backdropType,
    backdropTheme: payload?.backdropTheme,
    backdropImage: payload?.backdropImage,
    isPublic,
    visibleInClass: payload?.visibleInClass !== false,
    passwordHash: isPublic ? '' : hashPassword(payload.password),
    password: isPublic ? '' : String(payload.password),
    shuffle: !!payload?.shuffle,
    allowRetry: payload?.allowRetry !== false,
    allowMultiTry: payload?.allowMultiTry === true,
    enableLeaderboard: payload?.enableLeaderboard === true,
    autoAdvanceMultiTry: payload?.autoAdvanceMultiTry === true,
    questions,
    editors: [],
    results: {},
    showEssayHints: payload?.showEssayHints !== false,
    ownerId: profile?.id || '',
    ownerName: profile?.username || 'Ẩn danh',
    createdAt: now,
    updatedAt: now,
  })
  await saveItem(item)
  return toFullPayload(item, profile)
}

export async function updateClassSpace(id, payload, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const current = await loadRoom(targetId, profile?.id)
  if (!current) throw new AppError('Không tìm thấy lớp học.', 404)
  if (!canEditClassSpace(current, profile)) {
    throw new AppError('Bạn không có quyền chỉnh sửa lớp học này.', 403)
  }
  const expectedUpdatedAt = String(payload?.expectedUpdatedAt || '').trim()
  if (expectedUpdatedAt && expectedUpdatedAt !== String(current.updatedAt || '')) {
    const conflict = new AppError(
      'Phòng học đã được người khác cập nhật. Hãy tải lại bản mới nhất trước khi lưu.',
      409
    )
    conflict.code = 'CLASS_SPACE_CONFLICT'
    conflict.currentUpdatedAt = current.updatedAt
    throw conflict
  }
  const isOwner = isOwnerOf(current, profile)

  const title = String(payload?.title || '').trim()
  if (!title) throw new AppError('Vui lòng nhập tiêu đề lớp học.', 400)
  const isPublic = payload?.isPublic !== false
  if (!isPublic && payload?.password && String(payload.password).length !== 6) {
    throw new AppError('Lớp riêng tư cần mật khẩu đủ 6 chữ số.', 400)
  }

  const passwordHash = isPublic
    ? ''
    : payload?.password
      ? hashPassword(payload.password)
      : current.passwordHash
  if (!isPublic && !passwordHash) {
    throw new AppError('Lớp riêng tư cần mật khẩu đủ 6 chữ số.', 400)
  }
  const password = isPublic
    ? ''
    : payload?.password
      ? String(payload.password)
      : current.password

  const questions = Array.isArray(payload?.questions) ? payload.questions : current.questions
  if (questions.length > 1000) throw new AppError('Mỗi phòng tối đa 1.000 câu hỏi.', 400)
  assertQuestionsHaveCorrectAnswers(questions)
  if (!isOwner && Object.prototype.hasOwnProperty.call(payload || {}, 'editorEmails')) {
    throw new AppError('Chỉ chủ phòng mới được thay đổi quyền editor.', 403)
  }
  const editors = isOwner
    ? (await resolveEditorsByEmail(payload?.editorEmails, current.ownerId)) ?? current.editors
    : current.editors

  const updated = normalizeItem({
    ...current,
    // Mã phòng là cố định, không cho đổi qua payload — giữ nguyên mã cũ.
    code: current.code,
    title,
    cover: payload?.cover ?? current.cover,
    backdropType: payload?.backdropType ?? current.backdropType,
    backdropTheme: payload?.backdropTheme ?? current.backdropTheme,
    backdropImage: payload?.backdropImage ?? current.backdropImage,
    isPublic,
    visibleInClass: payload?.visibleInClass !== false,
    passwordHash,
    password,
    shuffle: !!payload?.shuffle,
    allowRetry: payload?.allowRetry !== false,
    allowMultiTry: payload?.allowMultiTry === true,
    enableLeaderboard: payload?.enableLeaderboard === true,
    autoAdvanceMultiTry: payload?.autoAdvanceMultiTry === true,
    questions,
    editors,
    results: current.results,
    showEssayHints: payload?.showEssayHints !== false,
    updatedAt: new Date().toISOString(),
  })

  await saveItem(updated, current.updatedAt)
  return toFullPayload(updated, profile)
}

/** Đổi riêng mật khẩu 6 số của phòng riêng tư (nút "Sửa mật khẩu" → "Lưu" ở
 * màn hình chỉnh sửa phòng). Chỉ chủ phòng; không đụng tới các cài đặt khác. */
export async function updateClassSpacePassword(id, payload, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const current = await loadRoom(targetId, profile?.id)
  if (!current) throw new AppError('Không tìm thấy lớp học.', 404)
  if (!profile?.id || profile.id !== current.ownerId) {
    throw new AppError('Bạn không phải chủ lớp học này nên không thể đổi mật khẩu.', 403)
  }
  if (current.isPublic) {
    throw new AppError('Phòng đang ở chế độ công khai nên chưa có mật khẩu.', 400)
  }
  const next = String(payload?.password || '')
  if (!/^\d{6}$/.test(next)) {
    throw new AppError('Mật khẩu cần đủ 6 chữ số.', 400)
  }

  const updated = normalizeItem({
    ...current,
    passwordHash: hashPassword(next),
    password: next,
    updatedAt: new Date().toISOString(),
  })
  await saveItem(updated, current.updatedAt)
  return { password: next }
}

export async function submitClassSpaceResult(id, payload, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  if (!profile?.id) throw new AppError('Cần đăng nhập để lưu kết quả.', 401)
  const current = await loadRoom(targetId, profile.id)
  if (!current) throw new AppError('Không tìm thấy lớp học.', 404)
  const total = scoreTotalOf(current.questions)
  const correct = Math.max(0, Math.min(total, Math.floor(Number(payload?.correct) || 0)))
  const result = await supabaseAdmin.rpc('submit_class_space_result', {
    p_class_space_id: targetId, p_user_id: String(profile.id),
    p_user_name: String(profile.username || 'Ẩn danh').trim() || 'Ẩn danh',
    p_correct: correct, p_total: total,
  })
  if (result.error?.message?.includes('CLASS_SPACE_RETRY_DISABLED')) throw new AppError('Bạn đã hoàn thành phòng này và không được làm lại.', 403)
  throwDatabaseError(result.error, 'lưu kết quả lớp học')
  const value = result.data || {}
  const mine = { correct: Number(value.correct) || 0, total: Number(value.total) || 0,
    durationMs: value.duration_ms == null ? null : Number(value.duration_ms), completedAt: value.completed_at }
  const updated = await loadRoom(targetId, profile.id)
  return { myResult: mine, leaderboard: updated?.enableLeaderboard ? buildLeaderboard(updated) : [] }
}

/**
 * Ghi nhận mốc bắt đầu làm bài của một người theo giờ SERVER. Được gọi khi
 * người học mở phòng để làm bài (hoặc bấm "Làm lại"). submitClassSpaceResult
 * sẽ dùng mốc này để tự tính thời gian làm bài (durationMs), không tin vào
 * bất kỳ giá trị thời gian nào mà client gửi kèm khi nộp bài.
 */
export async function startClassSpaceAttempt(id, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  if (!profile?.id) throw new AppError('Cần đăng nhập để làm bài.', 401)
  const item = await loadRoom(targetId, profile.id)
  if (!item) throw new AppError('Không tìm thấy lớp học.', 404)
  const startedAt = new Date().toISOString()
  const result = await supabaseAdmin.from('class_space_attempts').upsert({
    class_space_id: targetId, user_id: String(profile.id), started_at: startedAt,
  }, { onConflict: 'class_space_id,user_id' })
  throwDatabaseError(result.error, 'ghi nhận lượt làm bài')
  return { startedAt }
}

export async function getClassSpaceLeaderboard(id, profile, query = {}) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const item = await loadRoom(targetId, profile?.id)
  if (!item) throw new AppError('Không tìm thấy lớp học.', 404)
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page, 10) || 1))
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(query.pageSize, 10) || 100))
  const totalQuery = await supabaseAdmin.from('class_space_results').select('user_id', { count: 'exact', head: true }).eq('class_space_id', targetId)
  throwDatabaseError(totalQuery.error, 'đếm kết quả lớp học')
  if (!item.enableLeaderboard) return { leaderboard: [], myResult: myResultOf(item, profile), pagination: { page, pageSize, total: totalQuery.count || 0, hasMore: false } }
  const [result, own] = await Promise.all([
    supabaseAdmin.rpc('get_class_space_leaderboard', { p_class_space_id: targetId, p_page: page, p_page_size: pageSize }),
    profile?.id ? supabaseAdmin.from('class_space_results').select('user_id,user_name,correct,total,duration_ms,completed_at').eq('class_space_id', targetId).eq('user_id', String(profile.id)).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  throwDatabaseError(result.error, 'đọc bảng xếp hạng')
  throwDatabaseError(own.error, 'đọc kết quả cá nhân')
  const leaderboard = (result.data || []).map((row) => ({
    rank: Number(row.rank), userId: row.user_id, userName: row.user_name,
    correct: Number(row.correct), total: Number(row.total), durationMs: row.duration_ms == null ? null : Number(row.duration_ms), completedAt: row.completed_at,
  }))
  const my = own.data ? { correct: Number(own.data.correct), total: Number(own.data.total), durationMs: own.data.duration_ms == null ? null : Number(own.data.duration_ms), completedAt: own.data.completed_at } : null
  const total = totalQuery.count || 0
  return { leaderboard, myResult: my, pagination: { page, pageSize, total, hasMore: page * pageSize < total } }
}

export async function getUtilityRoster() {
  return readUtilityRoster()
}

export async function updateUtilityRoster(payload, profile) {
  if (!isAdminRole(profile?.role)) {
    throw new AppError('Chỉ admin mới được đổi danh sách PDF.', 403)
  }
  const names = Array.isArray(payload?.names)
    ? payload.names
        .map((item, index) => ({
          stt: Number(item?.stt) || index + 1,
          name: String(item?.name || '').trim(),
        }))
        .filter((item) => item.name)
    : []
  if (!names.length) throw new AppError('Danh sách PDF không có tên hợp lệ.', 400)
  if (names.length > 100) throw new AppError('Danh sách PDF tối đa 100 thành viên.', 400)
  const roster = {
    names,
    fileName: String(payload?.fileName || 'danh-sach.pdf').trim() || 'danh-sach.pdf',
    updatedAt: new Date().toISOString(),
  }
  await writeUtilityRoster(roster)
  return roster
}

/** Xoá phòng: chủ phòng (editor) hoặc admin. */
export async function deleteClassSpace(id, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const current = await loadRoom(targetId, profile?.id)
  if (!current) throw new AppError('Không tìm thấy lớp học.', 404)
  const isOwner = !!profile?.id && profile.id === current.ownerId
  const isAdmin = isAdminRole(profile?.role)
  if (!isOwner && !isAdmin) {
    throw new AppError('Bạn không có quyền xoá phòng này.', 403)
  }
  const result = await supabaseAdmin.from('class_spaces').delete().eq('id', targetId)
  throwDatabaseError(result.error, 'xoá')
  return { id: targetId }
}
