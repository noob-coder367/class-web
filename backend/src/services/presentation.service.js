import { randomUUID, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

// Project hiện dùng Supabase Storage JSON cho các module classroom chưa có bảng
// riêng. Presentation dùng cùng convention, không reset hay thay đổi các bảng hiện có.
const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'presentations.json'
const SCHEMA_VERSION = 2
const MAX_PRESENTATIONS = 5000
const MAX_SLIDES = 200
const MAX_ELEMENTS_PER_SLIDE = 200
let writeQueue = Promise.resolve()

function hashPassword(raw) {
  const salt = randomBytes(16).toString('hex')
  const digest = scryptSync(String(raw || ''), salt, 64).toString('hex')
  return `scrypt$${salt}$${digest}`
}

function verifyPassword(raw, stored) {
  const value = String(stored || '')
  if (/^[a-f0-9]{64}$/i.test(value)) {
    return createHash('sha256').update(String(raw || '')).digest('hex') === value
  }
  const match = value.match(/^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i)
  if (!match) return false
  const actual = scryptSync(String(raw || ''), match[1], 64)
  const expected = Buffer.from(match[2], 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function asText(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function safeData(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value ?? null
  if (typeof value === 'string') return value.slice(0, 20000)
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => safeData(item, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [asText(key, 100), safeData(item, depth + 1)]))
  }
  return null
}

function normalizeColor(value, fallback = '#ffffff') {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
}

function normalizeElement(raw) {
  if (!raw || typeof raw !== 'object') return null
  const type = ['text', 'shape', 'image', 'video', 'audio', 'table', 'chart', 'diagram'].includes(raw.type) ? raw.type : 'text'
  const numeric = (value, fallback, min, max) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
  }
  const style = raw.style && typeof raw.style === 'object' ? raw.style : {}
  return {
    id: asText(raw.id, 80) || randomUUID(),
    type,
    x: numeric(raw.x, 0, 0, 100),
    y: numeric(raw.y, 0, 0, 100),
    width: numeric(raw.width, 30, 1, 100),
    height: numeric(raw.height, 15, 1, 100),
    rotation: numeric(raw.rotation, 0, -360, 360),
    opacity: numeric(raw.opacity, 1, 0, 1),
    zIndex: Math.round(numeric(raw.zIndex, 1, 0, 10000)),
    locked: raw.locked === true,
    visible: raw.visible !== false,
    text: asText(raw.text, 20000),
    src: asText(raw.src, 200000),
    title: asText(raw.title, 500),
    shapeVariant: asText(raw.shapeVariant, 80),
    border: safeData(raw.border),
    borderRadius: numeric(raw.borderRadius, 0, 0, 500),
    objectFit: ['contain', 'cover', 'fill', 'none'].includes(raw.objectFit) ? raw.objectFit : 'contain',
    controls: raw.controls !== false,
    loop: raw.loop === true,
    autoplay: raw.autoplay === true,
    rows: Array.isArray(raw.rows) ? safeData(raw.rows) : [],
    data: Array.isArray(raw.data) ? safeData(raw.data) : [],
    nodes: Array.isArray(raw.nodes) ? safeData(raw.nodes) : [],
    chartType: asText(raw.chartType, 40),
    diagramType: asText(raw.diagramType, 40),
    style: {
      fontFamily: asText(style.fontFamily, 120) || 'Be Vietnam Pro, sans-serif',
      fontSize: numeric(style.fontSize, 24, 6, 240),
      fontWeight: Math.round(numeric(style.fontWeight, 600, 100, 900)),
      color: normalizeColor(style.color, '#14324a'),
      background: normalizeColor(style.background, '#d8edf2'),
      border: safeData(style.border),
      borderRadius: numeric(style.borderRadius, 0, 0, 500),
      objectFit: ['contain', 'cover', 'fill', 'none'].includes(style.objectFit) ? style.objectFit : 'contain',
      textAlign: ['left', 'center', 'right'].includes(style.textAlign) ? style.textAlign : 'left',
    },
    animation: safeData(style.animation && typeof style.animation === 'object' ? style.animation : raw.animation || null),
    metadata: safeData(raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}),
  }
}

function defaultSlide() {
  return {
    id: randomUUID(),
    title: 'Trang tiêu đề',
    background: { type: 'solid', value: '#ffffff' },
    transition: { type: 'fade', duration: 0.5, advance: 'click' },
    elements: [
      normalizeElement({
        type: 'text', x: 10, y: 28, width: 80, height: 18, zIndex: 1,
        text: 'Tiêu đề bài thuyết trình',
        style: { fontSize: 42, fontWeight: 800, color: '#14324a', textAlign: 'center' },
        animation: { entrance: 'fade', duration: 0.5, delay: 0 },
      }),
    ],
  }
}

function normalizeSlide(raw) {
  const value = raw && typeof raw === 'object' ? raw : {}
  const elements = Array.isArray(value.elements)
    ? value.elements.slice(0, MAX_ELEMENTS_PER_SLIDE).map(normalizeElement).filter(Boolean)
    : []
  return {
    id: asText(value.id, 80) || randomUUID(),
    title: asText(value.title, 200) || 'Slide',
    notes: asText(value.notes, 20000),
    sectionId: asText(value.sectionId, 80),
    background: {
      type: value.background?.type === 'image' ? 'image' : 'solid',
      value: value.background?.type === 'image' ? asText(value.background.value, 200000) : normalizeColor(value.background?.value),
    },
    transition: safeData(value.transition && typeof value.transition === 'object' ? value.transition : { type: 'fade', duration: 0.5, advance: 'click' }),
    elements,
    metadata: safeData(value.metadata && typeof value.metadata === 'object' ? value.metadata : {}),
  }
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = asText(raw.id, 80)
  if (!id) return null
  const visibility = raw.visibility === 'private' ? 'private' : 'public'
  const slides = Array.isArray(raw.slides) && raw.slides.length ? raw.slides : [defaultSlide()]
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    code: asText(raw.code, 12),
    title: asText(raw.title, 200) || 'Bài thuyết trình',
    description: asText(raw.description, 4000),
    cover: asText(raw.cover, 200000),
    visibility,
    passwordHash: visibility === 'private' ? asText(raw.passwordHash, 256) : '',
    linkedClassRoomId: raw.linkedClassRoomId ? asText(raw.linkedClassRoomId, 100) : null,
    ownerId: asText(raw.ownerId, 100),
    ownerName: asText(raw.ownerName, 200) || 'Ẩn danh',
    slides: slides.slice(0, MAX_SLIDES).map(normalizeSlide),
    sections: Array.isArray(raw.sections) ? safeData(raw.sections) : [],
    comments: Array.isArray(raw.comments) ? safeData(raw.comments) : [],
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  }
}

async function ensureDataBucket() {
  const { data, error } = await supabaseAdmin.storage.getBucket(DATA_BUCKET)
  if (error || !data) throw new AppError(`Kho dữ liệu "${DATA_BUCKET}" chưa được cấu hình trên Supabase.`, 500)
}

async function readAll() {
  const { data, error } = await supabaseAdmin.storage.from(DATA_BUCKET).download(DATA_PATH)
  if (error || !data) return []
  try {
    const parsed = JSON.parse(await data.text())
    return Array.isArray(parsed.items) ? parsed.items.map(normalizeItem).filter(Boolean) : []
  } catch {
    throw new AppError('Dữ liệu bài thuyết trình bị hỏng.', 500)
  }
}

async function writeAll(items) {
  await ensureDataBucket()
  if (items.length > MAX_PRESENTATIONS) throw new AppError('Đã đạt giới hạn số bài thuyết trình.', 400)
  const body = Buffer.from(JSON.stringify({ items }, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(DATA_BUCKET).upload(DATA_PATH, body, { contentType: 'application/json', upsert: true })
  if (error) throw new AppError('Không lưu được bài thuyết trình: ' + error.message, 502)
}

async function updateStore(mutator) {
  const operation = writeQueue.then(async () => {
    const items = await readAll()
    const result = await mutator(items)
    await writeAll(items)
    return result
  })
  writeQueue = operation.catch(() => {})
  return operation
}

function uniqueCode(items) {
  const taken = new Set(items.map((item) => item.code))
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
    if (!taken.has(code)) return code
  }
  throw new AppError('Không thể cấp mã bài mới, vui lòng thử lại.', 503)
}

function publicItem(item, { includeSlides = false, owner = false } = {}) {
  const result = {
    id: item.id, schemaVersion: item.schemaVersion, code: item.code, title: item.title,
    description: item.description, cover: item.cover, visibility: item.visibility,
    linkedClassRoomId: item.linkedClassRoomId, ownerId: item.ownerId, ownerName: item.ownerName,
    sections: clone(item.sections), comments: clone(item.comments),
    slideCount: item.slides.length, createdAt: item.createdAt, updatedAt: item.updatedAt, canEdit: owner,
  }
  if (includeSlides) result.slides = clone(item.slides)
  return result
}

function canView(item, profile) {
  return item.visibility === 'public' || item.ownerId === profile?.id
}

function validateSlides(slides) {
  if (slides === undefined) return
  if (!Array.isArray(slides) || slides.length < 1 || slides.length > MAX_SLIDES) {
    throw new AppError(`Slides phải là mảng từ 1 đến ${MAX_SLIDES} phần tử.`, 400)
  }
}

export async function listPresentations(profile) {
  const items = await readAll()
  return items.filter((item) => canView(item, profile)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((item) => publicItem(item, { owner: item.ownerId === profile?.id }))
}

export async function getPresentation(id, profile, password = '') {
  const items = await readAll()
  const item = items.find((row) => row.id === String(id) || row.code === String(id))
  if (!item) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
  const owner = item.ownerId === profile?.id
  if (!owner && item.visibility === 'private' && !verifyPassword(password, item.passwordHash)) {
    const err = new AppError('Bài thuyết trình riêng tư, cần nhập mật khẩu.', 401)
    err.code = 'PRESENTATION_PASSWORD_REQUIRED'
    throw err
  }
  return publicItem(item, { includeSlides: true, owner })
}

export async function unlockPresentation(id, profile, password = '') {
  return getPresentation(id, profile, password)
}

export async function createPresentation(payload, profile) {
  const title = asText(payload?.title, 200)
  if (!title) throw new AppError('Vui lòng nhập tên bài thuyết trình.', 400)
  const visibility = payload?.visibility === 'private' ? 'private' : 'public'
  const password = String(payload?.password || '')
  if (visibility === 'private' && password.length < 4) throw new AppError('Bài riêng tư cần mật khẩu tối thiểu 4 ký tự.', 400)
  validateSlides(payload?.slides)
  return updateStore((items) => {
    const now = new Date().toISOString()
    const item = normalizeItem({
      id: randomUUID(), code: uniqueCode(items), title, description: payload?.description, cover: payload?.cover,
      visibility, passwordHash: visibility === 'private' ? hashPassword(password) : '',
      linkedClassRoomId: payload?.linkedClassRoomId || null, ownerId: profile?.id, ownerName: profile?.username || 'Ẩn danh',
      slides: Array.isArray(payload?.slides) && payload.slides.length ? payload.slides : [defaultSlide()], createdAt: now, updatedAt: now,
      sections: payload?.sections, comments: payload?.comments,
    })
    items.push(item)
    return publicItem(item, { includeSlides: true, owner: true })
  })
}

export async function updatePresentation(id, payload, profile) {
  validateSlides(payload?.slides)
  return updateStore((items) => {
    const index = items.findIndex((row) => row.id === String(id))
    if (index < 0) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
    const current = items[index]
    if (current.ownerId !== profile?.id) throw new AppError('Bạn không có quyền chỉnh sửa bài này.', 403)
    const title = asText(payload?.title ?? current.title, 200)
    if (!title) throw new AppError('Vui lòng nhập tên bài thuyết trình.', 400)
    const visibility = payload?.visibility === 'private' ? 'private' : payload?.visibility === 'public' ? 'public' : current.visibility
    const password = String(payload?.password || '')
    if (visibility === 'private' && password && password.length < 4) throw new AppError('Mật khẩu tối thiểu 4 ký tự.', 400)
    const next = normalizeItem({
      ...current, title, description: payload?.description ?? current.description, cover: payload?.cover ?? current.cover,
      visibility, passwordHash: visibility === 'private' ? (password ? hashPassword(password) : current.passwordHash) : '',
      linkedClassRoomId: payload?.linkedClassRoomId ?? current.linkedClassRoomId, ownerId: current.ownerId, code: current.code, id: current.id,
      slides: Array.isArray(payload?.slides) ? payload.slides : current.slides, updatedAt: new Date().toISOString(),
      sections: payload?.sections ?? current.sections, comments: payload?.comments ?? current.comments,
    })
    items[index] = next
    return publicItem(next, { includeSlides: true, owner: true })
  })
}

export async function deletePresentation(id, profile) {
  return updateStore((items) => {
    const index = items.findIndex((row) => row.id === String(id))
    if (index < 0) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
    if (items[index].ownerId !== profile?.id) throw new AppError('Bạn không có quyền xóa bài này.', 403)
    items.splice(index, 1)
    return { deleted: true }
  })
}
