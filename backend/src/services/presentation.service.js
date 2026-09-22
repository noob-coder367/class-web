import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import * as classSpaceService from './classSpace.service.js'
import {
  MAX_DESCRIPTION,
  MAX_SLIDES,
  MAX_TITLE,
  clone,
  defaultSlide,
  evaluatePresentationAccess,
  hashPassword,
  isOwnerOf,
  canListPresentation,
  normalizePresentation,
  toPublicPresentation,
  uniqueCode,
} from '../lib/presentationModel.js'

const DATA_BUCKET = 'classroom-data'
const DATA_PATH = 'presentations.json'

let memoryCache = null
let writeChain = Promise.resolve()

function throwAccess(result) {
  const err = new AppError(result.message || 'Không có quyền.', result.status || 403)
  err.code = result.code || 'FORBIDDEN'
  throw err
}

async function ensureDataBucket() {
  const { data, error } = await supabaseAdmin.storage.getBucket(DATA_BUCKET)
  if (error || !data) {
    throw new AppError(`Kho dữ liệu "${DATA_BUCKET}" chưa được cấu hình trên Supabase.`, 500)
  }
}

async function readStore() {
  const { data, error } = await supabaseAdmin.storage.from(DATA_BUCKET).download(DATA_PATH)
  if (error || !data) return { items: [] }
  try {
    const parsed = JSON.parse(await data.text())
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
  if (error) throw new AppError('Không lưu được bài thuyết trình: ' + error.message, 502)
}

async function loadAll() {
  if (memoryCache) return clone(memoryCache)
  await ensureDataBucket()
  const store = await readStore()
  const items = store.items.map(normalizePresentation).filter(Boolean)
  memoryCache = { items }
  return clone(memoryCache)
}

async function saveAll(items) {
  memoryCache = { items }
  await writeStore({ items })
}

function withStore(mutator) {
  const run = async () => {
    const data = await loadAll()
    return mutator(data.items)
  }
  const next = writeChain.then(run, run)
  writeChain = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

function findItem(items, id) {
  const key = String(id || '').trim()
  if (!key) return -1
  return items.findIndex((row) => row.id === key || row.code === key)
}

async function resolveLinkedRoom(linkedId, profile, password) {
  if (!linkedId) return { room: null, access: { allowed: true, code: 'OK' } }
  const room = await classSpaceService.findClassSpaceRecord(linkedId)
  if (!room) return { room: null, access: { allowed: true, code: 'MISSING' } }
  return { room, access: classSpaceService.evaluateClassSpaceAccess(room, profile, password) }
}

function applyLinkMeta(item, room) {
  if (!room) {
    return { ...item, linkedClassRoomId: null, linkedClassRoomCode: '', linkedClassRoomTitle: '' }
  }
  return {
    ...item,
    linkedClassRoomId: room.id,
    linkedClassRoomCode: room.code || '',
    linkedClassRoomTitle: room.title || '',
  }
}

async function resolveLinkFromPayload(payload, current) {
  const hasLinkField = Object.prototype.hasOwnProperty.call(payload || {}, 'linkedClassRoomId')
  const raw = hasLinkField ? payload.linkedClassRoomId : current?.linkedClassRoomId
  const key = raw == null ? '' : String(raw).trim()
  if (!key) return { room: null, itemPatch: { linkedClassRoomId: null, linkedClassRoomCode: '', linkedClassRoomTitle: '' } }
  const room = await classSpaceService.findClassSpaceRecord(key)
  if (!room) throw new AppError('Không tìm thấy phòng lớp để liên kết.', 404)
  return {
    room,
    itemPatch: {
      linkedClassRoomId: room.id,
      linkedClassRoomCode: room.code || '',
      linkedClassRoomTitle: room.title || '',
    },
  }
}

function validateSlides(slides) {
  if (slides == null) return null
  if (!Array.isArray(slides)) throw new AppError('Danh sách slide không hợp lệ.', 400)
  if (slides.length > MAX_SLIDES) throw new AppError(`Mỗi bài tối đa ${MAX_SLIDES} slide.`, 400)
  if (!slides.length) throw new AppError('Bài thuyết trình cần ít nhất 1 slide.', 400)
  return slides
}

function nextPasswordHash(visibility, password, currentHash = '') {
  if (visibility !== 'private') return ''
  const next = String(password || '')
  if (next) {
    if (next.length < 4) throw new AppError('Bài riêng tư cần mật khẩu tối thiểu 4 ký tự.', 400)
    return hashPassword(next)
  }
  return currentHash
}

function accessDenied(result) {
  throwAccess(result)
}

export async function listPresentations(profile) {
  const data = await loadAll()
  return data.items
    .filter((item) => canListPresentation(item, profile))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map((item) => toPublicPresentation(item, { owner: isOwnerOf(item, profile) }))
}

async function loadVisibleItem(id, profile, password) {
  const data = await loadAll()
  const index = findItem(data.items, id)
  if (index < 0) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
  const item = data.items[index]
  const { access } = await resolveLinkedRoom(item.linkedClassRoomId, profile, password)
  const linkedRoom =
    item.linkedClassRoomId && access.code !== 'MISSING'
      ? { allowed: access.allowed, code: access.code }
      : null
  const result = evaluatePresentationAccess(item, profile, password, linkedRoom)
  if (!result.ok) accessDenied(result)
  return { item, owner: result.owner }
}

export async function getPresentation(id, profile, password) {
  const { item, owner } = await loadVisibleItem(id, profile, password)
  return toPublicPresentation(item, { includeSlides: true, owner })
}

export async function createPresentation(payload, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập để tạo bài thuyết trình.', 401)
  const title = String(payload?.title || '').trim()
  if (!title) throw new AppError('Vui lòng nhập tên bài thuyết trình.', 400)
  if (title.length > MAX_TITLE) throw new AppError('Tên bài quá dài.', 400)
  if (String(payload?.description || '').length > MAX_DESCRIPTION) {
    throw new AppError('Mô tả quá dài.', 400)
  }

  const visibility = payload?.visibility === 'private' ? 'private' : 'public'
  const { itemPatch } = await resolveLinkFromPayload(payload, null)
  // Khi gắn phòng lớp: không dùng mật khẩu riêng của bài — quyền xem theo phòng.
  const linked = !!itemPatch.linkedClassRoomId
  const effectiveVisibility = linked ? 'public' : visibility
  const passwordHash = linked ? '' : nextPasswordHash(effectiveVisibility, payload?.password, '')
  if (effectiveVisibility === 'private' && !passwordHash) {
    throw new AppError('Bài riêng tư cần mật khẩu tối thiểu 4 ký tự.', 400)
  }
  const slides = validateSlides(payload?.slides) || [defaultSlide()]

  return withStore(async (items) => {
    const now = new Date().toISOString()
    const item = normalizePresentation({
      id: randomUUID(),
      code: uniqueCode(items),
      title,
      description: payload?.description,
      cover: payload?.cover,
      visibility: effectiveVisibility,
      passwordHash,
      ...itemPatch,
      ownerId: profile.id,
      ownerName: profile.username || 'Ẩn danh',
      slides,
      createdAt: now,
      updatedAt: now,
    })
    await saveAll([...items, item])
    return toPublicPresentation(item, { includeSlides: true, owner: true })
  })
}

export async function updatePresentation(id, payload, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập để chỉnh sửa.', 401)
  return withStore(async (items) => {
    const index = findItem(items, id)
    if (index < 0) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
    const current = items[index]
    if (!isOwnerOf(current, profile)) throw new AppError('Bạn không có quyền chỉnh sửa bài này.', 403)

    const title = String(payload?.title ?? current.title).trim()
    if (!title) throw new AppError('Vui lòng nhập tên bài thuyết trình.', 400)
    if (title.length > MAX_TITLE) throw new AppError('Tên bài quá dài.', 400)
    if (String(payload?.description ?? current.description).length > MAX_DESCRIPTION) {
      throw new AppError('Mô tả quá dài.', 400)
    }

    const { itemPatch } = await resolveLinkFromPayload(payload, current)
    const linked = !!itemPatch.linkedClassRoomId
    const visibility = linked
      ? 'public'
      : payload?.visibility === 'private'
        ? 'private'
        : payload?.visibility === 'public'
          ? 'public'
          : current.visibility
    const passwordHash = linked ? '' : nextPasswordHash(visibility, payload?.password, current.passwordHash)
    if (visibility === 'private' && !passwordHash) {
      throw new AppError('Bài riêng tư cần mật khẩu tối thiểu 4 ký tự.', 400)
    }
    const slides = Object.prototype.hasOwnProperty.call(payload || {}, 'slides')
      ? validateSlides(payload.slides)
      : current.slides

    const next = normalizePresentation({
      ...current,
      title,
      description: payload?.description ?? current.description,
      cover: payload?.cover ?? current.cover,
      visibility,
      passwordHash,
      ...itemPatch,
      ownerId: current.ownerId,
      ownerName: current.ownerName,
      code: current.code,
      id: current.id,
      slides,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    })
    items[index] = next
    await saveAll(items)
    return toPublicPresentation(next, { includeSlides: true, owner: true })
  })
}

export async function deletePresentation(id, profile) {
  if (!profile?.id) throw new AppError('Cần đăng nhập để xóa bài.', 401)
  return withStore(async (items) => {
    const index = findItem(items, id)
    if (index < 0) throw new AppError('Không tìm thấy bài thuyết trình.', 404)
    const current = items[index]
    if (!isOwnerOf(current, profile)) throw new AppError('Bạn không có quyền xóa bài này.', 403)
    await saveAll(items.filter((_, i) => i !== index))
    return { deleted: true }
  })
}

export async function uploadPresentationImage(payload) {
  const url = await classSpaceService.uploadClassSpaceImage(payload)
  return { url }
}
