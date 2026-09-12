import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError, isPendingUsername } from './auth.service.js'
import * as timetableService from './timetable.service.js'

/**
 * Nội dung khu vực lớp KHÔNG được hardcode ở frontend.
 * Mọi tab đều đi qua API này, sau requireAuth + requireMember.
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

function formatDateFromISO(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/**
 * Thông báo thay đổi TKB (nếu còn active) được gắn vào tab Thông báo chung.
 */
export async function getTabContent(tab) {
  const key = assertValidTab(tab)
  const items = []

  if (key === 'announcements') {
    try {
      const tkb = await timetableService.getTimetable()
      const notice = tkb?.changeNotice
      if (notice?.active) {
        const from = formatDateFromISO(notice.from)
        const to = formatDateFromISO(notice.to)
        const title =
          from && to
            ? `Thông báo thay đổi TKB từ ngày ${from} đến ngày ${to}`
            : 'Thông báo thay đổi thời khoá biểu'

        let body = notice.summary || 'Chưa có sự thay đổi'
        if (notice.hasChanges && Array.isArray(notice.lines) && notice.lines.length) {
          body =
            notice.summary +
            '\n\n' +
            notice.lines.slice(0, 12).join('\n') +
            (notice.lines.length > 12 ? `\n… và ${notice.lines.length - 12} thay đổi khác` : '')
        }

        items.push({
          id: 'tkb-change-notice',
          type: 'tkb-change',
          title,
          body,
          hasChanges: !!notice.hasChanges,
          from: notice.from,
          to: notice.to,
          detailAction: 'timetable',
        })
      }
    } catch (err) {
      console.warn('[classroom] không lấy được notice TKB cho announcements:', err.message)
    }
  }

  return { tab: key, items }
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
