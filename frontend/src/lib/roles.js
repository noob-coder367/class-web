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
  ai: '/vo-lop/AI/app',
  classMoney: '/vo-lop/nang-cao/tien-lop',
  profileSetting: '/profile-setting',
  classRoot: '/vo-lop',
  resources: '/tai-nguyen',
  classMembers: '/thanh-vien-lop',
  advanced: '/vo-lop/nang-cao',
}

// Link cũ của trang Tiền lớp (trước khi chia nhóm route).
export const LEGACY_CLASS_MONEY_PATH = '/tien-lop'

// Đường dẫn cũ của trang AI (trước đây là /app). Vẫn nhận để link cũ không bị chết,
// HomePage sẽ tự chuyển sang ROUTES.ai.
export const LEGACY_AI_PATH = '/app'

function normalizePathname(pathname) {
  return String(pathname || '').replace(/\/+$/, '').toLowerCase()
}

/** Trang chat AI: /vo-lop/AI/app (không phân biệt hoa/thường, bỏ qua dấu / cuối). */
export function isAIAssistantPath(pathname) {
  return normalizePathname(pathname) === ROUTES.ai.toLowerCase()
}

/** Link cũ /app -> cần chuyển sang ROUTES.ai. */
export function isLegacyAIPath(pathname) {
  return normalizePathname(pathname) === LEGACY_AI_PATH
}

// Nhóm route: /vo-lop/<nhóm>/<mục>. "Trang chủ" và "Nâng cao" là 2 nhóm lớn.
export const CLASS_GROUP_PATH = {
  home: 'trang-chu',
  advanced: 'nang-cao',
}

// Tab nội bộ (ClassRoomView) <-> tên segment trên URL (phần sau segment nhóm).
export const CLASS_TAB_PATH = {
  home: 'trang-chu',
  announcements: 'thong-bao-chung',
  timetable: 'thoi-khoa-bieu',
  homework: 'bai-tap-ve-nha',
  rules: 'noi-quy-lop',
  'cleaning-duty': 've-sinh-chung',
  advanced: 'nang-cao',
  'class-space': 'lop-hoc',
  utilities: 'tien-ich-phu',
  feedback: 'phan-hoi',
}

// Mỗi tab thuộc nhóm nào (tab không có nhóm = trang gốc của nhóm hoặc đứng riêng).
export const CLASS_TAB_GROUP = {
  announcements: 'trang-chu',
  timetable: 'trang-chu',
  homework: 'trang-chu',
  rules: 'trang-chu',
  'cleaning-duty': 'trang-chu',
  'class-space': 'nang-cao',
  utilities: 'nang-cao',
  feedback: 'nang-cao',
}

const GROUP_SEGMENTS = new Set(Object.values(CLASS_TAB_GROUP))

const PATH_TAB = Object.fromEntries(
  Object.entries(CLASS_TAB_PATH).map(([tab, path]) => [path.toLowerCase(), tab])
)
// Link cũ /vo-lop/home vẫn mở Trang chủ.
PATH_TAB.home = 'home'
// Alias chia sẻ / xem chi tiết: /vo-lop/thong-bao?id=<id>
PATH_TAB['thong-bao'] = 'announcements'
// Alias chia sẻ nội quy: /vo-lop/trang-chu/noi-quy (+ /vi-pham, /bang-xep-hang)
PATH_TAB['noi-quy'] = 'rules'
// Alias chia sẻ vệ sinh lớp: /vo-lop/trang-chu/ve-sinh
PATH_TAB['ve-sinh'] = 'cleaning-duty'

/** Tạo URL đầy đủ cho 1 tab trong /vo-lop, kèm các đoạn phụ phía sau (nếu có). */
export function classTabPath(tab, ...rest) {
  const key = CLASS_TAB_PATH[tab] ? tab : 'announcements'
  const seg = CLASS_TAB_PATH[key]
  const group = CLASS_TAB_GROUP[key]
  const tail = rest.filter((p) => p !== undefined && p !== null && p !== '').join('/')
  const head = group ? `${ROUTES.classRoot}/${group}/${seg}` : `${ROUTES.classRoot}/${seg}`
  return `${head}${tail ? `/${tail}` : ''}`
}

/**
 * Từ pathname hiện tại -> { tab, rest[] }. tab=null nếu không thuộc /vo-lop.
 * Nhận cả route mới (/vo-lop/<nhóm>/<mục>/...) lẫn route cũ (/vo-lop/<mục>/...).
 */
export function parseClassPath(pathname) {
  const clean = String(pathname || '').replace(/^\/+|\/+$/g, '')
  const parts = clean.split('/').filter(Boolean)
  if (parts[0] !== 'vo-lop') return { tab: null, rest: [] }
  const seg = (parts[1] || '').toLowerCase()
  if (GROUP_SEGMENTS.has(seg) || seg === 'trang-chu' || seg === 'nang-cao') {
    const child = (parts[2] || '').toLowerCase()
    // /vo-lop/trang-chu hoặc /vo-lop/nang-cao: trang gốc của nhóm.
    if (!child) return { tab: seg === 'nang-cao' ? 'advanced' : 'home', rest: [] }
    const tab = PATH_TAB[child] || null
    return { tab, rest: parts.slice(3) }
  }
  const tab = PATH_TAB[seg] || null
  return { tab, rest: parts.slice(2) }
}

// ---- Thông báo chung: /vo-lop/thong-bao?id=<id> (giữ /vo-lop/thong-bao-chung/:id) ----
export function announcementDetailPath(id) {
  const encoded = encodeURIComponent(String(id || '').trim())
  return `${classTabPath('announcements')}?id=${encoded}`
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

export const RULES_SHARE_PATH = `${ROUTES.classRoot}/trang-chu/noi-quy`
export const RULES_VIOLATIONS_SHARE_PATH = `${ROUTES.classRoot}/trang-chu/noi-quy/vi-pham`
export const RULES_RANK_SHARE_PATH = `${ROUTES.classRoot}/trang-chu/noi-quy/bang-xep-hang`

export function rulesPanePath(pane) {
  return classTabPath('rules', RULES_PANE_PATH[pane] || RULES_PANE_PATH.rules)
}
export function parseRulesPane(rest) {
  return PATH_RULES_PANE[(rest?.[0] || '').toLowerCase()] || null
}

// ---- Lớp học (phòng quiz): /vo-lop/nang-cao/lop-hoc/... ----
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

// ---- Vệ sinh lớp: /vo-lop/trang-chu/ve-sinh-chung (alias chia sẻ: /vo-lop/trang-chu/ve-sinh) ----
export const CLEANING_SHARE_PATH = `${ROUTES.classRoot}/trang-chu/ve-sinh`

export function cleaningDayPath(dayId, gallery = false) {
  const labels = { t2: 'thu-hai', t3: 'thu-ba', t4: 'thu-tu', t5: 'thu-nam', t6: 'thu-sau', t7: 'thu-bay' }
  const segment = labels[dayId] || 'thu-hai'
  return classTabPath('cleaning-duty', segment, ...(gallery ? ['anh-truc'] : []))
}

export function parseCleaningPath(rest) {
  const reverse = { 'thu-hai': 't2', 'thu-ba': 't3', 'thu-tu': 't4', 'thu-nam': 't5', 'thu-sau': 't6', 'thu-bay': 't7' }
  const dayId = reverse[String(rest?.[0] || '').toLowerCase()] || null
  return { dayId, gallery: dayId ? String(rest?.[1] || '').toLowerCase() === 'anh-truc' : false }
}

/** Trang cây thành viên lớp: /thanh-vien-lop (bỏ qua dấu / cuối, không phân biệt hoa/thường). */
export function isClassMembersPath(pathname) {
  return normalizePathname(pathname) === ROUTES.classMembers
}

/** Trang Tiền lớp: route mới hoặc link cũ /tien-lop. */
export function isClassMoneyPath(pathname) {
  const p = normalizePathname(pathname)
  return p === ROUTES.classMoney || p === LEGACY_CLASS_MONEY_PATH
}
