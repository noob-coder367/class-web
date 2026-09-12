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

const CAPABILITY_ROLES = {
  adminPanel: [ROLES.ADMIN],
  assignRoles: [ROLES.ADMIN],
  timetable: [ROLES.ADMIN],
  siteImages: [ROLES.ADMIN],
  homework: [ROLES.ADMIN, ROLES.VP_ACADEMIC],
  rules: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  directory: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  announcements: [ROLES.ADMIN, ROLES.VP_EVENTS],
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
