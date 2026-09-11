import { AppError } from './auth.service.js'

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
