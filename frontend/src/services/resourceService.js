import { apiClient } from './apiClient.js'
import { supabase } from '../lib/supabaseClient.js'
import { dbGetAll, dbPut, dbDelete, enqueue, replaceStore } from '../lib/resourceDb.js'

export const RESOURCE_LIMITS = Object.freeze({ maxImagesPerResource: 20, maxImageSizeMB: 25, maxFilesPerResource: 20, maxFileSizeMB: 50 })

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'])
const fileExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'])
let syncInProgress = false

function extension(name) {
  return String(name || '').split('.').pop().toLowerCase()
}

function isImage(file) {
  return String(file?.type || '').startsWith('image/') || imageExtensions.has(extension(file?.name))
}

function validateFile(file, fileType) {
  const image = fileType === 'image' || isImage(file)
  const ext = extension(file?.name)
  if (image && !String(file?.type || '').startsWith('image/') && !imageExtensions.has(ext)) throw new Error(`Ảnh "${file.name}" không có định dạng hợp lệ.`)
  if (!image && !fileExtensions.has(ext) && !file?.type) throw new Error(`File "${file.name}" không được hỗ trợ.`)
  const max = (image ? RESOURCE_LIMITS.maxImageSizeMB : RESOURCE_LIMITS.maxFileSizeMB) * 1024 * 1024
  if (file.size > max) throw new Error(`File "${file.name}" vượt quá giới hạn ${image ? 25 : 50}MB.`)
  return image ? 'image' : 'file'
}

function localFileRecord(resourceId, file, fileType) {
  const id = `local-file-${crypto.randomUUID()}`
  return {
    id,
    resource_id: resourceId,
    file_name: file.name || 'resource-file',
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    file_type: fileType,
    blob: file,
    server_id: null,
    storage_path: null,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function localFilesForResources(resources) {
  const local = await dbGetAll('files').catch(() => [])
  const byResource = new Map()
  for (const file of local) {
    if (!byResource.has(file.resource_id)) byResource.set(file.resource_id, [])
    byResource.get(file.resource_id).push({
      ...file,
      url: file.blob ? URL.createObjectURL(file.blob) : null,
      _local: true,
    })
  }
  return resources.map((resource) => ({
    ...resource,
    resource_files: [...(resource.resource_files || []), ...(byResource.get(resource.id) || []).filter((file) => file.sync_status !== 'synced')],
  }))
}

async function mergeLocalResources(serverItems = []) {
  const local = await dbGetAll('resources').catch(() => [])
  const pending = local.filter((item) => item.sync_status !== 'synced' && (item._local || item.sync_status === 'pending'))
  return localFilesForResources([...serverItems, ...pending.filter((item) => !serverItems.some((server) => server.id === item.server_id))])
}

export async function getCategories() {
  try {
    const result = await apiClient.get('/resources/categories', { auth: true })
    await replaceStore('categories', result.items || [])
    return result.items || []
  } catch (error) {
    return dbGetAll('categories').catch(() => { throw error })
  }
}

export async function getResources(query = {}) {
  try {
    const qs = new URLSearchParams(Object.entries(query).filter(([, value]) => value))
    const result = await apiClient.get(`/resources${qs.toString() ? `?${qs}` : ''}`, { auth: true })
    const local = await dbGetAll('resources').catch(() => [])
    await replaceStore('resources', [...(result.items || []), ...local.filter((item) => item._local && item.sync_status !== 'synced')])
    return mergeLocalResources(result.items || [])
  } catch (error) {
    const local = await dbGetAll('resources').catch(() => [])
    if (!local.length) throw error
    return mergeLocalResources(local)
  }
}

export async function saveCategory(payload, id = null) {
  if (!navigator.onLine) {
    const local = { id: id || `local-${crypto.randomUUID()}`, ...payload, resource_count: 0, _local: true, sync_status: 'pending' }
    await dbPut('categories', local)
    await enqueue({ type: id ? 'updateCategory' : 'createCategory', localId: local.id, targetId: id, payload })
    return local
  }
  const result = id ? await apiClient.patch(`/resources/categories/${id}`, payload, { auth: true }) : await apiClient.post('/resources/categories', payload, { auth: true })
  return result.item
}

export async function deleteCategory(id) {
  if (!navigator.onLine || String(id).startsWith('local-')) {
    await dbDelete('categories', id)
    return enqueue({ type: 'deleteCategory', targetId: id })
  }
  return apiClient.delete(`/resources/categories/${id}`, { auth: true })
}

export async function saveResource(payload, id = null) {
  if (!navigator.onLine || String(id || '').startsWith('local-')) {
    const local = {
      id: id || `local-${crypto.randomUUID()}`,
      ...payload,
      resource_files: [],
      _local: true,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    }
    await dbPut('resources', local)
    await enqueue({ type: id ? 'updateResource' : 'createResource', localId: local.id, targetId: id, payload })
    return local
  }
  const result = id ? await apiClient.patch(`/resources/${id}`, payload, { auth: true }) : await apiClient.post('/resources', payload, { auth: true })
  return result.item
}

export async function deleteResource(id) {
  if (!navigator.onLine || String(id).startsWith('local-')) {
    await dbDelete('resources', id)
    const files = await dbGetAll('files').catch(() => [])
    for (const file of files.filter((item) => item.resource_id === id)) await dbDelete('files', file.id)
    return enqueue({ type: 'deleteResource', targetId: id })
  }
  return apiClient.delete(`/resources/${id}`, { auth: true })
}

export async function uploadResourceFiles(id, files) {
  const list = Array.from(files || [])
  if (!list.length) return []
  const existing = (await dbGetAll('files').catch(() => [])).filter((item) => item.resource_id === id)
  const imageCount = existing.filter((item) => item.file_type === 'image').length
  const fileCount = existing.filter((item) => item.file_type === 'file').length
  const records = []
  for (const file of list) {
    const fileType = validateFile(file, isImage(file) ? 'image' : 'file')
    if (fileType === 'image' && imageCount + records.filter((item) => item.file_type === 'image').length >= RESOURCE_LIMITS.maxImagesPerResource) throw new Error('Tài nguyên đã đủ tối đa 20 ảnh.')
    if (fileType === 'file' && fileCount + records.filter((item) => item.file_type === 'file').length >= RESOURCE_LIMITS.maxFilesPerResource) throw new Error('Tài nguyên đã đủ tối đa 20 file.')
    records.push(localFileRecord(id, file, fileType))
  }

  if (!navigator.onLine || String(id).startsWith('local-')) {
    for (const record of records) {
      await dbPut('files', record)
      await enqueue({ type: 'uploadFile', targetId: id, fileId: record.id })
    }
    return records.map((record) => ({ ...record, url: URL.createObjectURL(record.blob), _local: true }))
  }

  const uploaded = []
  for (const record of records) {
    await dbPut('files', record)
    try {
      const result = await uploadOneFile(id, record)
      await dbPut('files', { ...record, server_id: result?.id || null, storage_path: result?.file_path || null, sync_status: 'synced', updated_at: new Date().toISOString() })
      uploaded.push(result)
    } catch (error) {
      await enqueue({ type: 'uploadFile', targetId: id, fileId: record.id })
      throw error
    }
  }
  return uploaded
}

async function uploadOneFile(resourceId, record) {
  const intent = await apiClient.post(`/resources/${resourceId}/files/upload-urls`, {
    files: [{ name: record.file_name, mimeType: record.mime_type, sizeBytes: record.size_bytes, fileType: record.file_type }],
  }, { auth: true })
  const upload = intent.uploads?.[0]
  if (!upload) throw new Error('Không tạo được liên kết tải file.')
  const { error } = await supabase.storage.from(intent.bucket || 'classroom-resources')
    .uploadToSignedUrl(upload.path, upload.token, record.blob, { contentType: upload.mimeType, upsert: false })
  if (error) throw new Error(error.message || 'Không tải được file lên Storage.')
  const result = await apiClient.post(`/resources/${resourceId}/files/complete`, {
    files: [{ path: upload.path, name: upload.fileName, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes, fileType: upload.fileType }],
  }, { auth: true })
  return result.items?.[0]
}

function dataUrlToBlob(value, mimeType = 'application/octet-stream') {
  const raw = String(value || '').replace(/^data:[^;,]+;base64,/, '').replace(/\s+/g, '')
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

export async function deleteFile(id) {
  if (String(id).startsWith('local-')) {
    await dbDelete('files', id)
    return enqueue({ type: 'deleteFile', targetId: id })
  }
  if (!navigator.onLine) return enqueue({ type: 'deleteFile', targetId: id })
  return apiClient.delete(`/resources/files/${id}`, { auth: true })
}

export async function syncQueue() {
  if (!navigator.onLine || syncInProgress) return { synced: 0, pending: (await dbGetAll('sync_queue').catch(() => [])).length }
  syncInProgress = true
  let synced = 0
  try {
    const queue = await dbGetAll('sync_queue').catch(() => [])
    const idMap = new Map()
    for (const item of queue) {
      try {
        let result
        const target = idMap.get(item.targetId) || item.targetId
        if (item.type === 'createCategory') {
          result = await apiClient.post('/resources/categories', item.payload, { auth: true })
          if (result.item && item.localId) idMap.set(item.localId, result.item.id)
        } else if (item.type === 'createResource') {
          result = await apiClient.post('/resources', item.payload, { auth: true })
          if (result.item && item.localId) {
            idMap.set(item.localId, result.item.id)
            const local = await dbGetAll('resources').then((items) => items.find((entry) => entry.id === item.localId))
            if (local) await dbPut('resources', { ...local, server_id: result.item.id, sync_status: 'syncing' })
          }
        } else if (item.type === 'uploadFile') {
          const file = await dbGetAll('files').then((items) => items.find((entry) => entry.id === item.fileId))
          if (!file?.blob) throw new Error('File cục bộ không còn dữ liệu.')
          result = await uploadOneFile(target, file)
          await dbDelete('files', file.id)
        } else if (item.type === 'uploadFiles') {
          // One-time migration for v1 queues: do not resend the old giant JSON payload.
          for (const payload of item.payloads || []) {
            const blob = dataUrlToBlob(payload.contentBase64, payload.mimeType)
            const localFile = new File([blob], payload.name || 'resource-file', { type: blob.type })
            const file = localFileRecord(item.targetId, localFile, payload.fileType === 'image' ? 'image' : 'file')
            await dbPut('files', file)
            await enqueue({ type: 'uploadFile', targetId: item.targetId, fileId: file.id })
          }
        } else if (item.type === 'updateResource') {
          await apiClient.patch(`/resources/${target}`, item.payload, { auth: true })
        } else if (item.type === 'deleteResource') {
          if (!String(target).startsWith('local-')) await apiClient.delete(`/resources/${target}`, { auth: true })
        } else if (item.type === 'deleteFile') {
          if (!String(target).startsWith('local-')) await apiClient.delete(`/resources/files/${target}`, { auth: true })
        } else if (item.type === 'updateCategory') {
          await apiClient.patch(`/resources/categories/${target}`, item.payload, { auth: true })
        } else if (item.type === 'deleteCategory') {
          if (!String(target).startsWith('local-')) await apiClient.delete(`/resources/categories/${target}`, { auth: true })
        }
        await dbDelete('sync_queue', item.id)
        synced += 1
      } catch (error) {
        await dbPut('sync_queue', { ...item, status: 'failed', attempts: (item.attempts || 0) + 1, last_error: error.message, updated_at: Date.now() })
      }
    }
    return { synced, pending: (await dbGetAll('sync_queue').catch(() => [])).length }
  } finally {
    syncInProgress = false
  }
}

export async function pendingCount() {
  return (await dbGetAll('sync_queue').catch(() => [])).length
}
