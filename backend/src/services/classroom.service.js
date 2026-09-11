import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError, isPendingUsername } from './auth.service.js'

/**
 * Nội dung khu vực lớp KHÔNG được hardcode ở frontend.
 * Mọi tab đều đi qua API này, sau requireAuth + requireMember.
 * Hiện tại chưa có dữ liệu — trả mảng rỗng để UI hiện "Chưa có nội dung".
 * Khi bổ sung, đọc từ bảng class_contents (Supabase) trong hàm getTabContent.
 */
export const CLASSROOM_TABS = [
  'announcements',
  'timetable',
  'homework',
  'rules',
]

export function assertValidTab(tab) {
  if (!CLASSROOM_TABS.includes(tab)) {
    throw new AppError('Mục không hợp lệ.', 400)
  }
  return tab
}

export function listTabs() {
  return CLASSROOM_TABS.map((id) => ({ id }))
}

export async function getTabContent(tab) {
  const key = assertValidTab(tab)
  return { tab: key, items: [] }
}

/**
 * Thành viên 10A4 đang được duyệt (is_member = true), kể cả admin nếu
 * admin cũng là A4. Acc bị hạ khỏi A4 sẽ biến mất khỏi danh sách này.
 * Truyền membersOnly=false để lấy mọi tài khoản đã đặt tên hiển thị
 * (dùng cho dropdown ghi vi phạm của admin).
 */
export async function listClassMembers({ membersOnly = true } = {}) {
  let query = supabaseAdmin
    .from('profiles')
    .select('id, username, role, is_member')
    .order('username', { ascending: true })

  if (membersOnly) query = query.eq('is_member', true)

  const { data, error } = await query
  if (error) throw new AppError('Không thể tải danh sách thành viên lớp.', 500)

  return (data || [])
    .filter((row) => row?.username && !isPendingUsername(row.username))
    .map((row) => ({
      id: row.id,
      username: String(row.username).trim(),
      role: row.role === 'admin' ? 'admin' : 'user',
      is_member: row.is_member === true,
    }))
    .sort((a, b) => a.username.localeCompare(b.username, 'vi'))
}
