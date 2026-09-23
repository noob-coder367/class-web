import { supabaseAdmin } from '../config/supabaseClient.js'

// Serialize read-modify-write operations inside one backend process. A
// multi-instance deployment still needs a distributed lock/transactional
// database for cross-instance writes; this utility deliberately does not
// pretend that an in-memory queue provides that guarantee.
const queues = new Map()

export function isFileNotFound(error) {
  return !error || error.statusCode === 404 || error.statusCode === '404' || /not found|does not exist|no such file|404/i.test(error.message || '')
}

function storageError(message, status = 502) {
  const error = new Error(message)
  error.status = status
  return error
}

export async function readJsonFile({ bucket, path, empty, label }) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
  if (error || !data) {
    if (isFileNotFound(error)) {
      console.info(`[classroom-data] FILE NOT FOUND path=${path}`)
      return typeof empty === 'function' ? empty() : structuredClone(empty)
    }
    console.error(`[classroom-data] READ failed path=${path}:`, error?.message || 'no data')
    throw storageError(`Không đọc được ${label || path}: ${error?.message || 'Storage không trả dữ liệu.'}`)
  }

  let text
  try {
    text = await data.text()
  } catch (error) {
    console.error(`[classroom-data] READ failed path=${path}:`, error?.message || error)
    throw storageError(`Không đọc được ${label || path}: ${error?.message || 'Không thể đọc file.'}`)
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    console.error(`[classroom-data] INVALID JSON path=${path}:`, error?.message || error)
    throw storageError(`Dữ liệu ${label || path} bị hỏng, không thể phân tích JSON.`, 500)
  }
}

export async function writeJsonFile({ bucket, path, value, label }) {
  const body = Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) {
    console.error(`[classroom-data] WRITE failed path=${path}:`, error.message)
    throw storageError(`Không lưu được ${label || path}: ${error.message}`)
  }
}

export function enqueueJsonWrite(key, operation) {
  const previous = queues.get(key) || Promise.resolve()
  const next = previous.then(operation)
  queues.set(key, next.catch(() => {}))
  return next
}

export function cloneJson(value) {
  return structuredClone(value)
}
