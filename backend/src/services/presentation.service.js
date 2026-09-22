import { randomUUID, createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'presentations.json'
const SCHEMA_VERSION = 1

function hashPassword(raw) {
  return createHash('sha256').update(String(raw || '')).digest('hex')
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function generateCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
}

function uniqueCode(items) {
  const taken = new Set(items.map((item) => String(item.code || '')))
  for (let i = 0; i < 200; i += 1) {
    const code = generateCode()
    if (!taken.has(code)) return code
  }
  throw new AppError('Không thể cấp mã bài mới, vui lòng thử lại.', 503)
}

function defaultSlide() {
  return {
    id: randomUUID(),
    title: 'Trang tiêu đề',
    background: { type: 'solid', value: '#ffffff' },
    transition: { type: 'fade', duration: 0.5, advance: 'click' },
    elements: [
      {
        id: randomUUID(),
        type: 'text',
        x: 10,
        y: 28,
        width: 80,
        height: 18,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        text: 'Tiêu đề bài thuyết trình',
        style: { fontFamily: 'Be Vietnam Pro, sans-serif', fontSize: 42, fontWeight: 800, color: '#14324a', textAlign: 'center' },
        animation: { entrance: 'fade', duration: 0.5, delay: 0 },
      },
    ],
  }
}

function normalizeSlide(slide) {
  const value = slide && typeof slide === 'object' ? slide : {}
  return {
    id: String(value.id || randomUUID()),
    title: String(value.title || 'Slide'),
    background: value.background && typeof value.background === 'object' ? value.background : { type: 'solid', value: '#ffffff' },
    transition: value.transition && typeof value.transition === 'object' ? value.transition : { type: 'fade', duration: 0.5, advance: 'click' },
    elements: Array.isArray(value.elements) ? value.elements : [],
  }
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const isPublic = raw.visibility !== 'private'
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    code: String(raw.code || '').trim(),
    title: String(raw.title || '').trim() || 'Bài thuyết trình',
    description: String(raw.description || ''),
    cover: String(raw.cover || ''),
    visibility: isPublic ? 'public' : 'private',
    passwordHash: isPublic ? '' : String(raw.passwordHash || ''),
    linkedClassRoomId: raw.linkedClassRoomId ? String(raw.linkedClassRoomId) : null,
    ownerId: String(raw.ownerId || ''),
    ownerName: String(raw.ownerName || 'Ẩn danh'),
    slides: (Array.isArray(raw.slides) && raw.slides.length ? raw.slides : [defaultSlide()]).map(normalizeSlide),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  }
}

async function readAll() {
  const { data } = await supabaseAdmin.storage.from(DATA_BUCKET).download(DATA_PATH)
  if (!data) return []
  try {
    const parsed = JSON.parse(await data.text())
    return Array.isArray(parsed.items) ? parsed.items.map(normalizeItem).filter(Boolean) : []
  } catch {
    return []
  }
}

async function writeAll(items) {
  const body = Buffer.from(JSON.stringify({ items }, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(DATA_BUCKET).upload(DATA_PATH, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw new AppError('Không lưu được bài thuyết trình: ' + error.message, 502)
}

function publicItem(item, { includeSlides = false, owner = false } = {}) {
  const result = {
    id: item.id,
    schemaVersion: item.schemaVersion,
    code: item.code,
    title: item.title,
    description: item.description,
    cover: item.cover,
    visibility: item.visibility,
    linkedClassRoomId: item.linkedClassRoomId,
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    slideCount: item.slides.length,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    canEdit: owner,
  }
  if (includeSlides) result.slides = clone(item.slides)
  return result
}

function canView(item, profile) {
  return item.visibility === 'public' || item.ownerId === profile?.id
}

export async function listPresentations(profile) {
  const items = await readAll()
  return items
    .filter((item) => canView(item, profile))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((item) => publicItem(item, { owner: item.ownerId === profile?.id }))
}

export async function getPresentation(id, profile, password) {
  const items = await readAll()
  const item = items.find((row) => row.id === String(id) || row.code === String(id))
  if (!item) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
  const owner = item.ownerId === profile?.id
  if (!owner && item.visibility === 'private' && hashPassword(password) !== item.passwordHash) {
    const err = new AppError('Bài thuyết trình riêng tư, cần nhập mật khẩu.', 401)
    err.code = 'PRESENTATION_PASSWORD_REQUIRED'
    throw err
  }
  return publicItem(item, { includeSlides: true, owner })
}

export async function createPresentation(payload, profile) {
  const title = String(payload?.title || '').trim()
  if (!title) throw new AppError('Vui lòng nhập tên bài thuyết trình.', 400)
  const visibility = payload?.visibility === 'private' ? 'private' : 'public'
  const password = String(payload?.password || '')
  if (visibility === 'private' && password.length < 4) throw new AppError('Bài riêng tư cần mật khẩu tối thiểu 4 ký tự.', 400)
  const items = await readAll()
  const now = new Date().toISOString()
  const item = normalizeItem({
    id: randomUUID(), code: uniqueCode(items), title, description: payload?.description, cover: payload?.cover,
    visibility, passwordHash: visibility === 'private' ? hashPassword(password) : '',
    linkedClassRoomId: payload?.linkedClassRoomId || null, ownerId: profile?.id, ownerName: profile?.username || 'Ẩn danh',
    slides: Array.isArray(payload?.slides) && payload.slides.length ? payload.slides : [defaultSlide()], createdAt: now, updatedAt: now,
  })
  await writeAll([...items, item])
  return publicItem(item, { includeSlides: true, owner: true })
}

export async function updatePresentation(id, payload, profile) {
  const items = await readAll()
  const index = items.findIndex((row) => row.id === String(id))
  if (index < 0) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
  const current = items[index]
  if (current.ownerId !== profile?.id) throw new AppError('Bạn không có quyền chỉnh sửa bài này.', 403)
  const title = String(payload?.title ?? current.title).trim()
  if (!title) throw new AppError('Vui lòng nhập tên bài thuyết trình.', 400)
  const visibility = payload?.visibility === 'private' ? 'private' : payload?.visibility === 'public' ? 'public' : current.visibility
  const password = String(payload?.password || '')
  const next = normalizeItem({
    ...current, ...payload, title, visibility,
    passwordHash: visibility === 'private' ? (password ? hashPassword(password) : current.passwordHash) : '',
    ownerId: current.ownerId, code: current.code, id: current.id,
    slides: Array.isArray(payload?.slides) ? payload.slides : current.slides,
    updatedAt: new Date().toISOString(),
  })
  items[index] = next
  await writeAll(items)
  return publicItem(next, { includeSlides: true, owner: true })
}

export async function deletePresentation(id, profile) {
  const items = await readAll()
  const current = items.find((row) => row.id === String(id))
  if (!current) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
  if (current.ownerId !== profile?.id) throw new AppError('Bạn không có quyền xóa bài này.', 403)
  await writeAll(items.filter((row) => row.id !== current.id))
  return { deleted: true }
}
EOF
