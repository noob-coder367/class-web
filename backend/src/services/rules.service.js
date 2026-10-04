import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { isStatusDrop, statusFor } from '../lib/reputationStatus.js'
import * as announcementsService from './announcements.service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PATH = join(__dirname, '../data/rules.default.json')

const PHOTO_BUCKET = 'violation-photos'
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

function foldName(value) {
  return asText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function namesEqual(a, b) {
  const x = foldName(a)
  const y = foldName(b)
  return Boolean(x) && x === y
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

export async function createViolationPhotoUploadUrls(files) {
  const list = Array.isArray(files) ? files : []
  if (!list.length || list.length > MAX_PHOTOS) throw new AppError(`Mỗi lượt tải tối đa ${MAX_PHOTOS} ảnh bằng chứng.`, 400)
  await ensurePhotoBucket()
  const uploads = await Promise.all(list.map(async (file) => {
    const mime = String(file?.mimeType || '').toLowerCase()
    const ext = ALLOWED_MIME[mime]
    const sizeBytes = Number(file?.sizeBytes ?? file?.size)
    if (!ext) throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.')
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_PHOTO_BYTES) throw new AppError('Mỗi ảnh tối đa 10MB.')
    const path = `violations/pending/${randomUUID()}.${ext}`
    const result = await supabaseAdmin.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path, { upsert: false })
    if (result.error) throw new AppError('Không tạo được liên kết tải ảnh bằng chứng.', 502)
    return { path, token: result.data.token, signedUrl: result.data.signedUrl, mimeType: mime, sizeBytes }
  }))
  return { bucket: PHOTO_BUCKET, uploads }
}

async function uploadViolationPhotos(photos) {
  const list = Array.isArray(photos) ? photos.slice(0, MAX_PHOTOS) : []
  if (!list.length) return []
  await ensurePhotoBucket()
  const result = []
  for (const photo of list) {
    const mime = String(photo?.mimeType || '').toLowerCase()
    const ext = ALLOWED_MIME[mime]
    const path = String(photo?.path || '')
    const sizeBytes = Number(photo?.sizeBytes)
    if (!ext || !path.startsWith('violations/pending/') || path.includes('..') || path.split('/').length !== 3 || !path.toLowerCase().endsWith(`.${ext}`)) throw new AppError('Ảnh bằng chứng tải lên không hợp lệ.', 400)
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_PHOTO_BYTES) throw new AppError('Mỗi ảnh tối đa 10MB.')
    const name = sanitizeFilename(photo?.filename || path.split('/').pop(), ext)
    const { data, error } = await supabaseAdmin.storage.from(PHOTO_BUCKET).list('violations/pending', { search: path.split('/').pop(), limit: 100 })
    if (error) throw new AppError('Không thể xác minh ảnh bằng chứng.', 502)
    const object = (data || []).find((row) => row.name === path.split('/').pop())
    if (!object) throw new AppError('Ảnh bằng chứng chưa được tải lên Storage.', 400)
    if (Number.isFinite(Number(object.metadata?.size)) && Number(object.metadata.size) !== sizeBytes) throw new AppError('Kích thước ảnh bằng chứng không khớp.', 400)
    result.push({ path, name, url: publicPhotoUrl(path), mime, sizeBytes })
  }
  return result
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
  if (!DATE_RE.test(date)) throw new AppError('Ngày vi phạm không hợp lệ.', 400)
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

  const rawUserId = asText(src.userId)
  const rosterId = asText(src.rosterId) || (rawUserId.startsWith('roster:') ? rawUserId.slice(7) : '')
  const userId = rosterId ? '' : rawUserId

  return {
    id,
    date,
    period: asText(src.period).slice(0, 24),
    name: name.slice(0, 80),
    userId: userId.slice(0, 64),
    rosterId: rosterId.slice(0, 64),
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
  return true
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

function throwQueryError(error, message) {
  if (error) throw new AppError(`${message}: ${error.message || 'database error'}`, 500)
}

function ruleRowsToDto(setting, sectionRows, itemRows) {
  const itemsBySection = new Map()
  for (const item of itemRows || []) {
    const list = itemsBySection.get(item.section_id) || []
    list.push({ text: item.text, points: item.points })
    itemsBySection.set(item.section_id, list)
  }
  return {
    title: setting?.title,
    startingPoints: setting?.starting_points,
    sections: (sectionRows || []).map((section) => ({
      id: section.id,
      title: section.title,
      items: itemsBySection.get(section.id) || [],
    })),
    notice: { title: setting?.notice_title, body: setting?.notice_body },
    updatedAt: setting?.updated_at,
  }
}

function violationRowToDto(row, photos) {
  return normalizeViolation({
    id: row.id,
    date: row.violation_date,
    period: row.period,
    name: row.student_name,
    userId: row.user_id,
    rosterId: row.roster_id,
    offense: row.offense,
    warning: row.warning,
    points: row.points,
    createdAt: row.created_at,
    photos: (photos || []).map((photo) => ({ path: photo.storage_path, name: photo.name })),
  })
}

async function readRuleRows() {
  const [settingResult, sectionsResult] = await Promise.all([
    supabaseAdmin.from('rules_settings').select('id, title, starting_points, notice_title, notice_body, updated_at, violations_updated_at').eq('id', 'default').maybeSingle(),
    supabaseAdmin.from('rule_sections').select('id, title, position, rule_items(section_id, position, text, points)').eq('settings_id', 'default').order('position', { ascending: true }),
  ])
  throwQueryError(settingResult.error, 'Không thể đọc cấu hình nội quy')
  throwQueryError(sectionsResult.error, 'Không thể đọc mục nội quy')
  const sections = (sectionsResult.data || []).map((section) => ({
    id: section.id,
    title: section.title,
    position: section.position,
  }))
  const items = (sectionsResult.data || []).flatMap((section) => (
    Array.isArray(section.rule_items) ? section.rule_items : []
  )).sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
  return { setting: settingResult.data, sections, items }
}

async function writeRules(next) {
  const settingValues = {
    title: next.title,
    starting_points: next.startingPoints,
    notice_title: next.notice.title,
    notice_body: next.notice.body,
    updated_at: next.updatedAt,
  }
  const settingUpdate = await supabaseAdmin.from('rules_settings').update(settingValues).eq('id', 'default').select('id').maybeSingle()
  throwQueryError(settingUpdate.error, 'Không thể lưu cấu hình nội quy')
  if (!settingUpdate.data) {
    const settingInsert = await supabaseAdmin.from('rules_settings').insert({ id: 'default', ...settingValues })
    throwQueryError(settingInsert.error, 'Không thể lưu cấu hình nội quy')
  }

  const deleteResult = await supabaseAdmin.from('rule_sections').delete().eq('settings_id', 'default')
  throwQueryError(deleteResult.error, 'Không thể thay thế các mục nội quy')
  const sections = next.sections.map((section, position) => ({
    id: section.id,
    settings_id: 'default',
    title: section.title,
    position,
  }))
  if (!sections.length) return
  const sectionResult = await supabaseAdmin.from('rule_sections').insert(sections)
  throwQueryError(sectionResult.error, 'Không thể lưu các mục nội quy')
  const items = next.sections.flatMap((section) => section.items.map((item, position) => ({
    section_id: section.id,
    position,
    text: item.text,
    points: item.points,
  })))
  if (items.length) {
    const itemResult = await supabaseAdmin.from('rule_items').insert(items)
    throwQueryError(itemResult.error, 'Không thể lưu chi tiết nội quy')
  }
}

async function readViolationRows(options = {}) {
  const page = Math.min(10000, Math.max(1, Number.parseInt(options.page, 10) || 1))
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(options.pageSize, 10) || 100))
  const from = (page - 1) * pageSize
  const parseDate = (value) => {
    const date = String(value || '').trim()
    if (!DATE_RE.test(date)) return null
    const parsed = new Date(`${date}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date
  }
  const sort = options.sort === 'oldest' ? 'asc' : 'desc'
  let listQuery = supabaseAdmin.from('rule_violations')
    .select('id, violation_date, period, student_name, user_id, roster_id, offense, warning, points, created_at, updated_at', { count: 'exact' })
    .order('violation_date', { ascending: sort === 'asc' }).order('created_at', { ascending: sort === 'asc' })
  const fromDate = parseDate(options.dateFrom), toDate = parseDate(options.dateTo)
  if (fromDate) listQuery = listQuery.gte('violation_date', fromDate)
  if (toDate) listQuery = listQuery.lte('violation_date', toDate)
  if (options.userId) listQuery = listQuery.eq('user_id', String(options.userId))
  if (options.rosterId) listQuery = listQuery.eq('roster_id', String(options.rosterId))
  if (options.memberName) listQuery = listQuery.ilike('student_name', `%${String(options.memberName).replace(/[\%_]/g, '\\$&').slice(0, 80)}%`)
  const violationsResult = await listQuery.range(from, from + pageSize - 1)
  throwQueryError(violationsResult.error, 'Không thể đọc danh sách vi phạm')
  const ids = (violationsResult.data || []).map((row) => row.id)
  const photosResult = ids.length
    ? await supabaseAdmin.from('rule_violation_photos').select('violation_id, storage_path, name, position').in('violation_id', ids).order('position', { ascending: true }).range(0, pageSize * MAX_PHOTOS - 1)
    : { data: [], error: null }
  throwQueryError(photosResult.error, 'Không thể đọc ảnh bằng chứng')
  const photosByViolation = new Map()
  for (const photo of photosResult.data || []) {
    const list = photosByViolation.get(photo.violation_id) || []
    list.push(photo)
    photosByViolation.set(photo.violation_id, list)
  }
  return { rows: violationsResult.data || [], photosByViolation, page, pageSize, from, total: violationsResult.count || 0 }
}

async function touchViolations(updatedAt) {
  const result = await supabaseAdmin.from('rules_settings').update({
    violations_updated_at: updatedAt,
  }).eq('id', 'default').select('id').maybeSingle()
  throwQueryError(result.error, 'Không thể cập nhật thời gian danh sách vi phạm')
  if (!result.data) {
    const insertResult = await supabaseAdmin.from('rules_settings').insert({
      id: 'default',
      violations_updated_at: updatedAt,
    })
    throwQueryError(insertResult.error, 'Không thể cập nhật thời gian danh sách vi phạm')
  }
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
  const stored = await readRuleRows()
  if (stored.setting || stored.sections.length) {
    rulesCache = normalizeRules(ruleRowsToDto(stored.setting, stored.sections, stored.items))
    return clone(rulesCache)
  }
  rulesCache = normalizeRules(loadDefaultRules())
  return clone(rulesCache)
}

export async function saveRules(payload) {
  const next = normalizeRules(payload)
  next.updatedAt = new Date().toISOString()
  await writeRules(next)
  rulesCache = next
  return clone(next)
}

export async function getViolations(options = {}) {
  const stored = await readViolationRows(options)
  const items = stored.rows.map((row) => violationRowToDto(row, stored.photosByViolation.get(row.id))).filter(Boolean)
  const settingResult = await supabaseAdmin.from('rules_settings').select('violations_updated_at').eq('id', 'default').maybeSingle()
  throwQueryError(settingResult.error, 'Không thể đọc thời gian danh sách vi phạm')
  const updatedAt = settingResult.data?.violations_updated_at || items[0]?.createdAt || new Date().toISOString()
  violationsCache = { items, updatedAt }
  return { ...clone(violationsCache), pagination: { page: stored.page, pageSize: stored.pageSize, total: stored.total, hasMore: stored.from + items.length < stored.total } }
}

export async function addViolation(payload) {
  const current = await getViolations()
  const rules = await getRules()
  const incoming = payload && typeof payload === 'object' ? payload : {}
  const row = normalizeViolation(incoming, { createId: true, rules })
  const before = await buildLeaderboardFromDatabase([{ id: row.userId || row.rosterId || `roster:${row.name}`, username: row.name, is_placeholder: !row.userId, roster_id: row.rosterId }], rules)
  const oldScore = before.rows[0]?.score ?? clampInt(rules?.startingPoints, 1, 200, 100)
  const photoPayloads = Array.isArray(incoming.photos) ? incoming.photos : []
  if (photoPayloads.length > MAX_PHOTOS) {
    throw new AppError(`Tối đa ${MAX_PHOTOS} ảnh bằng chứng.`)
  }
  row.photos = await uploadViolationPhotos(photoPayloads)
  const updatedAt = new Date().toISOString()
  let rowInserted = false
  try {
    const result = await supabaseAdmin.from('rule_violations').insert({
      id: row.id,
      violation_date: row.date,
      period: row.period,
      student_name: row.name,
      user_id: row.userId || null,
      roster_id: row.rosterId || null,
      offense: row.offense,
      warning: row.warning,
      points: row.points,
      created_at: row.createdAt,
      updated_at: updatedAt,
    })
    throwQueryError(result.error, 'Không thể lưu vi phạm')
    rowInserted = true
    if (row.photos.length) {
      const photoResult = await supabaseAdmin.from('rule_violation_photos').insert(row.photos.map((photo, position) => ({
        violation_id: row.id,
        position,
        storage_path: photo.path,
        name: photo.name,
      })))
      throwQueryError(photoResult.error, 'Không thể lưu ảnh bằng chứng')
    }
    await touchViolations(updatedAt)
  } catch (err) {
    if (rowInserted) await supabaseAdmin.from('rule_violations').delete().eq('id', row.id)
    await deletePhotoPaths(row.photos.map((item) => item.path))
    throw err
  }
  const nextItems = [row, ...current.items].slice(0, 300)
  violationsCache = { items: nextItems, updatedAt }
  const after = await buildLeaderboardFromDatabase([{ id: row.userId || row.rosterId || `roster:${row.name}`, username: row.name, is_placeholder: !row.userId, roster_id: row.rosterId }], rules)
  const newScore = after.rows[0]?.score ?? oldScore
  void announceIfStatusDropped(row, oldScore, newScore)
  return clone(row)
}

export async function removeViolation(id) {
  const key = asText(id)
  if (!key) throw new AppError('Thiếu mã vi phạm.', 400)
  const [found, photoRows] = await Promise.all([
    supabaseAdmin.from('rule_violations').select('id').eq('id', key).maybeSingle(),
    supabaseAdmin.from('rule_violation_photos').select('storage_path').eq('violation_id', key).range(0, MAX_PHOTOS - 1),
  ])
  throwQueryError(found.error, 'Không thể kiểm tra vi phạm')
  throwQueryError(photoRows.error, 'Không thể đọc ảnh bằng chứng')
  if (!found.data) throw new AppError('Không tìm thấy vi phạm.', 404)
  const result = await supabaseAdmin.from('rule_violations').delete().eq('id', key)
  throwQueryError(result.error, 'Không thể xoá vi phạm')
  const updatedAt = new Date().toISOString()
  await touchViolations(updatedAt)
  if (violationsCache) violationsCache = { ...violationsCache, items: violationsCache.items.filter((item) => item.id !== key), updatedAt }
  await deletePhotoPaths((photoRows.data || []).map((item) => item.storage_path))
  return { ok: true, id: key }
}

export async function buildLeaderboardFromDatabase(members, rules) {
  const list = Array.isArray(members) ? members : []
  const normalized = list.map((member) => ({
    id: String(member?.id || ''), username: String(member?.username || ''),
    is_placeholder: member?.is_placeholder === true, roster_id: String(member?.roster_id || ''),
  }))
  const totals = await supabaseAdmin.rpc('rules_member_violation_totals', { p_members: normalized })
  throwQueryError(totals.error, 'Không thể tổng hợp vi phạm thành viên')
  const stats = new Map((totals.data || []).map((row) => [row.member_id, row]))
  const starting = clampInt(rules?.startingPoints, 1, 200, 100)
  const rows = list.map((member) => {
    const total = stats.get(String(member?.id || '')) || { deducted: 0, violation_count: 0 }
    const deducted = Number(total.deducted) || 0
    return { id: member.id, username: member.username, role: member.role, is_placeholder: member.is_placeholder === true,
      score: Math.max(0, starting - deducted), deducted, violations: Number(total.violation_count) || 0 }
  })
  rows.sort((a, b) => b.score - a.score || a.violations - b.violations || String(a.username).localeCompare(String(b.username), 'vi'))
  let lastScore = null, rank = 0
  for (const row of rows) { if (row.score !== lastScore) { rank += 1; lastScore = row.score } row.rank = rank }
  return { startingPoints: starting, total: rows.length, rows }
}

export function buildLeaderboard(members, violations, rules) {
  const starting = clampInt(rules?.startingPoints, 1, 200, 100)
  const map = offensePointsMap(rules)
  const list = Array.isArray(members) ? members : []
  const items = Array.isArray(violations) ? violations : []

  const rows = list.map((member) => {
    const mine = items.filter((row) => violationBelongsToMember(row, member))
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
      role: member.role,
      is_placeholder: member.is_placeholder === true,
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

  return { startingPoints: starting, total: rows.length, rows }
}

function violationBelongsToMember(row, member) {
  if (!row || !member) return false
  if (member.is_placeholder) {
    if (row.rosterId && member.roster_id) return row.rosterId === member.roster_id
    return !row.userId && namesEqual(row.name, member.username)
  }
  if (row.userId && member.id && !String(member.id).startsWith('roster:')) {
    return row.userId === member.id
  }
  return !row.userId && namesEqual(row.name, member.username)
}

function memberScore({ userId, name, rosterId }, items, rules) {
  const starting = clampInt(rules?.startingPoints, 1, 200, 100)
  const map = offensePointsMap(rules)
  const uid = asText(userId)
  const display = asText(name)
  const rid = asText(rosterId)
  const mine = (Array.isArray(items) ? items : []).filter((row) => {
    if (rid && row.rosterId) return row.rosterId === rid
    if (uid && row.userId && !uid.startsWith('roster:')) return row.userId === uid
    return !row.userId && display && namesEqual(row.name, display)
  })
  let deducted = 0
  for (const row of mine) {
    const pts = Number.isFinite(Number(row.points))
      ? clampInt(row.points, 0, 100, 5)
      : (map.get(row.offense) ?? inferPoints(row.offense))
    deducted += pts
  }
  return Math.max(0, starting - deducted)
}

export async function remapViolationsToUser({ fromName, fromRosterId, toUserId, toName }) {
  const targetName = asText(toName)
  const targetUserId = asText(toUserId)
  if (!targetName || !targetUserId) return { changed: 0 }

  let update = supabaseAdmin.from('rule_violations').update({
    student_name: targetName, user_id: targetUserId, roster_id: null, updated_at: new Date().toISOString(),
  }).is('user_id', null).select('id')
  if (fromRosterId) update = update.eq('roster_id', fromRosterId)
  else update = update.ilike('student_name', String(fromName || '').replace(/[\%_]/g, '\\$&'))
  const changed = await update
  throwQueryError(changed.error, 'Không thể kết nối vi phạm với tài khoản')
  const changedRows = changed.data || []
  if (!changedRows.length) return { changed: 0 }
  const updatedAt = new Date().toISOString()
  await touchViolations(updatedAt)
  if (violationsCache) violationsCache.updatedAt = updatedAt
  return { changed: changedRows.length }
}

async function announceIfStatusDropped(member, oldScore, newScore) {
  const from = statusFor(oldScore)
  const to = statusFor(newScore)
  if (!isStatusDrop(from, to)) return
  try {
    await announcementsService.createSystemDisciplineAnnouncement({
      userId: member.userId || null,
      name: member.name,
      fromLevel: from.level,
      toLevel: to.level,
      fromLabel: from.label,
      toLabel: to.label,
      content:
        `⚠️ ${member.name} đã tụt 1 bậc trạng thái uy tín: ${from.label} → ${to.label}.\n\n`
        + `Hãy chú ý nội quy lớp để lấy lại điểm uy tín.`,
    })
  } catch (err) {
    console.warn('[rules] không tạo được thông báo kỷ luật:', err?.message || err)
  }
}
