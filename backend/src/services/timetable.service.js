import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PATH = join(__dirname, '../data/timetable.default.json')

const BUCKET = 'classroom-data'
const FILE_PATH = 'timetable.json'
const DAY_IDS = ['t2', 't3', 't4', 't5', 't6', 't7']
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

let memoryCache = null

function loadDefault() {
  return JSON.parse(readFileSync(DEFAULT_PATH, 'utf8'))
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function asText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function asTime(value, fallback) {
  const text = asText(value, fallback)
  return TIME_RE.test(text) ? text : fallback
}

function normalizeSession(raw, fallback) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const periodsSrc = Array.isArray(src.periods) && src.periods.length
    ? src.periods
    : fallback.periods

  const periods = periodsSrc.slice(0, 8).map((period, index) => {
    const fb = fallback.periods[index] || fallback.periods[fallback.periods.length - 1] || {
      id: index + 1,
      start: '07:00',
      end: '07:45',
    }
    const id = Number(period?.id) || index + 1
    const start = asTime(period?.start, fb.start)
    const end = asTime(period?.end, fb.end)
    const note = asText(period?.note, fb.note || '')
    return note ? { id, start, end, note } : { id, start, end }
  })

  const breaksSrc = Array.isArray(src.breaks) ? src.breaks : fallback.breaks
  const breaks = breaksSrc.slice(0, 4).map((item, index) => {
    const fb = fallback.breaks[index] || { after: 2, start: '08:30', end: '09:00', label: 'Giải lao' }
    return {
      after: Number(item?.after) || fb.after,
      start: asTime(item?.start, fb.start),
      end: asTime(item?.end, fb.end),
      label: asText(item?.label, fb.label) || fb.label,
    }
  })

  const grid = {}
  for (const dayId of DAY_IDS) {
    const col = Array.isArray(src.grid?.[dayId]) ? src.grid[dayId] : fallback.grid[dayId] || []
    grid[dayId] = periods.map((_, index) => asText(col[index], ''))
  }

  const session = {
    label: asText(src.label, fallback.label) || fallback.label,
    daysNote: asText(src.daysNote, fallback.daysNote) || fallback.daysNote,
    arrival: asTime(src.arrival, fallback.arrival),
    periods,
    breaks,
    grid,
  }

  if (src.flagCeremony === null) {
    session.flagCeremony = null
  } else if (src.flagCeremony || fallback.flagCeremony) {
    const fb = fallback.flagCeremony || { time: '06:45', note: '' }
    session.flagCeremony = {
      time: asTime(src.flagCeremony?.time, fb.time),
      note: asText(src.flagCeremony?.note, fb.note),
    }
  } else {
    session.flagCeremony = null
  }

  return session
}

export function normalizeTimetable(raw) {
  const fallback = loadDefault()
  const src = raw && typeof raw === 'object' ? raw : {}

  const subjects = Array.isArray(src.subjects) && src.subjects.length
    ? [...new Set(src.subjects.map((item) => asText(item)).filter(Boolean))].slice(0, 80)
    : fallback.subjects

  return {
    className: asText(src.className, fallback.className) || fallback.className,
    effectiveFrom: asText(src.effectiveFrom, fallback.effectiveFrom) || fallback.effectiveFrom,
    subjects,
    days: fallback.days,
    morning: normalizeSession(src.morning, fallback.morning),
    afternoon: normalizeSession(src.afternoon, fallback.afternoon),
    updatedAt: asText(src.updatedAt) || new Date().toISOString(),
  }
}

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 512 * 1024,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho thời khoá biểu: ' + error.message, 502)
    }
  }
}

async function readFromStorage() {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(FILE_PATH)
  if (error || !data) return null
  const text = await data.text()
  return JSON.parse(text)
}

async function writeToStorage(payload) {
  await ensureBucket()
  const body = Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(FILE_PATH, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) {
    throw new AppError('Không lưu được thời khoá biểu: ' + error.message, 502)
  }
}

export async function getTimetable() {
  if (memoryCache) return clone(memoryCache)

  try {
    const stored = await readFromStorage()
    if (stored) {
      memoryCache = normalizeTimetable(stored)
      return clone(memoryCache)
    }
  } catch (err) {
    console.warn('[timetable] đọc storage thất bại, dùng mặc định:', err.message)
  }

  memoryCache = normalizeTimetable(loadDefault())
  return clone(memoryCache)
}

export async function saveTimetable(payload) {
  const next = normalizeTimetable(payload)
  next.updatedAt = new Date().toISOString()
  await writeToStorage(next)
  memoryCache = next
  return clone(next)
}
