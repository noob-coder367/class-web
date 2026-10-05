import { supabaseAdmin } from '../config/supabaseClient.js'

const MAX_PAGE_SIZE = 100
const ANNOUNCEMENT_SELECT = `id,title,document_kind,short_id,content,notify_type,section,expires_at,created_at,created_by,created_by_name,source_homework_id,is_exam_reminder,is_system,hidden,hidden_at,hidden_by,hidden_by_name,subject_user_id,subject_user_name,from_level,to_level,announcement_images(id,storage_path,public_url,mime_type,size_bytes,position,created_at)`

function pageArgs(options = {}) {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(options.pageSize, 10) || 50))
  return { page, pageSize, from: (page - 1) * pageSize }
}

export async function list(options = {}) {
  const { page, pageSize, from } = pageArgs(options)
  let query = supabaseAdmin.from('announcements').select(ANNOUNCEMENT_SELECT, { count: 'exact' })
  if (options.hidden !== undefined) query = query.eq('hidden', options.hidden)
  if (options.section) query = query.eq('section', options.section)
  if (options.documentKind) query = query.eq('document_kind', options.documentKind)
  if (options.notifyType) query = query.eq('notify_type', options.notifyType)
  if (options.isExamReminder !== undefined) query = query.eq('is_exam_reminder', options.isExamReminder)
  if (options.sourceHomeworkId) query = query.eq('source_homework_id', options.sourceHomeworkId)
  if (options.activeAt) query = query.or(`expires_at.is.null,expires_at.gt.${options.activeAt}`)
  if (options.before) query = query.lte('created_at', options.before)
  if (options.after) query = query.gte('created_at', options.after)
  const sort = options.sort === 'oldest' ? 'asc' : 'desc'
  query = query.order('created_at', { ascending: sort === 'asc' }).order('id', { ascending: sort === 'asc' })
    .range(from, from + pageSize - 1)
  const result = await query
  return { ...result, page, pageSize, from }
}

export async function findById(id) {
  return supabaseAdmin.from('announcements').select(ANNOUNCEMENT_SELECT).eq('id', id).maybeSingle()
}

export async function listExpired(now, pageSize = 100) {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(pageSize, 10) || 100))
  return supabaseAdmin.from('announcements').select(ANNOUNCEMENT_SELECT)
    .not('expires_at', 'is', null).lte('expires_at', now)
    .order('expires_at', { ascending: true }).range(0, size - 1)
}

export async function listImageQuotaCandidates(offset, limit = 100) {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(limit, 10) || 100))
  return supabaseAdmin.from('announcement_images')
    .select('id,storage_path,public_url,position,announcements!inner(created_at)')
    .order('created_at', { ascending: false, foreignTable: 'announcements' })
    .order('position', { ascending: false })
    .range(offset, offset + size - 1)
}

export async function listByHomework(homeworkId, onlyExam = false) {
  let query = supabaseAdmin.from('announcements').select(ANNOUNCEMENT_SELECT)
    .eq('source_homework_id', homeworkId)
  if (onlyExam) query = query.eq('is_exam_reminder', true)
  return query.order('created_at', { ascending: true }).range(0, MAX_PAGE_SIZE - 1)
}

export async function deleteByIds(ids) {
  if (!ids?.length) return { error: null }
  return supabaseAdmin.from('announcements').delete().in('id', ids)
}

export async function deleteImageIds(ids) {
  if (!ids?.length) return { error: null }
  return supabaseAdmin.from('announcement_images').delete().in('id', ids)
}

export async function allocateShortId(documentKind) {
  return supabaseAdmin.rpc('allocate_announcement_short_id', { p_document_kind: documentKind })
}

export { ANNOUNCEMENT_SELECT, pageArgs }
