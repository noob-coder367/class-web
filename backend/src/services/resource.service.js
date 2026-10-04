import { randomUUID } from 'node:crypto'
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
function uploadFileMetadata(file) {
  const name = text(file?.name || file?.file_name, 240) || 'resource-file'
  const ext = (name.split('.').pop() || '').toLowerCase()
  const mime = text(file?.mimeType || file?.mime_type).toLowerCase() || extType[ext] || 'application/octet-stream'
  const isImage = file?.fileType === 'image' || file?.file_type === 'image' || IMAGE_TYPES.has(mime) || imageExtension(ext)
  if (isImage && !IMAGE_TYPES.has(mime) && !imageExtension(ext)) throw new AppError(`Ảnh "${name}" không có định dạng hợp lệ.`, 400)
  if (!isImage && !FILE_TYPES.has(mime) && !extType[ext]) throw new AppError(`File "${name}" không được hỗ trợ.`, 400)
  const size = Number(file?.sizeBytes ?? file?.size_bytes ?? file?.size)
  const max = (isImage ? RESOURCE_LIMITS.maxImageSizeMB : RESOURCE_LIMITS.maxFileSizeMB) * 1024 * 1024
  if (!Number.isSafeInteger(size) || size < 1 || size > max) throw new AppError(`File "${name}" vượt quá giới hạn ${isImage ? 25 : 50}MB.`, 400)
  return { name, mime: IMAGE_TYPES.has(mime) ? mime : (extType[ext] || mime), size, fileType: isImage ? 'image' : 'file', ext: ext.replace(/[^a-z0-9]/g, '') || 'bin' }
}

export async function createResourceUploadUrls(resourceId, files, profile) {
  const resource = await resourcesRepository.getResourceId(resourceId)
  if (!resource) throw new AppError('Không tìm thấy tài nguyên.', 404)
  const list = Array.isArray(files) ? files : []
  if (!list.length || list.length > 20) throw new AppError('Mỗi lượt tải lên cần từ 1 đến 20 file.', 400)
  const existing = await resourcesRepository.listFileTypes(resourceId)
  const counts = { image: existing.filter((row) => row.file_type === 'image').length, file: existing.filter((row) => row.file_type === 'file').length }
  const prepared = list.map((file) => uploadFileMetadata(file))
  for (const item of prepared) counts[item.fileType] += 1
  if (counts.image > RESOURCE_LIMITS.maxImagesPerResource || counts.file > RESOURCE_LIMITS.maxFilesPerResource) throw new AppError('Đã vượt quá giới hạn file/ảnh của tài nguyên.', 400)
  const uploads = await Promise.all(prepared.map(async (item) => {
    const directory = item.fileType === 'image' ? 'images' : 'files'
    const path = `resources/${resourceId}/${directory}/${randomUUID()}.${item.ext}`
    const result = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false })
    if (result.error) throw new AppError('Không tạo được liên kết tải file tài nguyên.', 502)
    return { path, token: result.data.token, signedUrl: result.data.signedUrl, fileName: item.name, mimeType: item.mime, sizeBytes: item.size, fileType: item.fileType }
  }))
  return { bucket: BUCKET, uploads }
}

export async function completeResourceUploads(resourceId, files, profile) {
  const resource = await resourcesRepository.getResourceId(resourceId)
  if (!resource) throw new AppError('Không tìm thấy tài nguyên.', 404)
  const list = Array.isArray(files) ? files : []
  if (!list.length || list.length > 20) throw new AppError('Mỗi lượt hoàn tất cần từ 1 đến 20 file.', 400)
  const prepared = list.map((file) => ({ ...uploadFileMetadata(file), path: text(file?.path, 600) }))
  for (const item of prepared) {
    const directory = item.fileType === 'image' ? 'images' : 'files'
    const prefix = `resources/${resourceId}/${directory}/`
    if (!item.path.startsWith(prefix) || item.path.includes('..') || item.path.split('/').length !== 4) throw new AppError('Đường dẫn file tài nguyên không hợp lệ.', 400)
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(`resources/${resourceId}/${directory}`, { limit: 100, search: item.path.split('/').pop() })
    if (error) throw new AppError('Không thể xác minh file đã tải lên.', 502)
    const object = (data || []).find((row) => row.name === item.path.split('/').pop())
    if (!object) throw new AppError(`File "${item.name}" chưa có trong Storage.`, 400)
    const storedSize = Number(object.metadata?.size)
    if (Number.isFinite(storedSize) && storedSize !== item.size) throw new AppError(`Kích thước file "${item.name}" không khớp.`, 400)
  }
  const existing = await resourcesRepository.listFileTypes(resourceId)
  const imageCount = existing.filter((row) => row.file_type === 'image').length + prepared.filter((row) => row.fileType === 'image').length
  const fileCount = existing.filter((row) => row.file_type === 'file').length + prepared.filter((row) => row.fileType === 'file').length
  if (imageCount > RESOURCE_LIMITS.maxImagesPerResource || fileCount > RESOURCE_LIMITS.maxFilesPerResource) throw new AppError('Đã vượt quá giới hạn file/ảnh của tài nguyên.', 400)
  const rows = prepared.map((item) => ({ resource_id: resourceId, file_name: item.name, file_path: item.path, mime_type: item.mime, size_bytes: item.size, file_type: item.fileType, created_by: profile.id }))
  const inserted = await resourcesRepository.createFiles(rows)
  return Promise.all((inserted || rows).map(signed))
}

export async function deleteFile(id) {
  const row = await resourcesRepository.getFile(id)
  if (!row) throw new AppError('Không tìm thấy file.', 404)
  const { error: storageError } = await supabaseAdmin.storage.from(BUCKET).remove([row.file_path])
  if (storageError) throw errorOf(storageError, 'Không xóa được file tài nguyên')
  await resourcesRepository.deleteFile(id)
  return { id }
}
