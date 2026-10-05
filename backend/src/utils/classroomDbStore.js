import { supabaseAdmin } from '../config/supabaseClient.js'
import { readJsonFile, cloneJson } from './classroomDataStore.js'

// LEGACY COMPATIBILITY STORE: keep this adapter for existing modules and lazy
// migration from classroom-data/*.json. New large relational features must use
// a repository under ../repositories instead of adding another JSON key here.
const DEFAULT_BUCKET = 'classroom-data'
const DEFAULT_MUTATION_RETRIES = 3

export class ClassroomStoreError extends Error {
  constructor(message, { status = 503, code = 'STORE_ERROR', key, cause } = {}) {
    super(message, { cause })
    this.name = 'ClassroomStoreError'
    this.status = status
    this.code = code
    this.key = key
  }
}

function classifyDatabaseError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  if (code === '42501' || /permission denied|row-level security|rls/.test(message)) return 'PERMISSION_DENIED'
  if (code === '42P01' || /relation .* does not exist|table .* does not exist/.test(message)) return 'MISSING_TABLE'
  if (/timeout|connection|network|fetch failed|socket/.test(message)) return 'CONNECTION_ERROR'
  return 'DATABASE_ERROR'
}

function throwDatabaseError(error, { key, operation }) {
  if (!error) return
  const code = classifyDatabaseError(error)
  console.error(`[classroom-db] ${operation} failed`, {
    key,
    code,
    databaseCode: error.code,
    details: error.details,
    hint: error.hint,
  })
  throw new ClassroomStoreError(`Không thể ${operation} dữ liệu lớp học.`, { code, key, cause: error })
}

function conflict(key, label) {
  return new ClassroomStoreError(`Dữ liệu ${label || key} vừa được cập nhật ở nơi khác. Hãy tải lại rồi thử lại.`, {
    status: 409,
    code: 'VERSION_CONFLICT',
    key,
  })
}

function emptyValue(empty) {
  return typeof empty === 'function' ? empty() : cloneJson(empty)
}

function isFileNotFound(error) {
  return !error || error.statusCode === 404 || error.statusCode === '404' || /not found|does not exist|no such file|404/i.test(error.message || '')
}

async function readLegacy({ readJson, bucket = DEFAULT_BUCKET, path, empty, label }) {
  if (!path) return emptyValue(empty)
  try {
    return await readJson({ bucket, path, empty, label })
  } catch (error) {
    // Missing legacy data is an expected first-run case. A real Storage/JSON
    // failure is not converted to an empty object.
    if (error?.statusCode === 404 || (error?.status === 502 && isFileNotFound(error))) return emptyValue(empty)
    throw error
  }
}

export function createClassroomDbStore({ client = supabaseAdmin, readJson = readJsonFile } = {}) {
  const migrationLocks = new Map()

  async function selectRecord(key, operation = 'đọc') {
    const result = await client.from('classroom_store').select('value, version, updated_at').eq('key', key).maybeSingle()
    throwDatabaseError(result.error, { key, operation })
    return result.data || null
  }

  async function readRecord({ key, legacyPath = `${key}.json`, bucket = DEFAULT_BUCKET, empty = {}, label = key }) {
    const existing = await selectRecord(key)
    if (existing) return { ...existing, value: cloneJson(existing.value) }

    const previous = migrationLocks.get(key) || Promise.resolve()
    const operation = previous.then(async () => {
      const recheck = await selectRecord(key)
      if (recheck) return { ...recheck, value: cloneJson(recheck.value) }
      const legacy = await readLegacy({ readJson, bucket, path: legacyPath, empty, label })
      const inserted = await client
        .from('classroom_store')
        .insert({ key, value: cloneJson(legacy), version: 1 })
        .select('value, version, updated_at')
        .maybeSingle()
      if (inserted.error && inserted.error.code !== '23505') throwDatabaseError(inserted.error, { key, operation: 'khởi tạo' })
      if (inserted.data) {
        console.info(`[classroom-db] lazy migration completed key=${key}`)
        return { ...inserted.data, value: cloneJson(inserted.data.value) }
      }
      const winner = await selectRecord(key, 'đọc sau khởi tạo')
      if (!winner) throw new ClassroomStoreError('Không đọc được dữ liệu lớp học sau khi khởi tạo.', { key })
      return { ...winner, value: cloneJson(winner.value) }
    })
    migrationLocks.set(key, operation.catch(() => {}))
    try {
      return await operation
    } finally {
      if (migrationLocks.get(key) === operation) migrationLocks.delete(key)
    }
  }

  async function readStore(options) {
    const record = await readRecord(options)
    return cloneJson(record.value)
  }

  async function readStoreMeta(options) {
    const record = await readRecord(options)
    return { value: cloneJson(record.value), version: Number(record.version) || 1, updatedAt: record.updated_at || null }
  }

  async function writeVersioned({ key, value, expectedVersion, label = key }) {
    const nextVersion = Number(expectedVersion) + 1
    const result = await client
      .from('classroom_store')
      .update({ value: cloneJson(value), version: nextVersion, updated_at: new Date().toISOString() })
      .eq('key', key)
      .eq('version', expectedVersion)
      .select('version, updated_at')
      .maybeSingle()
    throwDatabaseError(result.error, { key, operation: `ghi ${label}` })
    if (!result.data) throw conflict(key, label)
    return result.data
  }

  async function writeStore({ key, value, label = key, expectedVersion = null }) {
    if (expectedVersion !== null) return writeVersioned({ key, value, expectedVersion, label })

    const current = await readRecord({ key, empty: {} })
    return writeVersioned({ key, value, expectedVersion: Number(current.version) || 1, label })
  }

  async function updateStore(key, mutator, options = {}) {
    const maxRetries = Math.min(8, Math.max(0, Number.parseInt(options.maxRetries, 10) || DEFAULT_MUTATION_RETRIES))
    let lastConflict = null
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const current = await readStoreMeta({ key, ...options })
      const next = await mutator(cloneJson(current.value), { version: current.version, attempt })
      try {
        await writeVersioned({ key, value: next, expectedVersion: current.version, label: options.label || key })
        return cloneJson(next)
      } catch (error) {
        if (error?.code !== 'VERSION_CONFLICT') throw error
        lastConflict = error
      }
    }
    throw lastConflict || conflict(key, options.label || key)
  }

  return { readStore, readStoreMeta, writeStore, updateStore }
}

const defaultStore = createClassroomDbStore()
export const readStore = (options) => defaultStore.readStore(options)
export const readStoreMeta = (options) => defaultStore.readStoreMeta(options)
export const writeStore = (options) => defaultStore.writeStore(options)
export const updateStore = (key, mutator, options) => defaultStore.updateStore(key, mutator, options)
