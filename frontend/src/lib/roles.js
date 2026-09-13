/**
 * Bản sao UI của backend/src/lib/roles.js.
 * Chỉ dùng để hiện nút / nhãn. Mọi thao tác ghi vẫn bị backend chặn nếu sai role.
 */

export const ROLES = {
  ADMIN: 'admin',
  VP_ACADEMIC: 'vp_academic',
  VP_DISCIPLINE: 'vp_discipline',
  VP_EVENTS: 'vp_events',
  USER: 'user',
}

export const ROLE_VALUES = [
  ROLES.ADMIN,
  ROLES.VP_ACADEMIC,
  ROLES.VP_DISCIPLINE,
  ROLES.VP_EVENTS,
  ROLES.USER,
]

export const ROLE_LABELS = {
  admin: 'Admin',
  vp_academic: 'Lớp phó học tập',
  vp_discipline: 'Lớp phó kỷ luật',
  vp_events: 'Lớp phó sự kiện',
  user: 'Thành viên',
}

export const ASSIGNABLE_ROLES = [
  ROLES.USER,
  ROLES.VP_ACADEMIC,
  ROLES.VP_DISCIPLINE,
  ROLES.VP_EVENTS,
  ROLES.ADMIN,
]

export const ANNOUNCEMENT_SECTIONS = ['main', 'important', 'discipline']

export const SECTION_LABELS = {
  main: 'Thông báo chính',
  important: 'Báo bài quan trọng',
  discipline: 'Vi phạm kỷ luật cao',
}

const CAPABILITY_ROLES = {
  adminPanel: [ROLES.ADMIN],
  assignRoles: [ROLES.ADMIN],
  timetable: [ROLES.ADMIN],
  siteImages: [ROLES.ADMIN],
  homework: [ROLES.ADMIN, ROLES.VP_ACADEMIC],
  rules: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  directory: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  announcements: [ROLES.ADMIN, ROLES.VP_EVENTS, ROLES.VP_ACADEMIC, ROLES.VP_DISCIPLINE],
  announcements_main_manage: [ROLES.ADMIN, ROLES.VP_EVENTS],
  announcements_important_manage: [ROLES.ADMIN, ROLES.VP_ACADEMIC],
  announcements_discipline_manage: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  events: [ROLES.ADMIN, ROLES.VP_EVENTS],
}

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

export function hasCapability(role, capability) {
  const allowed = CAPABILITY_ROLES[capability]
  if (!allowed) return false
  return allowed.includes(normalizeRole(role))
}

export function capabilitiesFor(role) {
  const caps = {}
  for (const key of Object.keys(CAPABILITY_ROLES)) {
    caps[key] = hasCapability(role, key)
  }
  return caps
}

export function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.user
}

export function roleBadgeClass(role) {
  const r = normalizeRole(role)
  if (r === ROLES.ADMIN) return 'badge-admin'
  if (r === ROLES.VP_ACADEMIC) return 'badge-vp-academic'
  if (r === ROLES.VP_DISCIPLINE) return 'badge-vp-discipline'
  if (r === ROLES.VP_EVENTS) return 'badge-vp-events'
  return 'badge-user'
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

export function canPostToSection(role, section) {
  const key = normalizeSection(section)
  if (key === 'discipline') return false
  return hasCapability(role, SECTION_POST_CAP[key])
}

export function canHide(role, section) {
  const key = normalizeSection(section)
  return hasCapability(role, SECTION_HIDE_CAP[key])
}

export function canHardDelete(role, section) {
  if (isAdminRole(role)) return true
  return normalizeSection(section) === 'main' && hasCapability(role, 'announcements_main_manage')
}

export function canEdit(role, section) {
  const key = normalizeSection(section)
  if (isAdminRole(role)) return true
  return canPostToSection(role, key)
}

export function canManageArchive(role) {
  return hasCapability(role, 'announcements_main_manage')
}

export function postableSections(role) {
  return ANNOUNCEMENT_SECTIONS.filter((section) => canPostToSection(role, section))
}
