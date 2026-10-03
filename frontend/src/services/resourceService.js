import { apiClient } from './apiClient.js'
import { dbGetAll, dbPut, dbDelete, enqueue, replaceStore } from '../lib/resourceDb.js'
export const RESOURCE_LIMITS = Object.freeze({ maxImagesPerResource: 20, maxImageSizeMB: 25, maxFilesPerResource: 20, maxFileSizeMB: 50 })
const fileToDataUrl = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(new Error(`Không đọc được file ${file.name || ''}`)); reader.readAsDataURL(file) })
function filePayload(file, fileType) { return fileToDataUrl(file).then((contentBase64) => ({ name: file.name, mimeType: file.type || '', fileType, contentBase64 })) }
export async function getCategories() { try { const result = await apiClient.get('/resources/categories', { auth: true }); await replaceStore('categories', result.items || []); return result.items || [] } catch (error) { return dbGetAll('categories').catch(() => { throw error }) } }
export async function getResources(query = {}) { try { const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v)); const result = await apiClient.get(`/resources${qs.toString() ? `?${qs}` : ''}`, { auth: true }); await replaceStore('resources', result.items || []); return result.items || [] } catch (error) { return dbGetAll('resources').catch(() => { throw error }) } }
export async function saveCategory(payload, id = null) { if (!navigator.onLine) { const local = { id: id || `local-${crypto.randomUUID()}`, ...payload, resource_count: 0, _local: true }; await dbPut('categories', local); await enqueue({ type: id ? 'updateCategory' : 'createCategory', localId: local.id, payload }); return local } const result = id ? await apiClient.patch(`/resources/categories/${id}`, payload, { auth: true }) : await apiClient.post('/resources/categories', payload, { auth: true }); return result.item }
export async function deleteCategory(id) { if (!navigator.onLine) { await dbDelete('categories', id); return enqueue({ type: 'deleteCategory', targetId: id }) } return apiClient.delete(`/resources/categories/${id}`, { auth: true }) }
export async function saveResource(payload, id = null) { if (!navigator.onLine) { const local = { id: id || `local-${crypto.randomUUID()}`, ...payload, resource_files: [], _local: true }; await dbPut('resources', local); await enqueue({ type: id ? 'updateResource' : 'createResource', localId: local.id, payload }); return local } const result = id ? await apiClient.patch(`/resources/${id}`, payload, { auth: true }) : await apiClient.post('/resources', payload, { auth: true }); return result.item }
export async function deleteResource(id) { if (!navigator.onLine) { await dbDelete('resources', id); return enqueue({ type: 'deleteResource', targetId: id }) } return apiClient.delete(`/resources/${id}`, { auth: true }) }
export async function uploadResourceFiles(id, files) { const payloads = []; for (const file of files) payloads.push(await filePayload(file, file.type?.startsWith('image/') ? 'image' : 'file')); if (!navigator.onLine || String(id).startsWith('local-')) { await enqueue({ type: 'uploadFiles', targetId: id, payloads }); return payloads.map((x, i) => ({ id: `local-file-${Date.now()}-${i}`, ...x })) } const result = await apiClient.post(`/resources/${id}/files`, { files: payloads }, { auth: true, retry: false, timeoutMs: 300_000 }); return result.items || [] }
export async function deleteFile(id) { if (!navigator.onLine) return enqueue({ type: 'deleteFile', targetId: id }); return apiClient.delete(`/resources/files/${id}`, { auth: true }) }
export async function syncQueue() {
  if (!navigator.onLine) return { synced: 0, pending: (await dbGetAll('sync_queue').catch(() => [])).length }
  const queue = await dbGetAll('sync_queue').catch(() => [])
  const idMap = new Map(); let synced = 0
  for (const item of queue) {
    try {
      const target = idMap.get(item.targetId) || item.targetId
      let result
      if (item.type === 'createCategory') { result = await apiClient.post('/resources/categories', item.payload, { auth: true }); if (item.localId && result.item) idMap.set(item.localId, result.item.id) }
      else if (item.type === 'updateCategory') await apiClient.patch(`/resources/categories/${target}`, item.payload, { auth: true })
      else if (item.type === 'deleteCategory') await apiClient.delete(`/resources/categories/${target}`, { auth: true })
      else if (item.type === 'createResource') { result = await apiClient.post('/resources', item.payload, { auth: true }); if (item.localId && result.item) idMap.set(item.localId, result.item.id) }
      else if (item.type === 'updateResource') await apiClient.patch(`/resources/${target}`, item.payload, { auth: true })
      else if (item.type === 'deleteResource') await apiClient.delete(`/resources/${target}`, { auth: true })
      else if (item.type === 'uploadFiles') await apiClient.post(`/resources/${target}/files`, { files: item.payloads }, { auth: true, retry: false, timeoutMs: 300_000 })
      else if (item.type === 'deleteFile') await apiClient.delete(`/resources/files/${target}`, { auth: true })
      await dbDelete('sync_queue', item.id); synced++
    } catch { /* giữ queue để retry lần sau */ }
  }
  return { synced, pending: queue.length - synced }
}
export async function pendingCount() { return (await dbGetAll('sync_queue').catch(() => [])).length }
