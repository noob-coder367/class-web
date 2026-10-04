import { supabaseAdmin } from '../config/supabaseClient.js'
import { readJsonFile, cloneJson } from './classroomDataStore.js'

// LEGACY COMPATIBILITY STORE: keep this adapter for existing modules and lazy
// migration from classroom-data/*.json. New large relational features must use
// a repository under ../repositories instead of adding another JSON key here.
const DEFAULT_BUCKET = 'classroom-data'
const readLocks = new Map()

function dbError(error, message) {
  if (!error) return
  console.error(`[classroom-db] ${message}:`, error.message || error)
  const err = new Error(message)
  err.status = 503
  throw err
}

function emptyValue(empty) {
  return typeof empty === 'function' ? empty() : cloneJson(empty)
}

async function readLegacy({ bucket = DEFAULT_BUCKET, path, empty, label }) {
  if (!path) return emptyValue(empty)
  try {
    return await readJsonFile({ bucket, path, empty, label })
  } catch (error) {
    // A missing legacy bucket/file is equivalent to an empty store. Other
    // errors are surfaced so a real Storage outage is not silently swallowed.
    if (error?.status === 502 && /not found|không đọc được/i.test(error.message || '')) return emptyValue(empty)
    throw error
  }
}

export async function readStore({ key, legacyPath = `${key}.json`, bucket = DEFAULT_BUCKET, empty = {}, label = key }) {
  const existing = await supabaseAdmin.from('classroom_store').select('value, version, updated_at').eq('key', key).maybeSingle()
  dbError(existing.error, `Không đọc được store ${key}.`)
  if (existing.data) return cloneJson(existing.data.value)

  const previous = readLocks.get(key) || Promise.resolve()
  const operation = previous.then(async () => {
    const recheck = await supabaseAdmin.from('classroom_store').select('value').eq('key', key).maybeSingle()
    dbError(recheck.error, `Không đọc được store ${key}.`)
    if (recheck.data) return cloneJson(recheck.data.value)
    const legacy = await readLegacy({ bucket, path: legacyPath, empty, label })
    const inserted = await supabaseAdmin.from('classroom_store').insert({ key, value: legacy, version: 1 }).select('value').maybeSingle()
    if (inserted.error && inserted.error.code !== '23505') dbError(inserted.error, `Không migrate được ${key} sang PostgreSQL.`)
    if (inserted.data) console.info(`[migrate] key=${key} from storage -> db`)
    if (inserted.data) return cloneJson(inserted.data.value)
    const winner = await supabaseAdmin.from('classroom_store').select('value').eq('key', key).maybeSingle()
    dbError(winner.error, `Không đọc được store ${key} sau migrate.`)
    return cloneJson(winner.data?.value ?? legacy)
  })
  readLocks.set(key, operation.catch(() => {}))
  try { return await operation } finally { if (readLocks.get(key) === operation) readLocks.delete(key) }
}

export async function writeStore({ key, value, label = key, expectedVersion = null }) {
  const payload = { value: cloneJson(value), updated_at: new Date().toISOString() }
  let query = supabaseAdmin.from('classroom_store').update(payload).eq('key', key)
  if (expectedVersion !== null) query = query.eq('version', expectedVersion)
  const updated = await query.select('version, updated_at').maybeSingle()
  if (updated.error) dbError(updated.error, `Không lưu được ${label}.`)
  if (updated.data) return updated.data
  if (expectedVersion !== null) {
    const conflict = new Error(`Dữ liệu ${label} vừa được cập nhật ở nơi khác. Hãy tải lại rồi thử lại.`)
    conflict.status = 409
    throw conflict
  }
  const inserted = await supabaseAdmin.from('classroom_store').insert({ key, ...payload, version: 1 }).select('version, updated_at').maybeSingle()
  if (inserted.error && inserted.error.code === '23505') return writeStore({ key, value, label })
  dbError(inserted.error, `Không tạo được ${label}.`)
  return inserted.data
}

export async function updateStore(key, mutator, options = {}) {
  const current = await readStore({ key, ...options })
  const next = await mutator(cloneJson(current))
  await writeStore({ key, value: next, label: options.label || key })
  return next
}
