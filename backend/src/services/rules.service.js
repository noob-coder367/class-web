import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PATH = join(__dirname, '../data/rules.default.json')

const BUCKET = 'classroom-data'
const RULES_FILE = 'rules.json'
const VIOLATIONS_FILE = 'violations.json'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

let rulesCache = null
let violationsCache = null

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function asText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function loadDefaultRules() {
  return JSON.parse(readFileSync(DEFAULT_PATH, 'utf8'))
}

function slugId(value, fallback) {
  const base = asText(value, fallback)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
  return base || fallback || randomUUID().slice(0, 8)
}

export function normalizeRules(raw) {
  const fallback = loadDefaultRules()
  const src = raw && typeof raw === 'object' ? raw : {}
  const sectionsSrc = Array.isArray(src.sections) && src.sections.length
    ? src.sections
    : fallback.sections

  const used = new Set()
  const sections = sectionsSrc.slice(0, 12).map((section, index) => {
    const fb = fallback.sections[index] || { id: `s${index + 1}`, title: 'Mục', items: [] }
    let id = slugId(section?.id, fb.id || `s${index + 1}`)
    if (used.has(id)) id = `${id}-${index + 1}`
    used.add(id)
    const itemsSrc = Array.isArray(section?.items) ? section.items : fb.items
    return {
      id,
      title: asText(section?.title, fb.title) || fb.title,
      items: itemsSrc
        .map((item) => asText(item))
        .filter(Boolean)
        .slice(0, 30),
    }
  })

  const noticeSrc = src.notice && typeof src.notice === 'object' ? src.notice : {}
  return {
    title: asText(src.title, fallback.title) || fallback.title,
    sections,
    notice: {
      title: asText(noticeSrc.title, fallback.notice.title) || fallback.notice.title,
      body: asText(noticeSrc.body, fallback.notice.body) || fallback.notice.body,
    },
    updatedAt: asText(src.updatedAt) || new Date().toISOString(),
  }
}

function normalizeViolation(raw, { createId = false } = {}) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const date = DATE_RE.test(asText(src.date)) ? asText(src.date) : ''
  if (!DATE_RE.test(date)) {
    throw new AppError('Ngày vi phạm không hợp lệ.', 400)
  }
  const name = asText(src.name)
  if (!name) throw new AppError('Cần nhập tên học sinh.', 400)
  const offense = asText(src.offense)
  if (!offense) throw new AppError('Cần nhập lỗi vi phạm.', 400)
  const id = asText(src.id) || (createId ? randomUUID() : '')
  if (!id) throw new AppError('Thiếu mã vi phạm.', 400)

  return {
    id,
    date,
    period: asText(src.period).slice(0, 24),
    name: name.slice(0, 80),
    offense: offense.slice(0, 160),
    warning: asText(src.warning).slice(0, 400),
    createdAt: asText(src.createdAt) || new Date().toISOString(),
  }
}

function normalizeViolations(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const itemsSrc = Array.isArray(src.items) ? src.items : Array.isArray(raw) ? raw : []
  const items = []
  for (const row of itemsSrc.slice(0, 300)) {
    try {
      items.push(normalizeViolation(row))
    } catch {
      // bỏ hàng hỏng
    }
  }
  items.sort((a, b) => {
    if (a.date === b.date) return String(b.createdAt).localeCompare(String(a.createdAt))
    return String(b.date).localeCompare(String(a.date))
  })
  return { items, updatedAt: asText(src.updatedAt) || new Date().toISOString() }
}

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 512 * 1024,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho nội quy: ' + error.message, 502)
    }
  }
}

async function readJson(path) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (error || !data) return null
  const text = await data.text()
  return JSON.parse(text)
}

async function writeJson(path, payload, label) {
  await ensureBucket()
  const body = Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) {
    throw new AppError(`Không lưu được ${label}: ` + error.message, 502)
  }
}

export async function getRules() {
  if (rulesCache) return clone(rulesCache)
  try {
    const stored = await readJson(RULES_FILE)
    if (stored) {
      rulesCache = normalizeRules(stored)
      return clone(rulesCache)
    }
  } catch (err) {
    console.warn('[rules] đọc storage thất bại, dùng mặc định:', err.message)
  }
  rulesCache = normalizeRules(loadDefaultRules())
  return clone(rulesCache)
}

export async function saveRules(payload) {
  const next = normalizeRules(payload)
  next.updatedAt = new Date().toISOString()
  await writeJson(RULES_FILE, next, 'nội quy')
  rulesCache = next
  return clone(next)
}

export async function getViolations() {
  if (violationsCache) return clone(violationsCache)
  try {
    const stored = await readJson(VIOLATIONS_FILE)
    if (stored) {
      violationsCache = normalizeViolations(stored)
      return clone(violationsCache)
    }
  } catch (err) {
    console.warn('[violations] đọc storage thất bại:', err.message)
  }
  violationsCache = { items: [], updatedAt: new Date().toISOString() }
  return clone(violationsCache)
}

export async function addViolation(payload) {
  const current = await getViolations()
  const row = normalizeViolation(payload, { createId: true })
  current.items.unshift(row)
  current.items = current.items.slice(0, 300)
  current.updatedAt = new Date().toISOString()
  await writeJson(VIOLATIONS_FILE, current, 'danh sách vi phạm')
  violationsCache = current
  return clone(row)
}

export async function removeViolation(id) {
  const key = asText(id)
  if (!key) throw new AppError('Thiếu mã vi phạm.', 400)
  const current = await getViolations()
  const nextItems = current.items.filter((item) => item.id !== key)
  if (nextItems.length === current.items.length) {
    throw new AppError('Không tìm thấy vi phạm.', 404)
  }
  current.items = nextItems
  current.updatedAt = new Date().toISOString()
  await writeJson(VIOLATIONS_FILE, current, 'danh sách vi phạm')
  violationsCache = current
  return { ok: true, id: key }
}
