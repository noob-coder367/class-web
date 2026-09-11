import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PATH = join(__dirname, '../data/rules.default.json')

const BUCKET = 'classroom-data'
const PHOTO_BUCKET = 'violation-photos'
const RULES_FILE = 'rules.json'
const VIOLATIONS_FILE = 'violations.json'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const MAX_PHOTOS = 3
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

let rulesCache = null
let violationsCache = null

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function asText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
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

export function inferPoints(text) {
  const marked = String(text || '').match(/đánh dấu\s+(\d+)\s*lần/i)
  if (marked) {
    const n = Number(marked[1])
    if (n >= 3) return 15
    if (n >= 2) return 10
    return 5
  }
  if (/nhắc nhở/i.test(String(text || '')) && !/đánh dấu/i.test(String(text || ''))) {
    return 3
  }
  return 5
}

export function itemText(item) {
  if (typeof item === 'string') return asText(item)
  if (item && typeof item === 'object') return asText(item.text)
  return ''
}

export function itemPoints(item) {
  if (item && typeof item === 'object' && item.points != null) {
    return clampInt(item.points, 0, 100, inferPoints(itemText(item)))
  }
  return inferPoints(itemText(item))
}

function normalizeRuleItem(item) {
  const text = itemText(item)
  if (!text) return null
  return { text, points: itemPoints(item) }
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
        .map((item) => normalizeRuleItem(item))
        .filter(Boolean)
        .slice(0, 30),
    }
  })

  const noticeSrc = src.notice && typeof src.notice === 'object' ? src.notice : {}
  return {
    title: asText(src.title, fallback.title) || fallback.title,
    startingPoints: clampInt(src.startingPoints, 1, 200, fallback.startingPoints || 100),
    sections,
    notice: {
      title: asText(noticeSrc.title, fallback.notice.title) || fallback.notice.title,
      body: asText(noticeSrc.body, fallback.notice.body) || fallback.notice.body,
    },
    updatedAt: asText(src.updatedAt) || new Date().toISOString(),
  }
}

function offensePointsMap(rules) {
  const map = new Map()
  for (const section of rules?.sections || []) {
    for (const item of section.items || []) {
      const text = itemText(item)
      const name = text.split(/\s*:\s*/)[0].trim()
      if (name && !map.has(name)) map.set(name, itemPoints(item))
    }
  }
  return map
}

function stripDataUrl(contentBase64) {
  const raw = String(contentBase64 || '').trim()
  const match = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  return match ? match[1] : raw.replace(/\s+/g, '')
}

function sanitizeFilename(name, ext) {
  const base = String(name || 'anh')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const stamp = Date.now().toString(36)
  return `${base || 'anh'}-${stamp}.${ext}`
}

function publicPhotoUrl(filePath) {
  const { data } = supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(filePath)
  return data?.publicUrl || ''
}

function normalizePhoto(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const path = asText(src.path)
  if (!path || path.includes('..') || !path.startsWith('violations/')) return null
  return {
    path,
    name: asText(src.name, path.split('/').pop()).slice(0, 80),
    url: publicPhotoUrl(path),
  }
}

function normalizeViolation(raw, { createId = false, rules } = {}) {
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

  const photos = (Array.isArray(src.photos) ? src.photos : [])
    .map((item) => normalizePhoto(item))
    .filter(Boolean)
    .slice(0, MAX_PHOTOS)

  const map = rules ? offensePointsMap(rules) : new Map()
  const fallbackPoints = map.get(offense) ?? inferPoints(offense)
  const points = clampInt(src.points, 0, 100, fallbackPoints)

  return {
    id,
    date,
    period: asText(src.period).slice(0, 24),
    name: name.slice(0, 80),
    userId: asText(src.userId).slice(0, 64),
    offense: offense.slice(0, 160),
    warning: asText(src.warning).slice(0, 400),
    points,
    photos,
    createdAt: asText(src.createdAt) || new Date().toISOString(),
  }
}

function normalizeViolations(raw, rules) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const itemsSrc = Array.isArray(src.items) ? src.items : Array.isArray(raw) ? raw : []
  const items = []
  for (const row of itemsSrc.slice(0, 300)) {
    try {
      items.push(normalizeViolation(row, { rules }))
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

async function ensurePhotoBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(PHOTO_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(PHOTO_BUCKET, {
      public: true,
      fileSizeLimit: MAX_PHOTO_BYTES,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho ảnh vi phạm: ' + error.message, 502)
    }
  } else if (data.public === false) {
    await supabaseAdmin.storage.updateBucket(PHOTO_BUCKET, {
      public: true,
      fileSizeLimit: MAX_PHOTO_BYTES,
    })
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

async function decodePhotoPayload(photo) {
  const src = photo && typeof photo === 'object' ? photo : {}
  const mime = String(src.mimeType || '').toLowerCase()
  const ext = ALLOWED_MIME[mime]
  if (!ext) throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.')
  const pure = stripDataUrl(src.contentBase64)
  if (!pure) throw new AppError('Thiếu dữ liệu ảnh bằng chứng.')
  let bytes
  try {
    bytes = Buffer.from(pure, 'base64')
  } catch {
    throw new AppError('Ảnh bằng chứng không hợp lệ.')
  }
  if (!bytes.length) throw new AppError('Ảnh bằng chứng trống.')
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new AppError('Mỗi ảnh tối đa 10MB.')
  }
  return {
    bytes,
    mime,
    ext,
    filename: sanitizeFilename(src.filename, ext),
  }
}

async function uploadViolationPhotos(violationId, photos) {
  const list = Array.isArray(photos) ? photos.slice(0, MAX_PHOTOS) : []
  if (!list.length) return []
  await ensurePhotoBucket()
  const uploaded = []
  try {
    for (const photo of list) {
      const decoded = await decodePhotoPayload(photo)
      const filePath = `violations/${violationId}/${decoded.filename}`
      const { error } = await supabaseAdmin.storage.from(PHOTO_BUCKET).upload(filePath, decoded.bytes, {
        contentType: decoded.mime,
        upsert: false,
      })
      if (error) {
        throw new AppError('Không tải được ảnh bằng chứng: ' + error.message, 502)
      }
      uploaded.push({
        path: filePath,
        name: decoded.filename,
        url: publicPhotoUrl(filePath),
      })
    }
  } catch (err) {
    if (uploaded.length) {
      await supabaseAdmin.storage.from(PHOTO_BUCKET).remove(uploaded.map((item) => item.path))
    }
    throw err
  }
  return uploaded
}

async function deletePhotoPaths(paths) {
  const list = (paths || []).filter(Boolean)
  if (!list.length) return
  try {
    await ensurePhotoBucket()
    await supabaseAdmin.storage.from(PHOTO_BUCKET).remove(list)
  } catch (err) {
    console.warn('[violations] không xoá được ảnh:', err.message)
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
  const rules = await getRules()
  try {
    const stored = await readJson(VIOLATIONS_FILE)
    if (stored) {
      violationsCache = normalizeViolations(stored, rules)
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
  const rules = await getRules()
  const incoming = payload && typeof payload === 'object' ? payload : {}
  const row = normalizeViolation(incoming, { createId: true, rules })
  const photoPayloads = Array.isArray(incoming.photos)
    ? incoming.photos.filter((item) => item && item.contentBase64)
    : []
  if (photoPayloads.length > MAX_PHOTOS) {
    throw new AppError(`Tối đa ${MAX_PHOTOS} ảnh bằng chứng.`)
  }
  row.photos = await uploadViolationPhotos(row.id, photoPayloads)
  current.items.unshift(row)
  current.items = current.items.slice(0, 300)
  current.updatedAt = new Date().toISOString()
  try {
    await writeJson(VIOLATIONS_FILE, current, 'danh sách vi phạm')
  } catch (err) {
    await deletePhotoPaths(row.photos.map((item) => item.path))
    throw err
  }
  violationsCache = current
  return clone(row)
}

export async function removeViolation(id) {
  const key = asText(id)
  if (!key) throw new AppError('Thiếu mã vi phạm.', 400)
  const current = await getViolations()
  const target = current.items.find((item) => item.id === key)
  if (!target) throw new AppError('Không tìm thấy vi phạm.', 404)
  current.items = current.items.filter((item) => item.id !== key)
  current.updatedAt = new Date().toISOString()
  await writeJson(VIOLATIONS_FILE, current, 'danh sách vi phạm')
  violationsCache = current
  await deletePhotoPaths((target.photos || []).map((item) => item.path))
  return { ok: true, id: key }
}

export function buildLeaderboard(members, violations, rules) {
  const starting = clampInt(rules?.startingPoints, 1, 200, 100)
  const map = offensePointsMap(rules)
  const list = Array.isArray(members) ? members : []
  const items = Array.isArray(violations) ? violations : []

  const rows = list.map((member) => {
    const mine = items.filter((row) => {
      if (row.userId && member.id) return row.userId === member.id
      return !row.userId && row.name === member.username
    })
    let deducted = 0
    for (const row of mine) {
      const pts = Number.isFinite(Number(row.points))
        ? clampInt(row.points, 0, 100, 5)
        : (map.get(row.offense) ?? inferPoints(row.offense))
      deducted += pts
    }
    return {
      id: member.id,
      username: member.username,
      role: member.role === 'admin' ? 'admin' : 'user',
      score: Math.max(0, starting - deducted),
      deducted,
      violations: mine.length,
    }
  })

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.violations !== b.violations) return a.violations - b.violations
    return String(a.username).localeCompare(String(b.username), 'vi')
  })

  let lastScore = null
  let rank = 0
  for (const row of rows) {
    if (row.score !== lastScore) {
      rank += 1
      lastScore = row.score
    }
    row.rank = rank
  }

  return {
    startingPoints: starting,
    total: rows.length,
    rows,
  }
}
