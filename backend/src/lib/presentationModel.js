import { randomUUID, createHash } from 'node:crypto'

export const SCHEMA_VERSION = 1
export const MAX_SLIDES = 80
export const MAX_ELEMENTS = 40
export const MAX_TITLE = 160
export const MAX_DESCRIPTION = 2000

const ELEMENT_TYPES = new Set(['text', 'image', 'shape'])
const SHAPE_KINDS = new Set(['rectangle', 'circle', 'triangle'])
const VISIBILITIES = new Set(['public', 'private'])

export function hashPassword(raw) {
  return createHash('sha256').update(String(raw || '')).digest('hex')
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function generateCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
}

export function uniqueCode(items) {
  const taken = new Set((items || []).map((item) => String(item.code || '')))
  for (let i = 0; i < 200; i += 1) {
    const code = generateCode()
    if (!taken.has(code)) return code
  }
  return generateCode()
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function defaultSlide() {
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
        src: '',
        shape: 'rectangle',
        style: {
          fontFamily: 'Be Vietnam Pro, sans-serif',
          fontSize: 42,
          fontWeight: 800,
          color: '#14324a',
          textAlign: 'center',
        },
        animation: { entrance: 'fade', duration: 0.5, delay: 0 },
      },
    ],
  }
}

export function normalizeElement(raw, index = 0) {
  const value = asObject(raw)
  const type = ELEMENT_TYPES.has(value.type) ? value.type : 'text'
  const style = asObject(value.style)
  const animation = asObject(value.animation)
  return {
    id: String(value.id || randomUUID()),
    type,
    x: clampNumber(value.x, -20, 120, 10),
    y: clampNumber(value.y, -20, 120, 10),
    width: clampNumber(value.width, 2, 100, type === 'text' ? 40 : 30),
    height: clampNumber(value.height, 2, 100, type === 'text' ? 14 : 22),
    rotation: clampNumber(value.rotation, -360, 360, 0),
    opacity: clampNumber(value.opacity, 0, 1, 1),
    zIndex: Math.round(clampNumber(value.zIndex, 0, 999, index + 1)),
    text: type === 'text' ? String(value.text || '') : '',
    src: type === 'image' ? String(value.src || value.url || '') : '',
    shape: type === 'shape' && SHAPE_KINDS.has(value.shape) ? value.shape : 'rectangle',
    style,
    animation: {
      entrance: String(animation.entrance || 'none'),
      duration: clampNumber(animation.duration, 0, 8, 0.5),
      delay: clampNumber(animation.delay, 0, 8, 0),
    },
  }
}

export function normalizeSlide(raw) {
  const value = asObject(raw)
  const background = asObject(value.background)
  const transition = asObject(value.transition)
  const elements = Array.isArray(value.elements) ? value.elements.slice(0, MAX_ELEMENTS) : []
  return {
    id: String(value.id || randomUUID()),
    title: String(value.title || 'Slide').slice(0, 80),
    background: {
      type: background.type === 'image' ? 'image' : 'solid',
      value: String(background.value || '#ffffff'),
    },
    transition: {
      type: String(transition.type || 'fade'),
      duration: clampNumber(transition.duration, 0, 5, 0.5),
      advance: transition.advance === 'auto' ? 'auto' : 'click',
    },
    elements: elements.map(normalizeElement),
  }
}

export function normalizePresentation(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const visibility = VISIBILITIES.has(raw.visibility) ? raw.visibility : 'public'
  const slidesSrc = Array.isArray(raw.slides) && raw.slides.length ? raw.slides.slice(0, MAX_SLIDES) : [defaultSlide()]
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    code: String(raw.code || '').trim(),
    title: String(raw.title || '').trim().slice(0, MAX_TITLE) || 'Bài thuyết trình',
    description: String(raw.description || '').slice(0, MAX_DESCRIPTION),
    cover: String(raw.cover || ''),
    visibility,
    passwordHash: visibility === 'private' ? String(raw.passwordHash || '') : '',
    linkedClassRoomId: raw.linkedClassRoomId ? String(raw.linkedClassRoomId) : null,
    linkedClassRoomCode: raw.linkedClassRoomCode ? String(raw.linkedClassRoomCode) : '',
    linkedClassRoomTitle: raw.linkedClassRoomTitle ? String(raw.linkedClassRoomTitle) : '',
    ownerId: String(raw.ownerId || ''),
    ownerName: String(raw.ownerName || 'Ẩn danh'),
    slides: slidesSrc.map(normalizeSlide),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  }
}

export function toPublicPresentation(item, { includeSlides = false, owner = false } = {}) {
  const result = {
    id: item.id,
    schemaVersion: item.schemaVersion,
    code: item.code,
    title: item.title,
    description: item.description,
    cover: item.cover,
    visibility: item.visibility,
    linkedClassRoomId: item.linkedClassRoomId,
    linkedClassRoomCode: item.linkedClassRoomCode || '',
    linkedClassRoomTitle: item.linkedClassRoomTitle || '',
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    slideCount: Array.isArray(item.slides) ? item.slides.length : 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    canEdit: !!owner,
    hasPassword: item.visibility === 'private' && !!item.passwordHash && !item.linkedClassRoomId,
  }
  if (includeSlides) result.slides = clone(item.slides)
  return result
}

export function isOwnerOf(item, profile) {
  return !!profile?.id && String(profile.id) === String(item?.ownerId || '')
}

/**
 * Danh sách: owner luôn thấy; bài public (không gắn phòng) hiện với mọi thành viên;
 * bài gắn phòng hiện với mọi thành viên (phòng riêng tư vẫn hiện, xem slide thì mới hỏi mật khẩu phòng).
 * Bài riêng tư không gắn phòng chỉ owner thấy trên danh sách (người khác vào bằng mã bài).
 */
export function canListPresentation(item, profile) {
  if (isOwnerOf(item, profile)) return true
  if (item.linkedClassRoomId) return true
  return item.visibility === 'public'
}

/**
 * Quyền xem slide. Khi bài gắn với phòng lớp, dùng quyền/mật khẩu của phòng đó
 * — không tạo cơ chế mật khẩu thứ hai.
 */
export function evaluatePresentationAccess(item, profile, password, linkedRoom) {
  const owner = isOwnerOf(item, profile)
  if (owner) return { ok: true, owner: true }

  if (linkedRoom) {
    if (linkedRoom.allowed) return { ok: true, owner: false }
    if (linkedRoom.code === 'PASSWORD_REQUIRED') {
      return {
        ok: false,
        status: 401,
        code: 'CLASS_SPACE_PASSWORD_REQUIRED',
        message: 'Phòng lớp liên kết đang riêng tư, vui lòng nhập mật khẩu phòng.',
      }
    }
    if (linkedRoom.code === 'WRONG_PASSWORD') {
      return { ok: false, status: 403, code: 'WRONG_PASSWORD', message: 'Mật khẩu phòng lớp không đúng.' }
    }
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Không tìm thấy phòng lớp liên kết.' }
  }

  if (item.visibility === 'public') return { ok: true, owner: false }

  if (!password) {
    return {
      ok: false,
      status: 401,
      code: 'PRESENTATION_PASSWORD_REQUIRED',
      message: 'Bài thuyết trình riêng tư, cần nhập mật khẩu.',
    }
  }
  if (hashPassword(password) !== item.passwordHash) {
    return { ok: false, status: 403, code: 'WRONG_PASSWORD', message: 'Mật khẩu không đúng.' }
  }
  return { ok: true, owner: false }
}
