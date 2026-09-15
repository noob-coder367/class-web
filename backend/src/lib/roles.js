/**
 * Nguồn sự thật DUY NHẤT cho vai trò / quyền hạn phía server.
 * Không tin role gửi từ client — luôn lấy từ profiles sau khi verify token.
 *
 * admin              — toàn quyền, gồm truyền chức + full 3 ô thông báo
 * vp_academic        — Lớp phó học tập (LPHT): tab Bài tập + ô "Báo bài quan trọng" (đăng/sửa/ẩn, không xóa cứng)
 * vp_discipline      — Lớp phó kỷ luật (LPKL): tab Nội quy + ẩn bài ô "Vi phạm kỷ luật cao"
 * vp_events          — Lớp phó sự kiện (LPSK): EventSection + ô "Thông báo chính" (đăng/ẩn/xóa cứng) + kho lưu trữ + quản lý thời khóa biểu
 * vp_labor           — Lớp phó Lao động (LPLĐ): quản lý lịch trực vệ sinh theo tuần (T2–T7) + cập nhật trạng thái vệ sinh từng ngày
 * user               — thành viên thường
 */

export const ROLES = {
  ADMIN: 'admin',
  VP_ACADEMIC: 'vp_academic',
  VP_DISCIPLINE: 'vp_discipline',
  VP_EVENTS: 'vp_events',
  VP_LABOR: 'vp_labor',
  USER: 'user',
}

export const ROLE_VALUES = Object.freeze([
  ROLES.ADMIN,
  ROLES.VP_ACADEMIC,
  ROLES.VP_DISCIPLINE,
  ROLES.VP_EVENTS,
  ROLES.VP_LABOR,
  ROLES.USER,
])

export const ROLE_LABELS = Object.freeze({
  admin: 'Admin',
  vp_academic: 'Lớp phó học tập',
  vp_discipline: 'Lớp phó kỷ luật',
  vp_events: 'Lớp phó sự kiện',
  vp_labor: 'Lớp phó Lao động',
  user: 'Thành viên',
})

/** Thứ tự hiện trong dropdown Admin. */
export const ASSIGNABLE_ROLES = Object.freeze([
  ROLES.USER,
  ROLES.VP_ACADEMIC,
  ROLES.VP_DISCIPLINE,
  ROLES.VP_EVENTS,
  ROLES.VP_LABOR,
  ROLES.ADMIN,
])

export const ANNOUNCEMENT_SECTIONS = Object.freeze(['main', 'important', 'discipline'])

export const SECTION_LABELS = Object.freeze({
  main: 'Thông báo chính',
  important: 'Báo bài quan trọng',
  discipline: 'Vi phạm kỷ luật cao',
})

/**
 * Capability → danh sách role được phép (admin luôn có mọi capability).
 * Capability lạ = không ai được, kể cả khi client tự bịa tên quyền.
 *
 * `announcements` giữ lại như union (ai có quyền quản lý bất kỳ ô nào) để
 * tương thích UI cũ; mọi route ghi phải check capability theo section.
 */
const CAPABILITY_ROLES = Object.freeze({
  adminPanel: [ROLES.ADMIN],
  assignRoles: [ROLES.ADMIN],
  timetable: [ROLES.ADMIN, ROLES.VP_EVENTS],
  siteImages: [ROLES.ADMIN],
  homework: [ROLES.ADMIN, ROLES.VP_ACADEMIC],
  rules: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  directory: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  announcements: [ROLES.ADMIN, ROLES.VP_EVENTS, ROLES.VP_ACADEMIC, ROLES.VP_DISCIPLINE],
  announcements_main_manage: [ROLES.ADMIN, ROLES.VP_EVENTS],
  announcements_important_manage: [ROLES.ADMIN, ROLES.VP_ACADEMIC],
  announcements_discipline_manage: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  events: [ROLES.ADMIN, ROLES.VP_EVENTS],
  cleaningDuty: [ROLES.ADMIN, ROLES.VP_LABOR],
})

export const CAPABILITIES = Object.freeze(Object.keys(CAPABILITY_ROLES))

export function isKnownRole(raw) {
  return ROLE_VALUES.includes(String(raw || '').trim().toLowerCase())
}

export function normalizeRole(raw) {
  const role = String(raw || '').trim().toLowerCase()
  return isKnownRole(role) ? role : ROLES.USER
}

export function isAdminRole(role) {
  return normalizeRole(role) === ROLES.ADMIN
}

export function isStaffRole(role) {
  return normalizeRole(role) !== ROLES.USER
}

export function hasCapability(role, capability) {
  const key = String(capability || '')
  const allowed = CAPABILITY_ROLES[key]
  if (!allowed) return false
  return allowed.includes(normalizeRole(role))
}

export function capabilitiesFor(role) {
  const caps = {}
  for (const key of CAPABILITIES) {
    caps[key] = hasCapability(role, key)
  }
  return caps
}

export function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.user
}

export function normalizeSection(raw) {
  const section = String(raw || '').trim().toLowerCase()
  return ANNOUNCEMENT_SECTIONS.includes(section) ? section : 'main'
}

const SECTION_POST_CAP = {
  main: 'announcements_main_manage',
  important: 'announcements_important_manage',
}

const SECTION_HIDE_CAP = {
  main: 'announcements_main_manage',
  important: 'announcements_important_manage',
  discipline: 'announcements_discipline_manage',
}

/** Đăng tay: LPSK → main, LPHT → important, Admin → cả hai. Discipline chỉ hệ thống. */
export function canPostToSection(role, section) {
  const key = normalizeSection(section)
  if (key === 'discipline') return false
  return hasCapability(role, SECTION_POST_CAP[key])
}

/** Ẩn bài: LPSK/Admin (main), LPHT/Admin (important), LPKL/Admin (discipline). */
export function canHide(role, section) {
  const key = normalizeSection(section)
  return hasCapability(role, SECTION_HIDE_CAP[key])
}

/**
 * Xóa vĩnh viễn (kèm ảnh):
 * - LPSK: chỉ mục main
 * - Admin: mọi mục
 * - LPHT / LPKL: không
 */
export function canHardDelete(role, section) {
  if (isAdminRole(role)) return true
  return normalizeSection(section) === 'main' && hasCapability(role, 'announcements_main_manage')
}

/** Sửa giờ hết hạn / nội dung: cùng quyền đăng của mục đó (Admin mọi mục). */
export function canEdit(role, section) {
  const key = normalizeSection(section)
  if (isAdminRole(role)) return true
  return canPostToSection(role, key)
}

/** Kho lưu trữ + bỏ ẩn: LPSK / Admin. */
export function canManageArchive(role) {
  return hasCapability(role, 'announcements_main_manage')
}
