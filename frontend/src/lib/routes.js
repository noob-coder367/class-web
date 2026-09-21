/**
 * Trung tâm định nghĩa các URL path của app + hàm đọc/tạo path.
 * File này CHỈ chứa hằng số và hàm thuần (không state, không gọi API),
 * dùng chung giữa App.jsx, HomePage.jsx, ClassRoomView.jsx và các board con
 * để toàn bộ chỗ điều hướng đồng bộ với nhau, tránh lặp chuỗi path rải rác.
 */

export const ROUTES = {
  home: '/',
  login: '/dang-nhap',
  register: '/dang-ky',
  profileSetting: '/profile-setting',
  classRoot: '/vo-lop',
}

// Tab nội bộ (ClassRoomView) <-> tên segment trên URL.
export const CLASS_TAB_PATH = {
  announcements: 'thong-bao-chung',
  timetable: 'thoi-khoa-bieu',
  homework: 'bai-tap-ve-nha',
  rules: 'noi-quy-lop',
  'cleaning-duty': 've-sinh-chung',
  'class-space': 'lop-hoc',
  ai: 'AI',
}

const PATH_TAB = Object.fromEntries(
  Object.entries(CLASS_TAB_PATH).map(([tab, path]) => [path.toLowerCase(), tab])
)
// Alias chia sẻ / xem chi tiết: /vo-lop/thong-bao?id=<id>
PATH_TAB['thong-bao'] = 'announcements'
// Alias chia sẻ nội quy: /vo-lop/noi-quy và /vo-lop/noi-quy/vi-pham và /vo-lop/noi-quy/bang-xep-hang
PATH_TAB['noi-quy'] = 'rules'
// Alias chia sẻ vệ sinh lớp: /vo-lop/ve-sinh
PATH_TAB['ve-sinh'] = 'cleaning-duty'

/** Tạo URL đầy đủ cho 1 tab trong /vo-lop, kèm các đoạn phụ phía sau (nếu có). */
export function classTabPath(tab, ...rest) {
  const seg = CLASS_TAB_PATH[tab] || CLASS_TAB_PATH.announcements
  const tail = rest.filter((p) => p !== undefined && p !== null && p !== '').join('/')
  return `${ROUTES.classRoot}/${seg}${tail ? `/${tail}` : ''}`
}

/** Từ pathname hiện tại -> { tab, rest[] }. tab=null nếu không thuộc /vo-lop. */
export function parseClassPath(pathname) {
  const clean = String(pathname || '').replace(/^\/+|\/+$/g, '')
  const parts = clean.split('/').filter(Boolean) // vd: ['vo-lop', 'thong-bao-chung', '1']
  if (parts[0] !== 'vo-lop') return { tab: null, rest: [] }
  const seg = (parts[1] || '').toLowerCase()
  const tab = PATH_TAB[seg] || null
  return { tab, rest: parts.slice(2) }
}

// ---- Thông báo chung: /vo-lop/thong-bao?id=<id> (giữ /vo-lop/thong-bao-chung/:id) ----
export function announcementDetailPath(id) {
  const encoded = encodeURIComponent(String(id || '').trim())
  return `${ROUTES.classRoot}/thong-bao?id=${encoded}`
}

/** Đọc id bài thông báo từ ?id= hoặc đoạn path cũ /thong-bao-chung/:id */
export function parseAnnouncementId(pathname, search) {
  const fromQuery = new URLSearchParams(search || '').get('id')
  if (fromQuery) return String(fromQuery).trim() || null
  const { rest } = parseClassPath(pathname)
  return rest[0] ? String(rest[0]).trim() : null
}

// ---- Bài tập về nhà: /vo-lop/bai-tap-ve-nha/bao-bai-:x ----
export function homeworkDetailPath(x) {
  return classTabPath('homework', `bao-bai-${x}`)
}
export function parseHomeworkSegment(rest) {
  const seg = rest?.[0] || ''
  const m = /^bao-bai-(.+)$/i.exec(seg)
  return m ? m[1] : null
}

// ---- Nội quy lớp: /vo-lop/noi-quy-lop/{noi-quy|danh-sach-vi-pham|bang-xep-hang} ----
export const RULES_PANE_PATH = {
  rules: 'noi-quy',
  violations: 'danh-sach-vi-pham',
  rank: 'bang-xep-hang',
}
const PATH_RULES_PANE = Object.fromEntries(
  Object.entries(RULES_PANE_PATH).map(([pane, seg]) => [seg, pane])
)
// Alias chia sẻ danh sách vi phạm: /vo-lop/noi-quy/vi-pham
PATH_RULES_PANE['vi-pham'] = 'violations'

export const RULES_SHARE_PATH = `${ROUTES.classRoot}/noi-quy`
export const RULES_VIOLATIONS_SHARE_PATH = `${ROUTES.classRoot}/noi-quy/vi-pham`
export const RULES_RANK_SHARE_PATH = `${ROUTES.classRoot}/noi-quy/bang-xep-hang`

export function rulesPanePath(pane) {
  return classTabPath('rules', RULES_PANE_PATH[pane] || RULES_PANE_PATH.rules)
}
export function parseRulesPane(rest) {
  return PATH_RULES_PANE[(rest?.[0] || '').toLowerCase()] || null
}

// ---- Lớp học (phòng quiz): /vo-lop/lop-hoc/... ----
export function classSpaceListPath() {
  return classTabPath('class-space')
}
export function classSpaceCreatePath() {
  return classTabPath('class-space', 'tao-phong')
}
export function classSpaceRoomPath(code) {
  return classTabPath('class-space', code)
}
export function classSpaceEditPath(code) {
  return classTabPath('class-space', code, 'chinh-sua-phong')
}

// ---- Vệ sinh lớp: /vo-lop/ve-sinh-chung (alias chia sẻ: /vo-lop/ve-sinh) ----
export const CLEANING_SHARE_PATH = `${ROUTES.classRoot}/ve-sinh`
