const DB_NAME = 'classweb_resource_management_v1'
const VERSION = 1
const STORES = ['categories', 'resources', 'files', 'sync_queue']
function openDb() { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME, VERSION); req.onupgradeneeded = () => { const db = req.result; for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' }) }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) }) }
export async function dbGetAll(store) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readonly'); const req = tx.objectStore(store).getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error) }) }
export async function dbPut(store, value) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); tx.oncomplete = () => resolve(value); tx.onerror = () => reject(tx.error) }) }
export async function dbDelete(store, id) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) }) }
export async function dbClear(store) { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).clear(); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) }) }
export async function enqueue(operation) { return dbPut('sync_queue', { ...operation, id: operation.id || crypto.randomUUID(), created_at: Date.now(), attempts: operation.attempts || 0 }) }
export async function replaceStore(store, items) { await dbClear(store); for (const item of items || []) await dbPut(store, item) }
export const RESOURCE_DB_NAME = DB_NAME
