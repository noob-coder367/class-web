import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { isAdminRole } from '../lib/roles.js'

const MAX_LEN = 1000
const MAX_ROWS = 500

function fail(error, action) {
  if (!error) return
  console.error(`[feedback] ${action} failed`, error.message)
  throw new AppError(`Không thể ${action} phản hồi.`, 503)
}

export async function listFeedback(profile) {
  const posts = await supabaseAdmin
    .from('class_feedback_posts')
    .select('id,parent_id,user_id,author_name,content,created_at')
    .order('created_at', { ascending: false })
    .range(0, MAX_ROWS - 1)
  fail(posts.error, 'đọc')
  const rows = posts.data || []
  const ids = rows.map((r) => r.id)
  let likes = []
  if (ids.length) {
    const res = await supabaseAdmin.from('class_feedback_likes').select('post_id,user_id').in('post_id', ids).range(0, 19999)
    fail(res.error, 'đọc lượt thích của')
    likes = res.data || []
  }
  const count = new Map()
  const mine = new Set()
  for (const like of likes) {
    count.set(like.post_id, (count.get(like.post_id) || 0) + 1)
    if (like.user_id === profile?.id) mine.add(like.post_id)
  }
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id || null,
    userId: r.user_id,
    authorName: r.author_name || 'Thành viên',
    content: r.content,
    createdAt: r.created_at,
    likes: count.get(r.id) || 0,
    liked: mine.has(r.id),
  }))
}

export async function createFeedback(payload, profile) {
  const content = String(payload?.content ?? '').trim()
  if (!content) throw new AppError('Hãy nhập nội dung phản hồi.', 400)
  if (content.length > MAX_LEN) throw new AppError(`Phản hồi tối đa ${MAX_LEN} ký tự.`, 400)
  let parentId = payload?.parentId ? String(payload.parentId) : null
  if (parentId) {
    const parent = await supabaseAdmin.from('class_feedback_posts').select('id,parent_id').eq('id', parentId).maybeSingle()
    fail(parent.error, 'đọc')
    if (!parent.data) throw new AppError('Không tìm thấy phản hồi để trả lời.', 404)
    // Chỉ 1 cấp trả lời: trả lời vào 1 reply thì gắn về bài gốc.
    parentId = parent.data.parent_id || parent.data.id
  }
  const insert = await supabaseAdmin.from('class_feedback_posts').insert({
    parent_id: parentId,
    user_id: profile.id,
    author_name: String(profile?.username || 'Thành viên').trim().slice(0, 80) || 'Thành viên',
    content,
  }).select('id,parent_id,user_id,author_name,content,created_at').single()
  fail(insert.error, 'gửi')
  const r = insert.data
  return { id: r.id, parentId: r.parent_id || null, userId: r.user_id, authorName: r.author_name, content: r.content, createdAt: r.created_at, likes: 0, liked: false }
}

export async function toggleFeedbackLike(id, profile) {
  const postId = String(id || '')
  const post = await supabaseAdmin.from('class_feedback_posts').select('id').eq('id', postId).maybeSingle()
  fail(post.error, 'đọc')
  if (!post.data) throw new AppError('Không tìm thấy phản hồi.', 404)
  const existing = await supabaseAdmin.from('class_feedback_likes').select('post_id').eq('post_id', postId).eq('user_id', profile.id).maybeSingle()
  fail(existing.error, 'đọc lượt thích của')
  if (existing.data) {
    const del = await supabaseAdmin.from('class_feedback_likes').delete().eq('post_id', postId).eq('user_id', profile.id)
    fail(del.error, 'bỏ thích')
  } else {
    const ins = await supabaseAdmin.from('class_feedback_likes').upsert({ post_id: postId, user_id: profile.id }, { onConflict: 'post_id,user_id' })
    fail(ins.error, 'thích')
  }
  const total = await supabaseAdmin.from('class_feedback_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', postId)
  fail(total.error, 'đếm lượt thích của')
  return { id: postId, liked: !existing.data, likes: total.count || 0 }
}

export async function deleteFeedback(id, profile) {
  const postId = String(id || '')
  const post = await supabaseAdmin.from('class_feedback_posts').select('id,user_id').eq('id', postId).maybeSingle()
  fail(post.error, 'đọc')
  if (!post.data) throw new AppError('Không tìm thấy phản hồi.', 404)
  if (post.data.user_id !== profile.id && !isAdminRole(profile?.role)) {
    throw new AppError('Bạn chỉ xóa được phản hồi của mình.', 403)
  }
  const del = await supabaseAdmin.from('class_feedback_posts').delete().eq('id', postId)
  fail(del.error, 'xóa')
  return { id: postId }
}
