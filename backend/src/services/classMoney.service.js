import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import * as classSpaceService from './classSpace.service.js'
import {
  buildMoneyMembersFromUtilityRoster,
  parseStudentNumber,
  sortByStudentNumber,
} from '../lib/classMoneyRoster.js'

const MAX_MONEY = 9_000_000_000_000
const PAGE_LIMIT = 50
const MONEY_PHOTO_BUCKET = 'class-money-photos'
const MAX_MONEY_PHOTO_BYTES = 8 * 1024 * 1024
const MONEY_PHOTO_MIME = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const COLLECTION_MEMBER_SELECT = 'id, collection_id, profile_id, student_number, display_name_snapshot, amount_due, amount_paid, amount_owed, amount_change, status, note, photo_url, paid_at, paid_by, created_at, updated_at'

function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max)
}

function positiveInteger(value, field, { allowZero = true } = {}) {
  if (value === '' || value === null || value === undefined) throw new AppError(`${field} là bắt buộc.`)
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[.,\s]/g, ''))
  if (!Number.isSafeInteger(parsed) || parsed < 0 || (!allowZero && parsed === 0) || parsed > MAX_MONEY) {
    throw new AppError(`${field} phải là số nguyên VND hợp lệ, không âm.`)
  }
  return parsed
}

function optionalDate(value) {
  if (value === null || value === undefined || value === '') return null
  const raw = text(value, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AppError('Ngày không hợp lệ.')
  return raw
}

function pageParams(query = {}) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1))
  const limit = Math.max(1, Math.min(PAGE_LIMIT, Number.parseInt(query.limit, 10) || PAGE_LIMIT))
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 }
}

function dbError(error, message) {
  if (error) {
    console.error('[class-money]', error.message || error)
    throw new AppError(message, 503)
  }
}

async function ensureMoneyPhotoBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(MONEY_PHOTO_BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(MONEY_PHOTO_BUCKET, { public: true, fileSizeLimit: MAX_MONEY_PHOTO_BYTES })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) throw new AppError('Không tạo được kho ảnh thu tiền: ' + error.message, 502)
  } else if (data.public === false) {
    await supabaseAdmin.storage.updateBucket(MONEY_PHOTO_BUCKET, { public: true })
  }
}

function moneyPhotoUrl(path) {
  const { data } = supabaseAdmin.storage.from(MONEY_PHOTO_BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

function moneyPhotoStoragePath(url) {
  if (!url || typeof url !== 'string') return null
  const marker = `/${MONEY_PHOTO_BUCKET}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length).split('?')[0])
}

function stripDataUrl(contentBase64) {
  const raw = String(contentBase64 || '').trim()
  const match = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  return match ? match[1] : raw.replace(/\s+/g, '')
}

function rowOr404(row, message = 'Không tìm thấy dữ liệu tiền lớp.') {
  if (!row) throw new AppError(message, 404)
  return row
}

function calculatePayment(amountDue, amountPaid) {
  const due = positiveInteger(amountDue, 'Số tiền cần thu')
  const paid = positiveInteger(amountPaid, 'Số tiền đã thu')
  const difference = paid - due
  if (paid === 0) return { amount_due: due, amount_paid: 0, amount_owed: due, amount_change: 0, status: 'unpaid' }
  if (difference < 0) return { amount_due: due, amount_paid: paid, amount_owed: Math.abs(difference), amount_change: 0, status: 'debt' }
  if (difference === 0) return { amount_due: due, amount_paid: paid, amount_owed: 0, amount_change: 0, status: 'paid' }
  return { amount_due: due, amount_paid: paid, amount_owed: 0, amount_change: difference, status: 'change' }
}

function sum(rows, key) {
  return (rows || []).reduce((total, row) => total + (Number(row?.[key]) || 0), 0)
}

async function audit({ bookId, actorId, action, entityType, entityId = null, oldData = null, newData = null }) {
  const { error } = await supabaseAdmin.from('class_money_audit_logs').insert({
    book_id: bookId,
    actor_id: actorId,
    action: text(action, 80),
    entity_type: text(entityType, 80),
    entity_id: entityId,
    old_data: oldData,
    new_data: newData,
  })
  if (error) console.error('[class-money] audit failed:', error.message || error)
}

async function insertTransaction({ bookId, actorId, type, amount, profileId = null, collectionId = null, expenseId = null, description }) {
  const { error } = await supabaseAdmin.from('class_money_transactions').insert({
    book_id: bookId,
    type,
    amount: positiveInteger(amount, 'Số tiền giao dịch'),
    profile_id: profileId,
    collection_id: collectionId,
    expense_id: expenseId,
    description: text(description, 240),
    created_by: actorId,
  })
  if (error) throw new AppError('Không ghi được lịch sử giao dịch.', 503)
}

async function getBook(bookId) {
  let query = supabaseAdmin
    .from('class_money_books')
    .select('id, name, description, currency, created_by, status, created_at, updated_at')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
  if (bookId) query = supabaseAdmin
    .from('class_money_books')
    .select('id, name, description, currency, created_by, status, created_at, updated_at')
    .eq('id', text(bookId, 100))
    .maybeSingle()
  else query = query.maybeSingle()
  const { data, error } = await query
  dbError(error, 'Không tải được sổ tiền lớp.')
  return data || null
}

async function requireBook(bookId) {
  return rowOr404(await getBook(bookId), 'Chưa có sổ tiền lớp. Hãy tạo sổ trước.')
}

export async function listBooks() {
  const { data, error } = await supabaseAdmin
    .from('class_money_books')
    .select('id, name, description, currency, created_by, status, created_at, updated_at')
    .order('created_at', { ascending: false })
  dbError(error, 'Không tải được sổ tiền lớp.')
  return data || []
}

export async function createBook(payload, actorId) {
  const name = text(payload?.name, 120)
  if (!name) throw new AppError('Tên sổ tiền là bắt buộc.')
  const { data, error } = await supabaseAdmin
    .from('class_money_books')
    .insert({ name, description: text(payload?.description, 500), created_by: actorId })
    .select('id, name, description, currency, created_by, status, created_at, updated_at')
    .single()
  dbError(error, 'Không tạo được sổ tiền lớp.')
  await audit({ bookId: data.id, actorId, action: 'create', entityType: 'book', entityId: data.id, newData: data })
  return data
}

export async function getMembers() {
  // Nguồn: JSON đã parse của module Tiện ích (classroom-data/utility-roster.json)
  // qua GET /classroom/utility-roster — không đọc PDF lại, không lấy từ profiles.
  const roster = await classSpaceService.getUtilityRoster()
  const names = Array.isArray(roster?.names) ? roster.names : []
  if (!names.length) {
    throw new AppError('Chưa có danh sách lớp từ Tiện ích. Hãy tải PDF danh sách lớp trong mục Tiện ích trước.', 400)
  }

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, role, is_member')
  dbError(error, 'Không đối chiếu được tài khoản với danh sách lớp.')

  const members = buildMoneyMembersFromUtilityRoster(names, profiles || [])
  if (!members.length) {
    throw new AppError('Danh sách PDF từ Tiện ích không có học sinh hợp lệ.', 400)
  }

  return {
    members,
    source: {
      fileName: String(roster.fileName || ''),
      updatedAt: String(roster.updatedAt || ''),
      count: members.length,
    },
  }
}

async function listCollectionMembers(collectionId) {
  const { data, error } = await supabaseAdmin
    .from('class_money_collection_members')
    .select(COLLECTION_MEMBER_SELECT)
    .eq('collection_id', collectionId)
    .order('student_number', { ascending: true, nullsFirst: false })
  dbError(error, 'Không tải được danh sách thu tiền.')
  return sortByStudentNumber(data || [])
}

export async function listCollections(bookId) {
  const book = await requireBook(bookId)
  const { data, error } = await supabaseAdmin
    .from('class_money_collections')
    .select('id, book_id, name, amount_per_person, due_date, note, created_by, status, created_at, updated_at')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false })
  dbError(error, 'Không tải được các đợt thu.')
  return data || []
}

export async function getCollection(id) {
  const { data, error } = await supabaseAdmin
    .from('class_money_collections')
    .select('id, book_id, name, amount_per_person, due_date, note, created_by, status, created_at, updated_at')
    .eq('id', text(id, 100))
    .maybeSingle()
  dbError(error, 'Không tải được đợt thu.')
  const collection = rowOr404(data, 'Không tìm thấy đợt thu.')
  return { collection, members: await listCollectionMembers(collection.id) }
}

export async function createCollection(payload, actorId) {
  const book = await requireBook(payload?.bookId)
  const name = text(payload?.name, 120)
  if (!name) throw new AppError('Tên đợt thu là bắt buộc.')
  const amount = positiveInteger(payload?.amountPerPerson, 'Số tiền cần thu mỗi người')
  const requestedNumbers = [...new Set(
    (Array.isArray(payload?.studentNumbers) ? payload.studentNumbers : [])
      .map((value) => parseStudentNumber(value))
      .filter((value) => value != null)
  )]
  if (!requestedNumbers.length) throw new AppError('Hãy chọn ít nhất một học sinh.')

  const { members: rosterMembers } = await getMembers()
  const rosterByStt = new Map(rosterMembers.map((row) => [row.student_number, row]))
  const selected = requestedNumbers.map((stt) => rosterByStt.get(stt)).filter(Boolean)
  if (selected.length !== requestedNumbers.length) {
    throw new AppError('Danh sách học sinh không khớp danh sách lớp từ Tiện ích.')
  }

  const withAccounts = selected.filter((row) => row.profile_id)
  if (withAccounts.length) {
    const { error: bookMemberError } = await supabaseAdmin.from('class_money_members').upsert(
      withAccounts.map((row) => ({
        book_id: book.id,
        profile_id: row.profile_id,
        display_name_snapshot: text(row.name, 120),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'book_id,profile_id' }
    )
    dbError(bookMemberError, 'Không lưu được danh sách thành viên trong sổ tiền.')
  }

  const { data: collection, error } = await supabaseAdmin
    .from('class_money_collections')
    .insert({
      book_id: book.id,
      name,
      amount_per_person: amount,
      due_date: optionalDate(payload?.dueDate),
      note: text(payload?.note, 500),
      created_by: actorId,
    })
    .select('id, book_id, name, amount_per_person, due_date, note, created_by, status, created_at, updated_at')
    .single()
  dbError(error, 'Không tạo được đợt thu.')

  const rows = selected.map((row) => ({
    collection_id: collection.id,
    profile_id: row.profile_id || null,
    student_number: row.student_number,
    display_name_snapshot: text(row.name, 120),
    amount_due: amount,
    amount_paid: 0,
    amount_owed: amount,
    amount_change: 0,
    status: 'unpaid',
    photo_url: '',
  }))
  const { error: memberError } = await supabaseAdmin.from('class_money_collection_members').insert(rows)
  if (memberError) {
    await supabaseAdmin.from('class_money_collections').delete().eq('id', collection.id)
    throw new AppError('Không tạo được danh sách thành viên của đợt thu.', 503)
  }
  await audit({ bookId: book.id, actorId, action: 'create', entityType: 'collection', entityId: collection.id, newData: { ...collection, member_count: rows.length } })
  return { collection, members: sortByStudentNumber(rows) }
}

export async function updateCollectionMember(id, payload, actorId) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('class_money_collection_members')
    .select(COLLECTION_MEMBER_SELECT)
    .eq('id', text(id, 100))
    .maybeSingle()
  dbError(currentError, 'Không tải được dòng thu tiền.')
  const old = rowOr404(current, 'Không tìm thấy dòng thu tiền.')
  const { data: collection, error: collectionError } = await supabaseAdmin
    .from('class_money_collections')
    .select('id, book_id, name')
    .eq('id', old.collection_id)
    .maybeSingle()
  dbError(collectionError, 'Không tải được đợt thu.')
  rowOr404(collection, 'Không tìm thấy đợt thu.')
  const next = calculatePayment(old.amount_due, payload?.amountPaid ?? old.amount_paid)
  const note = payload?.note === undefined ? old.note : text(payload.note, 500)
  const paidAt = next.amount_paid > 0 ? (old.paid_at || new Date().toISOString()) : null
  const { data: updated, error } = await supabaseAdmin
    .from('class_money_collection_members')
    .update({ ...next, note, paid_at: paidAt, paid_by: next.amount_paid > 0 ? actorId : null, updated_at: new Date().toISOString() })
    .eq('id', old.id)
    .eq('updated_at', old.updated_at)
    .select(COLLECTION_MEMBER_SELECT)
    .maybeSingle()
  dbError(error, 'Không cập nhật được dòng thu tiền.')
  if (!updated) throw new AppError('Dữ liệu vừa được người khác cập nhật. Hãy tải lại rồi thử lại.', 409)
  const delta = Number(updated.amount_paid) - Number(old.amount_paid)
  if (delta > 0) await insertTransaction({ bookId: collection.book_id, actorId, type: 'income', amount: delta, profileId: old.profile_id, collectionId: old.collection_id, description: `Thu tiền ${old.display_name_snapshot} · ${collection.name}` })
  if (delta < 0) await insertTransaction({ bookId: collection.book_id, actorId, type: 'refund', amount: Math.abs(delta), profileId: old.profile_id, collectionId: old.collection_id, description: `Điều chỉnh tiền ${old.display_name_snapshot} · ${collection.name}` })
  await audit({ bookId: collection.book_id, actorId, action: 'update', entityType: 'collection_member', entityId: old.id, oldData: old, newData: updated })
  return updated
}

export async function uploadCollectionMemberPhoto(id, payload, actorId) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('class_money_collection_members')
    .select(COLLECTION_MEMBER_SELECT)
    .eq('id', text(id, 100))
    .maybeSingle()
  dbError(currentError, 'Không tải được dòng thu tiền.')
  const old = rowOr404(current, 'Không tìm thấy dòng thu tiền.')
  const mime = String(payload?.mimeType || '').toLowerCase()
  const extension = MONEY_PHOTO_MIME[mime]
  if (!extension) throw new AppError('Chỉ nhận ảnh JPG, PNG hoặc WEBP.')
  const pure = stripDataUrl(payload?.contentBase64)
  if (!pure) throw new AppError('Thiếu dữ liệu ảnh.')
  let bytes
  try {
    // Giải mã base64 thành bytes trước khi lưu vào Storage, không lưu chuỗi ảnh thô vào database.
    bytes = Buffer.from(pure, 'base64')
  } catch {
    throw new AppError('Ảnh không hợp lệ.')
  }
  if (!bytes.length) throw new AppError('Ảnh trống.')
  if (bytes.length > MAX_MONEY_PHOTO_BYTES) throw new AppError('Ảnh tối đa 8MB.')

  const { data: collection, error: collectionError } = await supabaseAdmin
    .from('class_money_collections')
    .select('id, book_id')
    .eq('id', old.collection_id)
    .maybeSingle()
  dbError(collectionError, 'Không tải được đợt thu.')
  rowOr404(collection, 'Không tìm thấy đợt thu.')

  await ensureMoneyPhotoBucket()
  const path = `collection-members/${old.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
  const { error: uploadError } = await supabaseAdmin.storage.from(MONEY_PHOTO_BUCKET).upload(path, bytes, { contentType: mime, upsert: false })
  if (uploadError) throw new AppError('Không tải được ảnh lên: ' + uploadError.message, 502)

  const photoUrl = moneyPhotoUrl(path)
  const { data: updated, error } = await supabaseAdmin
    .from('class_money_collection_members')
    .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
    .eq('id', old.id)
    .eq('updated_at', old.updated_at)
    .select(COLLECTION_MEMBER_SELECT)
    .maybeSingle()
  dbError(error, 'Không lưu được ảnh thu tiền.')
  if (!updated) {
    await supabaseAdmin.storage.from(MONEY_PHOTO_BUCKET).remove([path])
    throw new AppError('Dữ liệu vừa được người khác cập nhật. Hãy tải lại rồi thử lại.', 409)
  }
  const oldPath = moneyPhotoStoragePath(old.photo_url)
  if (oldPath) await supabaseAdmin.storage.from(MONEY_PHOTO_BUCKET).remove([oldPath])
  await audit({ bookId: collection.book_id, actorId, action: 'update', entityType: 'collection_member_photo', entityId: old.id, oldData: { photo_url: old.photo_url || '' }, newData: { photo_url: photoUrl } })
  return updated
}

export async function listExpenses(bookId, query) {
  const book = await requireBook(bookId)
  const { page, limit, from, to } = pageParams(query)
  const { data, error, count } = await supabaseAdmin
    .from('class_money_expenses')
    .select('id, book_id, title, amount, category, spent_at, spent_by, note, created_by, created_at, updated_at', { count: 'exact' })
    .eq('book_id', book.id)
    .is('deleted_at', null)
    .order('spent_at', { ascending: false })
    .range(from, to)
  dbError(error, 'Không tải được các khoản chi.')
  return { items: data || [], page, limit, total: count || 0 }
}

export async function createExpense(payload, actorId) {
  const book = await requireBook(payload?.bookId)
  const title = text(payload?.title, 160)
  if (!title) throw new AppError('Tên khoản chi là bắt buộc.')
  const amount = positiveInteger(payload?.amount, 'Số tiền khoản chi', { allowZero: false })
  const spentAt = optionalDate(payload?.spentAt) || new Date().toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('class_money_expenses')
    .insert({ book_id: book.id, title, amount, category: text(payload?.category, 100), spent_at: spentAt, spent_by: text(payload?.spentBy, 100) || null, note: text(payload?.note, 500), created_by: actorId })
    .select('id, book_id, title, amount, category, spent_at, spent_by, note, created_by, created_at, updated_at')
    .single()
  dbError(error, 'Không thêm được khoản chi.')
  await insertTransaction({ bookId: book.id, actorId, type: 'expense', amount, expenseId: data.id, description: `Chi: ${title}` })
  await audit({ bookId: book.id, actorId, action: 'create', entityType: 'expense', entityId: data.id, newData: data })
  return data
}

export async function updateExpense(id, payload, actorId) {
  const { data: old, error: oldError } = await supabaseAdmin.from('class_money_expenses').select('id, book_id, title, amount, category, spent_at, spent_by, note, created_by, created_at, updated_at').eq('id', text(id, 100)).is('deleted_at', null).maybeSingle()
  dbError(oldError, 'Không tải được khoản chi.')
  rowOr404(old, 'Không tìm thấy khoản chi.')
  const next = {
    title: payload?.title === undefined ? old.title : text(payload.title, 160),
    amount: payload?.amount === undefined ? old.amount : positiveInteger(payload.amount, 'Số tiền khoản chi', { allowZero: false }),
    category: payload?.category === undefined ? old.category : text(payload.category, 100),
    spent_at: payload?.spentAt === undefined ? old.spent_at : optionalDate(payload.spentAt),
    spent_by: payload?.spentBy === undefined ? old.spent_by : text(payload.spentBy, 100) || null,
    note: payload?.note === undefined ? old.note : text(payload.note, 500),
    updated_at: new Date().toISOString(),
  }
  if (!next.title) throw new AppError('Tên khoản chi là bắt buộc.')
  const { data, error } = await supabaseAdmin.from('class_money_expenses').update(next).eq('id', old.id).eq('updated_at', old.updated_at).select('id, book_id, title, amount, category, spent_at, spent_by, note, created_by, created_at, updated_at').maybeSingle()
  dbError(error, 'Không cập nhật được khoản chi.')
  if (!data) throw new AppError('Khoản chi vừa được người khác cập nhật. Hãy tải lại rồi thử lại.', 409)
  const delta = Number(data.amount) - Number(old.amount)
  if (delta > 0) await insertTransaction({ bookId: old.book_id, actorId, type: 'expense', amount: delta, expenseId: old.id, description: `Điều chỉnh tăng chi: ${data.title}` })
  if (delta < 0) await insertTransaction({ bookId: old.book_id, actorId, type: 'refund', amount: Math.abs(delta), expenseId: old.id, description: `Điều chỉnh giảm chi: ${data.title}` })
  await audit({ bookId: old.book_id, actorId, action: 'update', entityType: 'expense', entityId: old.id, oldData: old, newData: data })
  return data
}

export async function deleteExpense(id, actorId) {
  const { data: old, error } = await supabaseAdmin.from('class_money_expenses').select('id, book_id, title, amount, deleted_at').eq('id', text(id, 100)).is('deleted_at', null).maybeSingle()
  dbError(error, 'Không tải được khoản chi.')
  rowOr404(old, 'Không tìm thấy khoản chi.')
  const { error: updateError } = await supabaseAdmin.from('class_money_expenses').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', old.id)
  dbError(updateError, 'Không xóa được khoản chi.')
  await insertTransaction({ bookId: old.book_id, actorId, type: 'refund', amount: old.amount, expenseId: old.id, description: `Hoàn điều chỉnh khoản chi đã xóa: ${old.title}` })
  await audit({ bookId: old.book_id, actorId, action: 'archive', entityType: 'expense', entityId: old.id, oldData: old, newData: { deleted_at: true } })
  return { deleted: true }
}

export async function listTransactions(bookId, query) {
  const book = await requireBook(bookId)
  const { page, limit, from, to } = pageParams(query)
  const { data, error, count } = await supabaseAdmin.from('class_money_transactions').select('id, book_id, type, amount, profile_id, collection_id, expense_id, description, created_by, created_at', { count: 'exact' }).eq('book_id', book.id).order('created_at', { ascending: false }).range(from, to)
  dbError(error, 'Không tải được lịch sử giao dịch.')
  return { items: data || [], page, limit, total: count || 0 }
}

export async function listAuditLogs(bookId, query) {
  const book = await requireBook(bookId)
  const { page, limit, from, to } = pageParams(query)
  const { data, error, count } = await supabaseAdmin.from('class_money_audit_logs').select('id, book_id, actor_id, action, entity_type, entity_id, old_data, new_data, created_at', { count: 'exact' }).eq('book_id', book.id).order('created_at', { ascending: false }).range(from, to)
  dbError(error, 'Không tải được lịch sử chỉnh sửa.')
  return { items: data || [], page, limit, total: count || 0 }
}

export async function getOverview(bookId) {
  const book = await getBook(bookId)
  if (!book) return { book: null, summary: { totalCollected: 0, totalOwed: 0, totalChange: 0, totalExpense: 0, balance: 0 }, activeCollection: null, recentTransactions: [], recentExpenses: [] }
  const [{ data: expenses, error: expenseError }, { data: transactions, error: txError }, { data: activeCollection, error: collectionError }] = await Promise.all([
    supabaseAdmin.from('class_money_expenses').select('id, title, amount, category, spent_at, note, created_at').eq('book_id', book.id).is('deleted_at', null).order('spent_at', { ascending: false }).limit(5),
    supabaseAdmin.from('class_money_transactions').select('id, type, amount, description, created_at').eq('book_id', book.id).order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('class_money_collections').select('id, book_id, name, amount_per_person, due_date, note, status, created_at, updated_at').eq('book_id', book.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  dbError(collectionError, 'Không tải được đợt thu đang hoạt động.')
  dbError(expenseError, 'Không tải được các khoản chi gần đây.')
  dbError(txError, 'Không tải được giao dịch gần đây.')
  const { data: collections, error: collectionsError } = await supabaseAdmin.from('class_money_collections').select('id').eq('book_id', book.id)
  dbError(collectionsError, 'Không tải được tổng quan tiền lớp.')
  const collectionIds = (collections || []).map((row) => row.id)
  let allMembers = []
  if (collectionIds.length) {
    const result = await supabaseAdmin.from('class_money_collection_members').select('amount_paid, amount_owed, amount_change').in('collection_id', collectionIds)
    dbError(result.error, 'Không tải được tổng thu tiền lớp.')
    allMembers = result.data || []
  }
  const resultExpenses = await supabaseAdmin.from('class_money_expenses').select('amount').eq('book_id', book.id).is('deleted_at', null)
  dbError(resultExpenses.error, 'Không tải được tổng chi tiền lớp.')
  const totalCollected = sum(allMembers, 'amount_paid')
  const totalOwed = sum(allMembers, 'amount_owed')
  const totalChange = sum(allMembers, 'amount_change')
  const totalExpense = sum(resultExpenses.data || [], 'amount')
  return {
    book,
    summary: { totalCollected, totalOwed, totalChange, totalExpense, balance: totalCollected - totalExpense },
    activeCollection: activeCollection ? { ...activeCollection, members: await listCollectionMembers(activeCollection.id) } : null,
    recentTransactions: transactions || [],
    recentExpenses: expenses || [],
  }
}

export { calculatePayment }
