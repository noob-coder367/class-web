import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { createDefaultTimetable } from '../data/timetable.default.js'

const TABLE = 'class_contents'
const TAB = 'timetable'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.resolve(__dirname, '../../data/timetable.json')

let memoryCache = null

function isValidTimetable(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.subjects) &&
    Array.isArray(payload.sessions) &&
    payload.sessions.length > 0
  )
}

function readFileFallback() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'))
      if (isValidTimetable(raw)) return raw
    }
  } catch {
    // ignore corrupt file
  }
  return null
}

function writeFileFallback(payload) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(payload, null, 2))
    return true
  } catch {
    return false
  }
}

export async function getTimetable() {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('payload')
      .eq('tab', TAB)
      .maybeSingle()

    if (!error && isValidTimetable(data?.payload)) {
      memoryCache = data.payload
      return data.payload
    }
  } catch {
    // table may not exist yet
  }

  const fromFile = readFileFallback()
  if (fromFile) {
    memoryCache = fromFile
    return fromFile
  }

  if (memoryCache) return memoryCache
  return createDefaultTimetable()
}

export async function saveTimetable(payload, userId) {
  if (!isValidTimetable(payload)) {
    throw new AppError('Dữ liệu thời khoá biểu không hợp lệ.', 400)
  }

  memoryCache = payload

  let persisted = false
  try {
    const { error } = await supabaseAdmin.from(TABLE).upsert({
      tab: TAB,
      payload,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    })
    if (!error) persisted = true
  } catch {
    // fall through to file
  }

  if (writeFileFallback(payload)) persisted = true

  if (!persisted) {
    throw new AppError(
      'Không lưu được thời khoá biểu. Kiểm tra bảng class_contents trên Supabase hoặc quyền ghi thư mục backend/data.',
      500
    )
  }

  return payload
}
