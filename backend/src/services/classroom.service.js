import { AppError } from './auth.service.js'
import { getTimetable } from './timetable.service.js'

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

export async function getTabContent(tab) {
  const key = assertValidTab(tab)
  if (key === 'timetable') {
    const timetable = await getTimetable()
    return { tab: key, timetable }
  }
  return { tab: key, items: [] }
}
