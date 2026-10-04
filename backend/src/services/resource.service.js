import { createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import * as resourcesRepository from '../repositories/resources.repository.js'

export const RESOURCE_LIMITS = Object.freeze({ maxImagesPerResource: 20, maxImageSizeMB: 25, maxFilesPerResource: 20, maxFileSizeMB: 50 })
const BUCKET = 'classroom-resources'
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const FILE_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'application/zip', 'application/x-zip-compressed'])
const extType = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', zip: 'application/zip' }
const text = (value, max = 10000) => String(value ?? '').trim().slice(0, max)
function errorOf(error, fallback) { return new AppError(`${fallback}: ${error?.message || 'lỗi không xác định'}`, 500) }
function decode(payload, kind) {
  const name = text(payload?.name || payload?.file_name, 240) || 'resource-file'
  const ext = (name.split('.').pop() || '').toLowerCase()
  const mime = text(payload?.mimeType || payload?.mime_type).toLowerCase() || extType[ext] || 'application/octet-stream'
  const isImage = kind === 'image' || IMAGE_TYPES.has(mime)
  if (kind === 'image' && !IMAGE_TYPES.has(mime)) throw new AppError('Ảnh không có định dạng hợp lệ.', 400)
  if (kind !== 'image' && !isImage && !FILE_TYPES.has(mime) && !extType[ext]) throw new AppError(`File "${name}" không được hỗ trợ.`, 400)
  const raw = text(payload?.contentBase64 || payload?.dataUrl).replace(/^data:[^;,]+;base64,/, '').replace(/\s+/g, '')
  if (!raw) throw new AppError(`File "${name}" không có dữ liệu.`, 400)
  const buffer = Buffer.from(raw, 'base64')
  if (!buffer.length) throw new AppError(`File "${name}" rỗng.`, 400)
  const max = isImage ? RESOURCE_LIMITS.maxImageSizeMB * 1024 * 1024 : RESOURCE_LIMITS.maxFileSizeMB * 1024 * 1024
  if (buffer.length > max) throw new AppError(`File "${name}" vượt quá giới hạn ${isImage ? 25 : 50}MB.`, 400)
  return { name, mime, buffer, fileType: isImage ? 'image' : 'file', digest: createHash('sha256').update(buffer).digest('hex'), ext: ext.replace(/[^a-z0-9]/g, '') || 'bin' }
}
function decodeMultipart(file, kind) {
  if (!file?.buffer?.length) throw new AppError('Chưa nhận được file upload.', 400)
  const name = text(file.originalname, 240) || 'resource-file'
  const ext = (name.split('.').pop() || '').toLowerCase()
  const mime = text(file.mimetype).toLowerCase() || extType[ext] || 'application/octet-stream'
  const isImage = kind === 'image' || IMAGE_TYPES.has(mime) || imageExtension(ext)
  if (kind === 'image' && !IMAGE_TYPES.has(mime) && !imageExtension(ext)) throw new AppError(`Ảnh "${name}" không có định dạng hợp lệ.`, 400)
  if (!isImage && !FILE_TYPES.has(mime) && !extType[ext]) throw new AppError(`File "${name}" không được hỗ trợ.`, 400)
  const max = (isImage ? RESOURCE_LIMITS.maxImageSizeMB : RESOURCE_LIMITS.maxFileSizeMB) * 1024 * 1024
  if (file.buffer.length > max) throw new AppError(`File "${name}" vượt quá giới hạn ${isImage ? 25 : 50}MB.`, 413)
  return { name, mime: IMAGE_TYPES.has(mime) ? mime : (extType[ext] || mime), buffer: file.buffer, fileType: isImage ? 'image' : 'file', digest: createHash('sha256').update(file.buffer).digest('hex'), ext: ext.replace(/[^a-z0-9]/g, '') || 'bin' }
}
function imageExtension(ext) { return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext) }
async function signed(row) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(row.file_path, 3600)
  if (error) throw new AppError('Không tạo được liên kết file tài nguyên.', 502)
  return { ...row, url: data?.signedUrl || null }
}
export async function listCategories() {
  const rows = await resourcesRepository.listCategories()
  return rows
}
export async function createCategory(payload, profile) {
  const row = { name: text(payload?.name, 120), description: text(payload?.description, 2000), created_by: profile.id }
  if (!row.name) throw new AppError('Tên hạng mục là bắt buộc.', 400)
  return resourcesRepository.createCategory(row)
}
export async function updateCategory(id, payload) {
  return resourcesRepository.updateCategory(id, { name: text(payload?.name, 120), description: text(payload?.description, 2000), updated_at: new Date().toISOString() })
}
export async function deleteCategory(id) {
  await resourcesRepository.deleteCategory(id)
  return { id }
}
export async function listResources(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || query.limit, 10) || 50))
  const result = await resourcesRepository.listResources({ categoryId: query.category_id, page, pageSize, sort: text(query.sort) })
  const keyword = text(query.search, 200).toLowerCase()
  const fileType = text(query.file_type)
  const filtered = result.rows.filter((row) => (!keyword || `${row.title} ${row.description} ${row.note}`.toLowerCase().includes(keyword)) && (!fileType || (row.resource_files || []).some((file) => file.file_type === fileType)))
  return Promise.all(filtered.map(async (row) => ({ ...row, resource_files: await Promise.all((row.resource_files || []).map(signed)) })))
}
export async function getResource(id) {
  const item = await resourcesRepository.getResource(id)
  if (!item) throw new AppError('Không tìm thấy tài nguyên.', 404)
  return { ...item, resource_files: await Promise.all((item.resource_files || []).map(signed)) }
}
export async function createResource(payload, profile) {
  const row = { title: text(payload?.title, 200), description: text(payload?.description, 10000), category_id: payload?.category_id || null, note: text(payload?.note, 20000), created_by: profile.id }
  if (!row.title) throw new AppError('Tên tài nguyên là bắt buộc.', 400)
  return resourcesRepository.createResource(row)
}
export async function updateResource(id, payload) {
  return resourcesRepository.updateResource(id, { title: text(payload?.title, 200), description: text(payload?.description, 10000), category_id: payload?.category_id || null, note: text(payload?.note, 20000), updated_at: new Date().toISOString() })
}
export async function deleteResource(id) {
  const files = await resourcesRepository.listResourceFiles(id)
  if (files.length) {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(files.map((file) => file.file_path))
    if (error) throw errorOf(error, 'Không xóa được file tài nguyên')
  }
  await resourcesRepository.deleteResource(id)
  return { id }
}
export async function addFiles(resourceId, payloads, profile) {
  const resource = await resourcesRepository.getResourceId(resourceId)
  if (!resource) throw new AppError('Không tìm thấy tài nguyên.', 404)
  const existing = await resourcesRepository.listFileTypes(resourceId)
  const images = existing.filter((row) => row.file_type === 'image').length
  const files = existing.filter((row) => row.file_type === 'file').length
  const list = Array.isArray(payloads) ? payloads : []
  if (images + list.filter((item) => item.fileType === 'image').length > RESOURCE_LIMITS.maxImagesPerResource || files + list.filter((item) => item.fileType !== 'image').length > RESOURCE_LIMITS.maxFilesPerResource) {
    throw new AppError('Đã vượt quá giới hạn file/ảnh của tài nguyên.', 400)
  }
  const uploaded = []
  const rows = []
  try {
    for (const payload of list) {
      const item = decode(payload, payload?.fileType)
      const path = `resources/${resourceId}/${item.fileType === 'image' ? 'images' : 'files'}/${item.digest}.${item.ext}`
      const result = await supabaseAdmin.storage.from(BUCKET).upload(path, item.buffer, { contentType: item.mime, upsert: false })
      if (result.error && !/already exists/i.test(result.error.message)) throw new AppError('Không upload được file: ' + result.error.message, 502)
      if (!result.error) uploaded.push(path)
      const row = { resource_id: resourceId, file_name: item.name, file_path: path, mime_type: item.mime, size_bytes: item.buffer.length, file_type: item.fileType, created_by: profile.id }
      const inserted = await resourcesRepository.createFile(row)
      if (inserted) rows.push(inserted)
    }
    return Promise.all(rows.map(signed))
  } catch (error) {
    if (uploaded.length) await supabaseAdmin.storage.from(BUCKET).remove(uploaded)
    throw error
  }
}

export async function addFile(resourceId, file, fileType, profile) {
  const resource = await resourcesRepository.getResourceId(resourceId)
  if (!resource) throw new AppError('Không tìm thấy tài nguyên.', 404)
  const existing = await resourcesRepository.listFileTypes(resourceId)
  const item = decodeMultipart(file, fileType)
  const count = existing.filter((row) => row.file_type === item.fileType).length
  const limit = item.fileType === 'image' ? RESOURCE_LIMITS.maxImagesPerResource : RESOURCE_LIMITS.maxFilesPerResource
  if (count >= limit) throw new AppError(`Tài nguyên đã đủ tối đa ${limit} ${item.fileType === 'image' ? 'ảnh' : 'file'}.`, 400)
  const path = `resources/${resourceId}/${item.fileType === 'image' ? 'images' : 'files'}/${item.digest}.${item.ext}`
  const uploaded = await supabaseAdmin.storage.from(BUCKET).upload(path, item.buffer, { contentType: item.mime, upsert: false })
  if (uploaded.error && !/already exists/i.test(uploaded.error.message)) throw new AppError('Không upload được file: ' + uploaded.error.message, 502)
  const row = { resource_id: resourceId, file_name: item.name, file_path: path, mime_type: item.mime, size_bytes: item.buffer.length, file_type: item.fileType, created_by: profile.id }
  try {
    const inserted = await resourcesRepository.createFile(row)
    return signed(inserted || { ...row, id: path })
  } catch (error) {
    if (!uploaded.error) await supabaseAdmin.storage.from(BUCKET).remove([path])
    throw error
  }
}

export async function deleteFile(id) {
  const row = await resourcesRepository.getFile(id)
  if (!row) throw new AppError('Không tìm thấy file.', 404)
  const { error: storageError } = await supabaseAdmin.storage.from(BUCKET).remove([row.file_path])
  if (storageError) throw errorOf(storageError, 'Không xóa được file tài nguyên')
  await resourcesRepository.deleteFile(id)
  return { id }
}
