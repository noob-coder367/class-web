import { randomUUID, createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { isAdminRole } from '../lib/roles.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'class-space.json'
const IMAGE_BUCKET = 'class-space-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

let memoryCache = null

function clone(value) {
  return JSON.parse(JSON.stringify(value))
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

function generateUniqueRoomCode(existingCodes) {
  const taken = existingCodes instanceof Set ? existingCodes : new Set(existingCodes || [])
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const code = generateRoomCode()
    if (!taken.has(code)) return code
  }
  // Cực hiếm khi đụng hết không gian mã sau 200 lần thử — vẫn trả về một mã
  // hợp lệ thay vì làm hỏng luồng tạo phòng.
  return generateRoomCode()
}

async function ensureDataBucket() {
  const { data, error } =
    await supabaseAdmin.storage.getBucket(DATA_BUCKET)

  if (error || !data) {
    throw new AppError(
      `Kho dữ liệu "${DATA_BUCKET}" chưa được cấu hình trên Supabase.`,
      500
    )
  }
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
    throw new AppError('Không lưu được lớp học: ' + error.message, 502)
  }
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
    enableLeaderboard: raw.enableLeaderboard === true,
    questions: Array.isArray(raw.questions) ? raw.questions : [],
    results: normalizeResults(raw.results),
    attempts: normalizeAttempts(raw.attempts),
    ownerId: raw.ownerId ? String(raw.ownerId) : '',
    ownerName: String(raw.ownerName || 'Ẩn danh').trim() || 'Ẩn danh',
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : new Date().toISOString(),
  }
}

async function loadAll() {
  if (memoryCache) return clone(memoryCache)
  await ensureDataBucket()
  const store = await readStore()
  const items = store.items.map(normalizeItem).filter(Boolean)

  // Phòng tạo từ trước khi có mã phòng thì chưa có `code` — cấp mã 6 số không
  // trùng cho các phòng đó (một lần duy nhất) để hiện được trong màn hình chỉnh
  // sửa và vào được bằng ô nhập mã.
  const missingCode = items.filter((row) => !row.code)
  if (missingCode.length) {
    const taken = new Set(items.map((row) => row.code).filter(Boolean))
    for (const row of missingCode) {
      row.code = generateUniqueRoomCode(taken)
      taken.add(row.code)
    }
    memoryCache = { items }
    try {
      await writeStore({ items })
    } catch {
      // Không lưu được lúc này thì lần sau sẽ tự thử lại, không làm hỏng luồng đọc.
    }
    return clone(memoryCache)
  }

  memoryCache = { items }
  return clone(memoryCache)
}

async function saveAll(items) {
  memoryCache = { items }
  await writeStore({ items })
}

function toPublicMeta(item, profile) {
  // Danh sách lưới "Lớp học": KHÔNG gửi passwordHash, results đầy đủ hay toàn bộ câu hỏi ra ngoài.
  const mine = myResultOf(item, profile)
  return {
    id: item.id,
    title: item.title,
    cover: item.cover,
    isPublic: item.isPublic,
    visibleInClass: item.visibleInClass !== false,
    shuffle: item.shuffle,
    allowRetry: item.allowRetry !== false,
    allowMultiTry: item.allowMultiTry === true,
    enableLeaderboard: item.enableLeaderboard === true,
    questionCount: item.questions.length,
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    myResult: mine,
  }
}

function toFullPayload(item, profile) {
  // Dùng khi người xem đã được phép vào lớp (public / đúng chủ / đúng mật khẩu).
  // Không lộ passwordHash, results đầy đủ hay attempts (mốc thời gian nội bộ) ra ngoài.
  const { passwordHash, password, results, attempts, ...rest } = item
  // Mật khẩu đọc được chỉ gửi cho CHỦ phòng (để hiện trong màn hình chỉnh sửa).
  const isOwner = !!profile?.id && profile.id === item.ownerId
  return {
    ...rest,
    ...(isOwner ? { password: item.isPublic ? '' : password || '' } : {}),
    questions: item.questions,
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

function stripDataUrl(contentBase64) {
  const raw = String(contentBase64 || '').trim()
  const match = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  return match ? match[1] : raw.replace(/\s+/g, '')
}

export async function uploadClassSpaceImage(payload) {
  const mime = String(payload?.mimeType || '').toLowerCase()
  const ext = ALLOWED_MIME[mime]
  if (!ext) throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.')
  const pure = stripDataUrl(payload?.contentBase64)
  if (!pure) throw new AppError('Thiếu dữ liệu ảnh.')
  let bytes
  try {
    bytes = Buffer.from(pure, 'base64')
  } catch {
    throw new AppError('Ảnh không hợp lệ.')
  }
  if (!bytes.length) throw new AppError('Ảnh trống.')
  if (bytes.length > MAX_IMAGE_BYTES) throw new AppError('Mỗi ảnh tối đa 10MB.')
  await ensureImageBucket()
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const { error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  })
  if (error) throw new AppError('Không tải được ảnh lên: ' + error.message, 502)
  return publicImageUrl(path)
}

export async function listClassSpace(profile) {
  const data = await loadAll()
  const isAdmin = isAdminRole(profile?.role)
  // Phòng đang để "Ẩn trong lớp" không hiện trong danh sách chung — trừ chủ
  // phòng và admin vẫn thấy để quản lý. Phòng ẩn vẫn vào được bằng mã phòng.
  const visible = data.items.filter((item) => {
    if (item.visibleInClass !== false) return true
    const isOwner = !!profile?.id && profile.id === item.ownerId
    return isOwner || isAdmin
  })
  const items = [...visible].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return items.map((item) => toPublicMeta(item, profile))
}

/** Danh sách tài khoản ĐÃ TỪNG TẠO PHÒNG (ít nhất 1 phòng) — dùng cho dropdown
 * "Được tạo bởi" ở bộ lọc phòng. Chỉ trả về ownerId + ownerName (+ cờ singleRoom
 * để client chọn đúng câu ghi chú), TUYỆT ĐỐI không trả mã phòng, tiêu đề hay
 * bất kỳ thông tin nào của phòng — kể cả phòng đang ẩn — nên không thể dùng để
 * vòng qua cơ chế "Ẩn trong lớp". Danh sách phòng thật sự vẫn lấy từ
 * listClassSpace (đã lọc phòng ẩn theo quyền chủ phòng/admin). */
export async function listClassSpaceCreators() {
  const data = await loadAll()
  const byOwner = new Map()
  for (const item of data.items) {
    if (!item.ownerId) continue
    const at = new Date(item.createdAt).getTime() || 0
    const current = byOwner.get(item.ownerId)
    if (!current) {
      byOwner.set(item.ownerId, {
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        count: 1,
        latestAt: at,
      })
      continue
    }
    current.count += 1
    // Lấy tên ở phòng mới nhất (phòng cũ có thể lưu tên cũ của người tạo).
    if (at >= current.latestAt) {
      current.ownerName = item.ownerName
      current.latestAt = at
    }
  }
  return [...byOwner.values()]
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName, 'vi', { sensitivity: 'base' }))
    .map((row) => ({
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      singleRoom: row.count === 1,
    }))
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
  const data = await loadAll()
  const item = data.items.find((row) => row.code === target)
  if (!item) throw new AppError('Mã phòng không đúng hoặc không tồn tại.', 404)
  return toPublicMeta(item, profile)
}

/** Xem trước mã phòng sẽ được cấp cho phòng mới (chỉ để hiển thị lúc soạn
 * phòng) — mã thật sự được sinh và đảm bảo không trùng lại một lần nữa ngay
 * lúc tạo phòng (createClassSpace), tránh trường hợp hiếm hai người tạo
 * phòng cùng lúc bị trùng mã. */
export async function previewNextClassSpaceCode() {
  const data = await loadAll()
  const existingCodes = new Set(data.items.map((row) => row.code).filter(Boolean))
  return generateUniqueRoomCode(existingCodes)
}

export async function getClassSpaceById(id, { password, profile } = {}) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const data = await loadAll()
  const item = data.items.find((row) => row.id === targetId)
  if (!item) throw new AppError('Không tìm thấy lớp học.', 404)

  const isOwner = !!profile?.id && profile.id === item.ownerId
  if (item.isPublic || isOwner) return toFullPayload(item, profile)

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
  assertQuestionsHaveCorrectAnswers(questions)
  const now = new Date().toISOString()
  const data = await loadAll()
  // Mã phòng luôn do SERVER sinh ra tại thời điểm tạo (không nhận mã từ
  // client) để đảm bảo không trùng với bất kỳ phòng nào khác.
  const existingCodes = new Set(data.items.map((row) => row.code).filter(Boolean))
  const code = generateUniqueRoomCode(existingCodes)
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
    questions,
    results: {},
    ownerId: profile?.id || '',
    ownerName: profile?.username || 'Ẩn danh',
    createdAt: now,
    updatedAt: now,
  })
  await saveAll([...data.items, item])
  return toFullPayload(item, profile)
}

export async function updateClassSpace(id, payload, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const data = await loadAll()
  const idx = data.items.findIndex((row) => row.id === targetId)
  if (idx === -1) throw new AppError('Không tìm thấy lớp học.', 404)
  const current = data.items[idx]
  if (!profile?.id || profile.id !== current.ownerId) {
    throw new AppError('Bạn không phải chủ lớp học này nên không thể chỉnh sửa.', 403)
  }

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
  assertQuestionsHaveCorrectAnswers(questions)

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
    questions,
    results: current.results,
    updatedAt: new Date().toISOString(),
  })

  data.items[idx] = updated
  await saveAll(data.items)
  return toFullPayload(updated, profile)
}

/** Đổi riêng mật khẩu 6 số của phòng riêng tư (nút "Sửa mật khẩu" → "Lưu" ở
 * màn hình chỉnh sửa phòng). Chỉ chủ phòng; không đụng tới các cài đặt khác. */
export async function updateClassSpacePassword(id, payload, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const data = await loadAll()
  const idx = data.items.findIndex((row) => row.id === targetId)
  if (idx === -1) throw new AppError('Không tìm thấy lớp học.', 404)
  const current = data.items[idx]
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
  data.items[idx] = updated
  await saveAll(data.items)
  return { password: next }
}

export async function submitClassSpaceResult(id, payload, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  if (!profile?.id) throw new AppError('Cần đăng nhập để lưu kết quả.', 401)

  const data = await loadAll()
  const idx = data.items.findIndex((row) => row.id === targetId)
  if (idx === -1) throw new AppError('Không tìm thấy lớp học.', 404)
  const current = data.items[idx]
  const existing = current.results?.[profile.id]
  if (existing && current.allowRetry === false) {
    throw new AppError('Bạn đã hoàn thành phòng này và không được làm lại.', 403)
  }

  // Thời gian làm bài do SERVER tự tính từ mốc bắt đầu đã ghi nhận trước đó
  // (xem startClassSpaceAttempt) — KHÔNG lấy durationMs mà client tự gửi lên,
  // để tránh gian lận.
  const startedAtIso = current.attempts?.[profile.id]?.startedAt
  let durationMs = null
  if (startedAtIso) {
    const startedMs = new Date(startedAtIso).getTime()
    if (Number.isFinite(startedMs)) {
      durationMs = Math.max(0, Date.now() - startedMs)
    }
  }

  const total = scoreTotalOf(current.questions)
  const correct = Math.max(0, Math.min(total, Math.floor(Number(payload?.correct) || 0)))
  const nextResults = { ...(current.results || {}) }
  nextResults[profile.id] = {
    userId: String(profile.id),
    userName: String(profile.username || 'Ẩn danh').trim() || 'Ẩn danh',
    correct,
    total,
    durationMs,
    completedAt: new Date().toISOString(),
  }

  // Mốc bắt đầu đã được dùng để tính thời gian, xoá đi để lần làm lại sau
  // (nếu phòng cho phép) phải gọi startClassSpaceAttempt lại từ đầu.
  const nextAttempts = { ...(current.attempts || {}) }
  delete nextAttempts[profile.id]

  const updated = normalizeItem({
    ...current,
    results: nextResults,
    attempts: nextAttempts,
    updatedAt: current.updatedAt,
  })
  data.items[idx] = updated
  await saveAll(data.items)

  const mine = myResultOf(updated, profile)
  return {
    myResult: mine,
    leaderboard: updated.enableLeaderboard ? buildLeaderboard(updated) : [],
  }
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

  const data = await loadAll()
  const idx = data.items.findIndex((row) => row.id === targetId)
  if (idx === -1) throw new AppError('Không tìm thấy lớp học.', 404)
  const current = data.items[idx]

  const nextAttempts = { ...(current.attempts || {}) }
  const startedAt = new Date().toISOString()
  nextAttempts[profile.id] = { startedAt }

  const updated = normalizeItem({ ...current, attempts: nextAttempts })
  data.items[idx] = updated
  await saveAll(data.items)
  return { startedAt }
}

export async function getClassSpaceLeaderboard(id, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const data = await loadAll()
  const item = data.items.find((row) => row.id === targetId)
  if (!item) throw new AppError('Không tìm thấy lớp học.', 404)
  if (!item.enableLeaderboard) return { leaderboard: [], myResult: myResultOf(item, profile) }
  return {
    leaderboard: buildLeaderboard(item),
    myResult: myResultOf(item, profile),
  }
}

/** Xoá phòng: chủ phòng (editor) hoặc admin. */
export async function deleteClassSpace(id, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã lớp học.', 400)
  const data = await loadAll()
  const idx = data.items.findIndex((row) => row.id === targetId)
  if (idx === -1) throw new AppError('Không tìm thấy lớp học.', 404)
  const current = data.items[idx]
  const isOwner = !!profile?.id && profile.id === current.ownerId
  const isAdmin = isAdminRole(profile?.role)
  if (!isOwner && !isAdmin) {
    throw new AppError('Bạn không có quyền xoá phòng này.', 403)
  }
  data.items.splice(idx, 1)
  await saveAll(data.items)
  return { id: targetId }
}
