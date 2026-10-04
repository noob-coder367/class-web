import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import * as announcementRepository from '../repositories/announcements.repository.js'
import { AppError } from './auth.service.js'

const IMAGE_BUCKET = 'announcement-images'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const NOTIFY_TYPES = new Set(['normal', 'hot', 'urgent'])
const SECTIONS = new Set(['main', 'important', 'discipline'])
const DOCUMENT_KINDS = new Set(['thong_bao', 'bao_cao'])
const ANNOUNCEMENT_SELECT = `id,title,document_kind,short_id,content,notify_type,section,expires_at,created_at,created_by,created_by_name,source_homework_id,is_exam_reminder,is_system,hidden,hidden_at,hidden_by,hidden_by_name,subject_user_id,subject_user_name,from_level,to_level,announcement_images(id,storage_path,public_url,mime_type,size_bytes,position,created_at)`

function dbFailure(error, operation) {
  if (!error) return
  console.error(`[announcements] ${operation} failed`, {
    databaseCode: error.code,
    details: error.details,
    hint: error.hint,
  })
  throw new AppError(`Không thể ${operation} dữ liệu thông báo.`, 503)
}

async function ensureImageBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(IMAGE_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho ảnh thông báo: ' + error.message, 502)
    }
  } else if (data.public === false) {
    const { error } = await supabaseAdmin.storage.updateBucket(IMAGE_BUCKET, { public: true })
    if (error) throw new AppError('Không cập nhật được kho ảnh thông báo: ' + error.message, 502)
  }
}

function publicImageUrl(path) {
  const { data } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

function isExpired(item, now = Date.now()) {
  if (!item?.expires_at) return false
  const t = new Date(item.expires_at).getTime()
  return Number.isFinite(t) && t <= now
}

function parseSection(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return SECTIONS.has(value) ? value : 'main'
}

function parseDocumentKind(raw) {
  return DOCUMENT_KINDS.has(raw) ? raw : 'thong_bao'
}


function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const notify = NOTIFY_TYPES.has(raw.notify_type) ? raw.notify_type : 'normal'
  const images = Array.isArray(raw.images)
    ? raw.images.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  const hidden = raw.hidden === true
  return {
    id,
    title: String(raw.title || '').trim(),
    document_kind: parseDocumentKind(raw.document_kind),
    short_id: Number.isInteger(Number(raw.short_id)) && Number(raw.short_id) > 0 ? Number(raw.short_id) : null,
    content: String(raw.content || '').trim(),
    images,
    notify_type: notify,
    section: parseSection(raw.section),
    expires_at: raw.expires_at ? String(raw.expires_at) : null,
    created_at: String(raw.created_at || new Date().toISOString()),
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_by_name: String(raw.created_by_name || 'Admin').trim() || 'Admin',
    source_homework_id: raw.source_homework_id ? String(raw.source_homework_id) : null,
    is_exam_reminder: raw.is_exam_reminder === true,
    is_system: raw.is_system === true,
    hidden,
    hidden_at: hidden && raw.hidden_at ? String(raw.hidden_at) : null,
    hidden_by: hidden && raw.hidden_by ? String(raw.hidden_by) : null,
    hidden_by_name: hidden ? String(raw.hidden_by_name || '').trim() || null : null,
    subject_user_id: raw.subject_user_id ? String(raw.subject_user_id) : null,
    subject_user_name: raw.subject_user_name ? String(raw.subject_user_name) : null,
    from_level: raw.from_level ? String(raw.from_level) : null,
    to_level: raw.to_level ? String(raw.to_level) : null,
  }
}

function normalizeDbRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const imageRows = Array.isArray(raw.announcement_images)
    ? raw.announcement_images
        .filter((row) => row && row.public_url)
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0) || String(a.id).localeCompare(String(b.id)))
    : []
  const item = normalizeItem({ ...raw, images: imageRows.map((row) => row.public_url) })
  if (item) Object.defineProperty(item, '_imageRows', { value: imageRows, enumerable: false })
  return item
}

function toDbRow(item) {
  return {
    id: item.id,
    title: String(item.title || '').trim(),
    document_kind: parseDocumentKind(item.document_kind),
    short_id: item.short_id || null,
    content: String(item.content || '').trim(),
    notify_type: NOTIFY_TYPES.has(item.notify_type) ? item.notify_type : 'normal',
    section: parseSection(item.section),
    expires_at: item.expires_at || null,
    created_at: item.created_at || new Date().toISOString(),
    created_by: item.created_by || null,
    created_by_name: String(item.created_by_name || 'Admin').trim() || 'Admin',
    source_homework_id: item.source_homework_id || null,
    is_exam_reminder: item.is_exam_reminder === true,
    is_system: item.is_system === true,
    hidden: item.hidden === true,
    hidden_at: item.hidden_at || null,
    hidden_by: item.hidden_by || null,
    hidden_by_name: item.hidden_by_name || null,
    subject_user_id: item.subject_user_id || null,
    subject_user_name: item.subject_user_name || null,
    from_level: item.from_level || null,
    to_level: item.to_level || null,
  }
}


async function insertItem(item, imageMeta = []) {
  const inserted = await supabaseAdmin.from('announcements').insert(toDbRow(item)).select(ANNOUNCEMENT_SELECT).maybeSingle()
  dbFailure(inserted.error, 'lưu')
  if (!inserted.data) throw new AppError('Không lưu được thông báo.', 503)
  if (imageMeta.length) {
    const rows = imageMeta.map((image, position) => ({
      announcement_id: item.id,
      storage_path: image.path,
      public_url: image.url,
      mime_type: image.mimeType,
      size_bytes: image.sizeBytes,
      position,
    }))
    const images = await supabaseAdmin.from('announcement_images').insert(rows)
    if (images.error) {
      await supabaseAdmin.from('announcements').delete().eq('id', item.id)
      dbFailure(images.error, 'lưu siêu dữ liệu ảnh')
    }
  }
  return item
}

async function deleteRows(items) {
  const ids = items.map((item) => item?.id).filter(Boolean)
  if (!ids.length) return
  const result = await supabaseAdmin.from('announcements').delete().in('id', ids)
  dbFailure(result.error, 'xóa')
}

export async function createAnnouncementImageUploadUrls(files) {
  const list = Array.isArray(files) ? files : []
  if (!list.length || list.length > 5) throw new AppError('Mỗi thông báo tải tối đa 5 ảnh.', 400)
  await ensureImageBucket()
  const uploads = await Promise.all(list.map(async (file) => {
    const mimeType = String(file?.mimeType || '').toLowerCase()
    const ext = ALLOWED_MIME[mimeType]
    const sizeBytes = Number(file?.sizeBytes ?? file?.size)
    if (!ext) throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.', 400)
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) throw new AppError('Mỗi ảnh tối đa 8MB.', 400)
    const path = `posts/${randomUUID()}.${ext}`
    const result = await supabaseAdmin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path, { upsert: false })
    if (result.error) throw new AppError('Không tạo được liên kết tải ảnh.', 502)
    return { path, token: result.data.token, signedUrl: result.data.signedUrl, mimeType, sizeBytes }
  }))
  return { bucket: IMAGE_BUCKET, uploads }
}

async function verifyUploadedImage(file) {
  const path = String(file?.path || '')
  const mimeType = String(file?.mimeType || '').toLowerCase()
  const ext = ALLOWED_MIME[mimeType]
  const sizeBytes = Number(file?.sizeBytes)
  if (!path.startsWith('posts/') || path.includes('..') || path.split('/').length !== 2 || !ext) throw new AppError('Ảnh tải lên không hợp lệ.', 400)
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) throw new AppError('Mỗi ảnh tối đa 8MB.', 400)
  const name = path.split('/').pop()
  const { data, error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).list('posts', { limit: 100, search: name })
  if (error) throw new AppError('Không thể xác minh ảnh trên Storage.', 502)
  const object = (data || []).find((row) => row.name === name)
  if (!object) throw new AppError('Ảnh chưa được tải lên Storage.', 400)
  if (Number.isFinite(Number(object.metadata?.size)) && Number(object.metadata.size) !== sizeBytes) throw new AppError('Kích thước ảnh không khớp.', 400)
  return { path, url: publicImageUrl(path), mimeType, sizeBytes }
}

function extractStoragePath(url) {
  if (!url || typeof url !== 'string') return null
  const marker = `/${IMAGE_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
}

async function removeImages(urls) {
  const paths = (urls || []).map(extractStoragePath).filter(Boolean)
  if (!paths.length) return
  try {
    const result = await supabaseAdmin.storage.from(IMAGE_BUCKET).remove(paths)
    if (result?.error) console.warn('[announcements] xóa ảnh thất bại:', result.error.message)
  } catch (err) {
    console.warn('[announcements] xóa ảnh thất bại:', err.message)
  }
}


async function notifyPush(item) {
  try {
    const { broadcastPush } = await import('./push.service.js')
    const preview = String(item.content || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const title =
      item.section === 'discipline'
        ? '⚠️ Vi phạm kỷ luật cao — 10A4'
        : item.is_exam_reminder || item.notify_type === 'urgent'
          ? '🚨 Thông báo quan trọng — 10A4'
          : item.notify_type === 'hot'
            ? '🔥 Thông báo mới — 10A4'
            : 'Thông báo mới — 10A4'
    await broadcastPush({
      title,
      body: preview || 'Có thông báo mới trong lớp.',
      url: '/#/classroom/announcements',
      tag: `announcement-${item.id}`,
      data: { type: 'announcement', id: item.id, tab: 'announcements' },
    })
  } catch (err) {
    console.warn('[announcements] push thất bại:', err?.message || err)
  }
}

export async function purgeExpired() {
  const now = new Date().toISOString()
  let deletedCount = 0
  while (true) {
    const result = await announcementRepository.listExpired(now, 100)
    dbFailure(result.error, 'đọc thông báo hết hạn')
    const rows = (result.data || []).map(normalizeDbRow).filter(Boolean)
    if (!rows.length) break
    for (const item of rows) await removeImages(item._imageRows?.map((image) => image.storage_path || image.public_url) || item.images)
    await deleteRows(rows)
    deletedCount += rows.length
    if (rows.length < 100) break
  }
  return { deleted: deletedCount }
}

function attachPagination(items, result) {
  const total = result.count || 0
  Object.defineProperty(items, 'pagination', { enumerable: false, value: {
    page: result.page, pageSize: result.pageSize, total,
    hasMore: result.from + items.length < total,
  } })
  return items
}

export async function listAnnouncements(query = {}) {
  await purgeExpired()
  const result = await announcementRepository.list({
    hidden: false, activeAt: new Date().toISOString(), section: SECTIONS.has(query.section) ? query.section : undefined,
    documentKind: DOCUMENT_KINDS.has(query.documentKind) ? query.documentKind : undefined,
    notifyType: NOTIFY_TYPES.has(query.notifyType) ? query.notifyType : undefined,
    isExamReminder: query.isExamReminder === undefined ? undefined : String(query.isExamReminder) === 'true',
    sort: query.sort, page: query.page, pageSize: query.pageSize,
  })
  dbFailure(result.error, 'đọc')
  return attachPagination((result.data || []).map(normalizeDbRow).filter(Boolean), result)
}

export async function listArchive(section, query = {}) {
  await purgeExpired()
  const result = await announcementRepository.list({
    hidden: true, activeAt: new Date().toISOString(), section: SECTIONS.has(section) ? section : undefined,
    documentKind: DOCUMENT_KINDS.has(query.documentKind) ? query.documentKind : undefined,
    notifyType: NOTIFY_TYPES.has(query.notifyType) ? query.notifyType : undefined,
    sort: query.sort, page: query.page, pageSize: query.pageSize,
  })
  dbFailure(result.error, 'đọc kho lưu trữ')
  return attachPagination((result.data || []).map(normalizeDbRow).filter(Boolean), result)
}

export async function getAnnouncementById(id) {
  const targetId = String(id || '').trim()
  if (!targetId) return null
  const result = await announcementRepository.findById(targetId)
  dbFailure(result.error, 'đọc')
  const item = normalizeDbRow(result.data)
  return item && !isExpired(item) ? item : null
}

function parseExpiresAt(raw, { requiredFuture = true } = {}) {
  if (!raw) return null
  const t = new Date(raw)
  if (Number.isNaN(t.getTime())) throw new AppError('Thời gian tự xóa không hợp lệ.')
  if (requiredFuture && t.getTime() <= Date.now()) {
    throw new AppError('Thời gian tự xóa phải lớn hơn thời gian hiện tại.')
  }
  return t.toISOString()
}

async function createWithShortId(item, imageMeta = [], { assignShortId = true } = {}) {
  if (assignShortId) {
    const allocated = await announcementRepository.allocateShortId(parseDocumentKind(item.document_kind))
    dbFailure(allocated.error, 'cấp mã thông báo')
    item.short_id = Number(Array.isArray(allocated.data) ? allocated.data[0] : allocated.data)
    if (!Number.isInteger(item.short_id) || item.short_id < 1) throw new AppError('Không cấp được mã thông báo.', 503)
  }
  try {
    await insertItem(item, imageMeta)
  } catch (error) {
    await removeImages(imageMeta.map((image) => image.url))
    throw error
  }
  return item
}

export async function createAnnouncement(payload, profile) {
  const content = String(payload?.content || '').trim()
  const title = String(payload?.title || '').trim()
  const documentKind = parseDocumentKind(payload?.document_kind)
  const files = Array.isArray(payload?.images) ? payload.images : []
  if (files.length > 5) throw new AppError('Mỗi thông báo tải tối đa 5 ảnh.', 400)
  if (!content && files.length === 0) throw new AppError('Vui lòng nhập nội dung hoặc chọn ít nhất 1 ảnh.')
  const requested = String(payload?.section || '').trim().toLowerCase()
  if (requested === 'discipline') {
    throw new AppError('Mục vi phạm kỷ luật cao do hệ thống tự đăng, không đăng tay được.', 403)
  }
  const section = requested === 'important' ? 'important' : 'main'
  const notifyType = NOTIFY_TYPES.has(payload?.notify_type) ? payload.notify_type : section === 'important' ? 'hot' : 'normal'
  const expiresAt = parseExpiresAt(payload?.expires_at)
  const imageMeta = []
  try {
    for (const file of files) {
      if (file?.path) imageMeta.push(await verifyUploadedImage(file))
      else if (file?.contentBase64) throw new AppError('Tải ảnh bằng Base64 đã bị tắt; hãy tải trực tiếp lên Storage.', 400)
      else throw new AppError('Ảnh không hợp lệ.', 400)
    }
    const item = {
      id: randomUUID(), title, document_kind: documentKind, short_id: null, content,
      images: imageMeta.map((image) => image.url), notify_type: notifyType, section, expires_at: expiresAt,
      created_at: new Date().toISOString(), created_by: profile?.id || null,
      created_by_name: String(profile?.username || 'Admin').trim() || 'Admin', source_homework_id: null,
      is_exam_reminder: false, is_system: false, hidden: false, hidden_at: null, hidden_by: null, hidden_by_name: null,
    }
    await createWithShortId(item, imageMeta)
    void notifyPush(item)
    return item
  } catch (error) {
    await removeImages(imageMeta.map((image) => image.url))
    throw error
  }
}

export async function createExamReminderAnnouncement(payload, profile) {
  const content = String(payload?.content || '').trim()
  if (!content) throw new AppError('Thiếu nội dung thông báo kiểm tra.')
  let expiresAt = null
  if (payload?.expires_at) {
    const t = new Date(payload.expires_at)
    if (!Number.isNaN(t.getTime()) && t.getTime() > Date.now()) expiresAt = t.toISOString()
  }
  const item = {
    id: randomUUID(), content, images: [], title: String(payload?.title || '').trim(), document_kind: 'bao_cao', short_id: null,
    notify_type: 'urgent', section: 'important', expires_at: expiresAt, created_at: new Date().toISOString(),
    created_by: profile?.id || null, created_by_name: String(profile?.username || 'Admin').trim() || 'Admin',
    source_homework_id: payload?.source_homework_id ? String(payload.source_homework_id) : null,
    is_exam_reminder: true, is_system: false, hidden: false, hidden_at: null, hidden_by: null, hidden_by_name: null,
  }
  await createWithShortId(item)
  void notifyPush(item)
  return item
}

export async function createImportantHomeworkAnnouncement(payload, profile) {
  const content = String(payload?.content || '').trim()
  if (!content) throw new AppError('Thiếu nội dung báo bài quan trọng.')
  let expiresAt = null
  if (payload?.expires_at) {
    const t = new Date(payload.expires_at)
    if (!Number.isNaN(t.getTime()) && t.getTime() > Date.now()) expiresAt = t.toISOString()
  }
  const item = {
    id: randomUUID(), content, images: [], title: String(payload?.title || '').trim(), document_kind: 'bao_cao', short_id: null,
    notify_type: NOTIFY_TYPES.has(payload?.notify_type) ? payload.notify_type : 'hot', section: 'important', expires_at: expiresAt,
    created_at: new Date().toISOString(), created_by: profile?.id || null,
    created_by_name: String(profile?.username || 'Admin').trim() || 'Admin', source_homework_id: payload?.source_homework_id ? String(payload.source_homework_id) : null,
    is_exam_reminder: false, is_system: false, hidden: false, hidden_at: null, hidden_by: null, hidden_by_name: null,
  }
  await createWithShortId(item)
  void notifyPush(item)
  return item
}

export async function createSystemDisciplineAnnouncement(payload) {
  const name = String(payload?.name || 'Thành viên').trim() || 'Thành viên'
  const fromLabel = String(payload?.fromLabel || payload?.fromLevel || '').trim()
  const toLabel = String(payload?.toLabel || payload?.toLevel || '').trim()
  const content = String(payload?.content || '').trim() || `⚠️ ${name} đã tụt 1 bậc trạng thái uy tín` + (fromLabel && toLabel ? `: ${fromLabel} → ${toLabel}.` : '.')
  const item = {
    id: randomUUID(), content, images: [], notify_type: 'urgent', section: 'discipline', expires_at: null, created_at: new Date().toISOString(),
    created_by: null, created_by_name: 'Hệ thống', source_homework_id: null, is_exam_reminder: false, is_system: true,
    hidden: false, hidden_at: null, hidden_by: null, hidden_by_name: null, subject_user_id: payload?.userId ? String(payload.userId) : null,
    subject_user_name: name, from_level: payload?.fromLevel ? String(payload.fromLevel) : null, to_level: payload?.toLevel ? String(payload.toLevel) : null,
  }
  await createWithShortId(item, [], { assignShortId: false })
  void notifyPush(item)
  return item
}

export async function hideAnnouncement(id, profile) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)
  const found = await announcementRepository.findById(targetId)
  dbFailure(found.error, 'đọc')
  const current = normalizeDbRow(found.data)
  if (!current) throw new AppError('Không tìm thấy thông báo.', 404)
  if (isExpired(current)) throw new AppError('Thông báo đã hết hạn.', 404)
  if (current.hidden === true) return current
  const next = { ...current, hidden: true, hidden_at: new Date().toISOString(), hidden_by: profile?.id || null, hidden_by_name: String(profile?.username || '').trim() || null }
  const result = await supabaseAdmin.from('announcements').update(toDbRow(next)).eq('id', targetId)
  dbFailure(result.error, 'ẩn')
  return next
}

export async function unhideAnnouncement(id) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)
  const found = await announcementRepository.findById(targetId)
  dbFailure(found.error, 'đọc')
  const current = normalizeDbRow(found.data)
  if (!current) throw new AppError('Không tìm thấy thông báo.', 404)
  if (isExpired(current)) throw new AppError('Thông báo đã hết hạn.', 404)
  const next = { ...current, hidden: false, hidden_at: null, hidden_by: null, hidden_by_name: null }
  const result = await supabaseAdmin.from('announcements').update(toDbRow(next)).eq('id', targetId)
  dbFailure(result.error, 'bỏ ẩn')
  return next
}

export async function deleteAnnouncement(id) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)
  const record = await announcementRepository.findById(targetId)
  dbFailure(record.error, 'đọc')
  const found = normalizeDbRow(record.data)
  if (!found) throw new AppError('Không tìm thấy thông báo.', 404)
  await removeImages(found.images)
  await deleteRows([found])
  return { id: targetId }
}

async function deleteMatching(homeworkId, onlyExam = false) {
  let deletedCount = 0
  while (true) {
    const result = await announcementRepository.listByHomework(homeworkId, onlyExam)
    dbFailure(result.error, 'đọc thông báo liên quan')
    const items = (result.data || []).map(normalizeDbRow).filter(Boolean)
    if (!items.length) break
    for (const item of items) await removeImages(item._imageRows?.map((image) => image.storage_path || image.public_url) || item.images)
    await deleteRows(items)
    deletedCount += items.length
    if (items.length < 100) break
  }
  return { deleted: deletedCount }
}

export async function deleteAnnouncementsByHomeworkId(homeworkId) {
  const target = String(homeworkId || '').trim()
  if (!target) return { deleted: 0 }
  return deleteMatching(target, false)
}

/** Chỉ xóa thông báo kiểm tra (is_exam_reminder) gắn với báo bài — giữ bài báo bài thường. */
export async function deleteExamRemindersByHomeworkId(homeworkId) {
  const target = String(homeworkId || '').trim()
  if (!target) return { deleted: 0 }
  return deleteMatching(target, true)
}

export async function updateAnnouncementExpiry(id, expiresAtRaw) {
  const targetId = String(id || '').trim()
  if (!targetId) throw new AppError('Thiếu mã thông báo.', 400)
  const expiresAt = parseExpiresAt(expiresAtRaw)
  const found = await announcementRepository.findById(targetId)
  dbFailure(found.error, 'đọc')
  const current = normalizeDbRow(found.data)
  if (!current) throw new AppError('Không tìm thấy thông báo.', 404)
  const next = { ...current, expires_at: expiresAt }
  const result = await supabaseAdmin.from('announcements').update({ expires_at: expiresAt }).eq('id', targetId)
  dbFailure(result.error, 'cập nhật')
  return next
}
