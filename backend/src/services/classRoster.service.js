import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError, isPendingUsername, normalizeDisplayName } from './auth.service.js'
import { normalizeRole } from '../lib/roles.js'
import * as rulesService from './rules.service.js'
import * as cleaningDutyService from './cleaningDuty.service.js'

const DEFAULT_ROSTER_ID = 'default'
const ROSTER_TABLE = 'class_roster_members'
const ROSTER_SELECT = 'id, roster_id, name, created_at, created_by'

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

async function listRosterItems() {
  const { data, error } = await supabaseAdmin
    .from(ROSTER_TABLE)
    .select(ROSTER_SELECT)
    .eq('roster_id', DEFAULT_ROSTER_ID)
    .order('name', { ascending: true })
    .range(0, 99)

  if (error) throw new AppError('Không thể tải danh sách lớp.', 500)
  return (data || []).map((row) => ({
    id: asText(row.id),
    name: asText(row.name),
    createdAt: row.created_at || new Date().toISOString(),
    createdBy: asText(row.created_by) || null,
  }))
}

async function listNamedProfiles() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, role, is_member, created_at')
    .order('username', { ascending: true })
    .range(0, 99)

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
  const [profiles, rosterItems] = await Promise.all([listNamedProfiles(), listRosterItems()])
  const placeholders = rosterItems.map((row) => {
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
  const [profiles, rosterItems] = await Promise.all([listNamedProfiles(), listRosterItems()])

  if (profiles.some((row) => namesEqual(row.username, name))) {
    throw new AppError(
      'Tên này đã trùng tài khoản đã đăng ký. Hãy bấm Kết nối trên tên chờ, hoặc dùng tên khác.'
    )
  }
  if (rosterItems.some((row) => namesEqual(row.name, name))) {
    throw new AppError('Tên này đã có trong danh sách lớp.')
  }

  const { error } = await supabaseAdmin
    .from(ROSTER_TABLE)
    .insert({
      id: randomUUID(),
      roster_id: DEFAULT_ROSTER_ID,
      name: name.slice(0, 40),
      created_by: asText(profile?.id).slice(0, 64) || null,
    })

  if (error) {
    if (error.code === '23505') throw new AppError('Tên này đã có trong danh sách lớp.')
    throw new AppError('Không thể lưu danh sách lớp.', 500)
  }
  return listClassRoster()
}

export async function removePlaceholder(rosterId) {
  const key = asText(rosterId)
  if (!key) throw new AppError('Thiếu mã tên trong danh sách lớp.', 400)
  const { data: target, error: readError } = await supabaseAdmin
    .from(ROSTER_TABLE)
    .select('id')
    .eq('roster_id', DEFAULT_ROSTER_ID)
    .eq('id', key)
    .maybeSingle()
  if (readError) throw new AppError('Không thể đọc danh sách lớp.', 500)
  if (!target) throw new AppError('Không tìm thấy tên chờ kết nối.', 404)

  const { error } = await supabaseAdmin
    .from(ROSTER_TABLE)
    .delete()
    .eq('roster_id', DEFAULT_ROSTER_ID)
    .eq('id', key)
  if (error) throw new AppError('Không thể cập nhật danh sách lớp.', 500)
  return listClassRoster()
}

export async function connectPlaceholder(rosterId, realUserId) {
  const key = asText(rosterId)
  const userId = asText(realUserId)
  if (!key) throw new AppError('Thiếu mã tên chờ kết nối.', 400)
  if (!userId) throw new AppError('Hãy chọn tài khoản thật để kết nối.', 400)

  const { data: fake, error: fakeError } = await supabaseAdmin
    .from(ROSTER_TABLE)
    .select('id, name')
    .eq('roster_id', DEFAULT_ROSTER_ID)
    .eq('id', key)
    .maybeSingle()
  if (fakeError) throw new AppError('Không thể đọc danh sách lớp.', 500)
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

  const { error: deleteError } = await supabaseAdmin
    .from(ROSTER_TABLE)
    .delete()
    .eq('roster_id', DEFAULT_ROSTER_ID)
    .eq('id', key)
  if (deleteError) throw new AppError('Không thể cập nhật danh sách lớp.', 500)

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
