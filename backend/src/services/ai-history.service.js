import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

export const AI_DAILY_LIMIT = 20
const MAX_TITLE_LENGTH = 80
const MAX_CONTENT_LENGTH = 4000
const MAX_PAGE_SIZE = 100
function paginationArgs(page, pageSize) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(pageSize, 10) || 50))
  return { page: safePage, pageSize: safeSize, from: (safePage - 1) * safeSize }
}

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max)
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null
}

function throwDatabaseError(error, fallback) {
  if (error) {
    console.error('[AI history] database error:', error.message || error)
    throw new AppError(fallback, 503)
  }
}

export async function getQuota(userId) {
  const { data, error } = await supabaseAdmin.rpc('ai_get_daily_quota', {
    p_user_id: userId,
    p_usage_date: todayInVietnam(),
    p_limit: AI_DAILY_LIMIT,
  })
  throwDatabaseError(error, 'Không tải được quota AI, vui lòng thử lại sau.')
  const row = firstRow(data) || {}
  const used = Math.min(Math.max(Number(row.used_count) || 0, 0), AI_DAILY_LIMIT)
  return { used, limit: AI_DAILY_LIMIT, remaining: Math.max(AI_DAILY_LIMIT - used, 0) }
}

export async function reserveQuota(userId) {
  const { data, error } = await supabaseAdmin.rpc('ai_reserve_daily_quota', {
    p_user_id: userId,
    p_usage_date: todayInVietnam(),
    p_limit: AI_DAILY_LIMIT,
  })
  throwDatabaseError(error, 'Không kiểm tra được quota AI, vui lòng thử lại sau.')
  const row = firstRow(data) || {}
  const used = Math.min(Math.max(Number(row.used_count) || 0, 0), AI_DAILY_LIMIT)
  const allowed = row.allowed === true && used <= AI_DAILY_LIMIT
  return { allowed, used, limit: AI_DAILY_LIMIT, remaining: Math.max(AI_DAILY_LIMIT - used, 0), usageDate: todayInVietnam() }
}

export async function releaseQuota(userId, usageDate) {
  const { error } = await supabaseAdmin.rpc('ai_release_daily_quota', {
    p_user_id: userId,
    p_usage_date: usageDate,
  })
  if (error) console.error('[AI history] quota release failed:', error.message || error)
}

function normalizeConversation(row, userId) {
  if (!row || String(row.user_id) !== String(userId)) throw new AppError('Không tìm thấy cuộc trò chuyện.', 404)
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** Map row đã được filter theo user_id — không cần check ownership lại. */
function toConversationSummary(row) {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listConversations(userId, options = {}) {
  const page = paginationArgs(options.page, options.pageSize)
  const { data, error, count } = await supabaseAdmin
    .from('ai_conversations')
    .select('id, title, created_at, updated_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(page.from, page.from + page.pageSize - 1)
  throwDatabaseError(error, 'Không tải được lịch sử chat, vui lòng thử lại sau.')
  return {
    conversations: (data || []).map(toConversationSummary),
    pagination: { page: page.page, pageSize: page.pageSize, total: count || 0, hasMore: page.from + (data || []).length < (count || 0) },
  }
}

export async function createConversation(userId, title = 'Cuộc trò chuyện mới') {
  const safeTitle = cleanText(title, MAX_TITLE_LENGTH) || 'Cuộc trò chuyện mới'
  const { data, error } = await supabaseAdmin
    .from('ai_conversations')
    .insert({ user_id: userId, title: safeTitle })
    .select('id, user_id, title, created_at, updated_at')
    .single()
  throwDatabaseError(error, 'Không tạo được cuộc trò chuyện, vui lòng thử lại sau.')
  if (!data?.id) {
    console.error('[AI history] insert conversation returned no row')
    throw new AppError('Không tạo được cuộc trò chuyện, vui lòng thử lại sau.', 503)
  }
  // Vừa insert bằng đúng userId nên không cần check ownership (tránh 404 giả).
  return toConversationSummary(data)
}

async function getOwnedConversation(userId, conversationId) {
  const id = cleanText(conversationId, 100)
  if (!id) return null
  const { data, error } = await supabaseAdmin
    .from('ai_conversations')
    .select('id, user_id, title, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  throwDatabaseError(error, 'Không tải được cuộc trò chuyện, vui lòng thử lại sau.')
  if (!data) throw new AppError('Không tìm thấy cuộc trò chuyện.', 404)
  return normalizeConversation(data, userId)
}

export async function getConversation(userId, conversationId, options = {}) {
  const conversation = await getOwnedConversation(userId, conversationId)
  const page = paginationArgs(options.page, options.pageSize)
  // Page 1 is always the newest slice for context and UI; reverse it for chronological display.
  const { data, error, count } = await supabaseAdmin
    .from('ai_messages')
    .select('id, role, content, created_at', { count: 'exact' })
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(page.from, page.from + page.pageSize - 1)
  throwDatabaseError(error, 'Không tải được tin nhắn, vui lòng thử lại sau.')
  const messages = (data || []).reverse()
  return { conversation, messages, pagination: {
    page: page.page, pageSize: page.pageSize, total: count || 0,
    hasMore: page.from + (data || []).length < (count || 0),
  } }
}

export async function deleteConversation(userId, conversationId) {
  await getOwnedConversation(userId, conversationId)
  const { error } = await supabaseAdmin
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId)
  throwDatabaseError(error, 'Không xóa được cuộc trò chuyện, vui lòng thử lại sau.')
  return { deleted: true }
}

export async function appendTurn({ userId, conversationId, question, reply }) {
  const safeQuestion = cleanText(question, MAX_CONTENT_LENGTH)
  const safeReply = cleanText(reply, MAX_CONTENT_LENGTH)
  let conversation = null

  if (conversationId) {
    try {
      conversation = await getOwnedConversation(userId, conversationId)
    } catch (err) {
      if (!(err instanceof AppError && err.statusCode === 404)) throw err
      conversation = null
    }
  }

  if (!conversation) {
    conversation = await createConversation(userId, safeQuestion.slice(0, MAX_TITLE_LENGTH))
  } else {
    const { error: updateError } = await supabaseAdmin
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .eq('user_id', userId)
    throwDatabaseError(updateError, 'Không cập nhật được cuộc trò chuyện.')
  }

  const { error } = await supabaseAdmin.from('ai_messages').insert([
    { conversation_id: conversation.id, role: 'user', content: safeQuestion },
    { conversation_id: conversation.id, role: 'assistant', content: safeReply },
  ])
  throwDatabaseError(error, 'Không lưu được lịch sử chat.')
  return conversation
}

export async function storedConversationMessages(userId, conversationId) {
  if (!conversationId) return []
  const result = await getConversation(userId, conversationId)
  return result.messages.map(({ role, content }) => ({ role, content }))
}
