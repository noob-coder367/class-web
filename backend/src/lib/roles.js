/**
 * Nguồn sự thật DUY NHẤT cho vai trò / quyền hạn phía server.
 * Không tin role gửi từ client — luôn lấy từ profiles sau khi verify token.
 *
 * admin              — toàn quyền, gồm truyền chức
 * vp_academic        — Lớp phó học tập: chỉ tab Bài tập về nhà
 * vp_discipline      — Lớp phó kỷ luật: chỉ tab Nội quy lớp
 * vp_events          — Lớp phó sự kiện: EventSection + tab Thông báo chung
 * user               — thành viên thường
 */

export const ROLES = {
  ADMIN: 'admin',
  VP_ACADEMIC: 'vp_academic',
  VP_DISCIPLINE: 'vp_discipline',
  VP_EVENTS: 'vp_events',
  USER: 'user',
}

export const ROLE_VALUES = Object.freeze([
  ROLES.ADMIN,
  ROLES.VP_ACADEMIC,
  ROLES.VP_DISCIPLINE,
  ROLES.VP_EVENTS,
  ROLES.USER,
])

export const ROLE_LABELS = Object.freeze({
  admin: 'Admin',
  vp_academic: 'Lớp phó học tập',
  vp_discipline: 'Lớp phó kỷ luật',
  vp_events: 'Lớp phó sự kiện',
  user: 'Thành viên',
})

/** Thứ tự hiện trong dropdown Admin. */
export const ASSIGNABLE_ROLES = Object.freeze([
  ROLES.USER,
  ROLES.VP_ACADEMIC,
  ROLES.VP_DISCIPLINE,
  ROLES.VP_EVENTS,
  ROLES.ADMIN,
])

/**
 * Capability → danh sách role được phép (admin luôn có mọi capability).
 * Capability lạ = không ai được, kể cả khi client tự bịa tên quyền.
 */
const CAPABILITY_ROLES = Object.freeze({
  adminPanel: [ROLES.ADMIN],
  assignRoles: [ROLES.ADMIN],
  timetable: [ROLES.ADMIN],
  siteImages: [ROLES.ADMIN],
  homework: [ROLES.ADMIN, ROLES.VP_ACADEMIC],
  rules: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  directory: [ROLES.ADMIN, ROLES.VP_DISCIPLINE],
  announcements: [ROLES.ADMIN, ROLES.VP_EVENTS],
  events: [ROLES.ADMIN, ROLES.VP_EVENTS],
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
