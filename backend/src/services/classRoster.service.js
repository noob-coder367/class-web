import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError, isPendingUsername, normalizeDisplayName } from './auth.service.js'
import { normalizeRole } from '../lib/roles.js'
import * as rulesService from './rules.service.js'
import * as cleaningDutyService from './cleaningDuty.service.js'

const BUCKET = 'classroom-data'
const ROSTER_FILE = 'class-roster.json'

let rosterCache = null

function asText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

export function foldName(value) {
  return asText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function namesEqual(a, b) {
  const x = foldName(a)
  const y = foldName(b)
  return Boolean(x) && x === y
}

export function placeholderMemberId(rosterId) {
  return `roster:${asText(rosterId)}`
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizePlaceholder(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const name = asText(src.name)
  const id = asText(src.id) || randomUUID()
  if (!name) return null
  return {
    id,
    name: name.slice(0, 40),
    createdAt: asText(src.createdAt) || new Date().toISOString(),
    createdBy: asText(src.createdBy).slice(0, 64) || null,
  }
}

function normalizeRoster(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const items = (Array.isArray(src.items) ? src.items : [])
    .map((row) => normalizePlaceholder(row))
    .filter(Boolean)
  const seen = new Set()
  const unique = []
  for (const row of items) {
    const key = foldName(row.name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(row)
  }
  unique.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  return {
    items: unique.slice(0, 200),
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
      throw new AppError('Không tạo được kho danh sách lớp: ' + error.message, 502)
    }
  }
}

async function readJson() {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(ROSTER_FILE)
  if (error || !data) return null
  const text = await data.text()
  return JSON.parse(text)
}

async function writeRoster(payload) {
  await ensureBucket()
  const body = Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(ROSTER_FILE, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw new AppError('Không lưu được danh sách lớp: ' + error.message, 502)
}

async function loadRoster() {
  if (rosterCache) return clone(rosterCache)
  try {
    const stored = await readJson()
    if (stored) {
      rosterCache = normalizeRoster(stored)
      return clone(rosterCache)
    }
  } catch (err) {
    console.warn('[class-roster] đọc storage thất bại:', err.message)
  }
  rosterCache = { items: [], updatedAt: new Date().toISOString() }
  return clone(rosterCache)
}

async function saveRoster(next) {
  const payload = normalizeRoster(next)
  payload.updatedAt = new Date().toISOString()
  await writeRoster(payload)
  rosterCache = payload
  return clone(payload)
}

async function listNamedProfiles() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, role, is_member, created_at')
    .order('username', { ascending: true })

  if (error) throw new AppError('Không thể tải danh sách tài khoản lớp.', 500)

  return (data || [])
    .filter((row) => row?.username && !isPendingUsername(row.username))
    .map((row) => ({
      id: row.id,
      username: String(row.username).trim(),
      role: normalizeRole(row.role),
      is_member: row.is_member === true,
      created_at: row.created_at || null,
      is_placeholder: false,
      roster_id: null,
    }))
}

function findNameMatches(name, profiles) {
  const folded = foldName(name)
  if (!folded) return []
  return profiles.filter((row) => foldName(row.username) === folded)
}

export async function listClassRoster() {
  const [profiles, roster] = await Promise.all([listNamedProfiles(), loadRoster()])
  const placeholders = roster.items.map((row) => {
    const matches = findNameMatches(row.name, profiles)
    return {
      id: placeholderMemberId(row.id),
      username: row.name,
      role: 'user',
      is_member: false,
      created_at: row.createdAt,
      is_placeholder: true,
      roster_id: row.id,
      match_user_ids: matches.map((item) => item.id),
      match_names: matches.map((item) => item.username),
    }
  })

  const rows = [...placeholders, ...profiles]
  rows.sort((a, b) => {
    if (a.is_placeholder !== b.is_placeholder) return a.is_placeholder ? -1 : 1
    return String(a.username).localeCompare(String(b.username), 'vi')
  })
  return rows
}

export async function addPlaceholder(rawName, profile) {
  const name = normalizeDisplayName(rawName)
  const [profiles, roster] = await Promise.all([listNamedProfiles(), loadRoster()])

  if (profiles.some((row) => namesEqual(row.username, name))) {
    throw new AppError(
      'Tên này đã trùng tài khoản đã đăng ký. Hãy bấm Kết nối trên tên chờ, hoặc dùng tên khác.'
    )
  }
  if (roster.items.some((row) => namesEqual(row.name, name))) {
    throw new AppError('Tên này đã có trong danh sách lớp.')
  }

  roster.items.push({
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    createdBy: profile?.id || null,
  })
  await saveRoster(roster)
  return listClassRoster()
}

export async function removePlaceholder(rosterId) {
  const key = asText(rosterId)
  if (!key) throw new AppError('Thiếu mã tên trong danh sách lớp.', 400)
  const roster = await loadRoster()
  const target = roster.items.find((row) => row.id === key)
  if (!target) throw new AppError('Không tìm thấy tên chờ kết nối.', 404)
  roster.items = roster.items.filter((row) => row.id !== key)
  await saveRoster(roster)
  return listClassRoster()
}

export async function connectPlaceholder(rosterId, realUserId) {
  const key = asText(rosterId)
  const userId = asText(realUserId)
  if (!key) throw new AppError('Thiếu mã tên chờ kết nối.', 400)
  if (!userId) throw new AppError('Hãy chọn tài khoản thật để kết nối.', 400)

  const roster = await loadRoster()
  const fake = roster.items.find((row) => row.id === key)
  if (!fake) throw new AppError('Không tìm thấy tên chờ kết nối.', 404)

  const { data: real, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, role, is_member')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new AppError('Không đọc được tài khoản đích.', 500)
  if (!real) throw new AppError('Không tìm thấy tài khoản đã đăng nhập.', 404)
  if (!real.username || isPendingUsername(real.username)) {
    throw new AppError('Tài khoản đích chưa đặt tên hiển thị.')
  }

  const realName = String(real.username).trim()
  const [violationsResult, cleaningResult] = await Promise.all([
    rulesService.remapViolationsToUser({
      fromName: fake.name,
      fromRosterId: fake.id,
      toUserId: real.id,
      toName: realName,
    }),
    cleaningDutyService.remapAssigneeName(fake.name, realName),
  ])

  roster.items = roster.items.filter((row) => row.id !== key)
  await saveRoster(roster)

  return {
    connected: {
      roster_id: fake.id,
      from_name: fake.name,
      user_id: real.id,
      username: realName,
      violations: violationsResult?.changed || 0,
      cleaning_weeks: cleaningResult?.changed || 0,
    },
    items: await listClassRoster(),
  }
}
