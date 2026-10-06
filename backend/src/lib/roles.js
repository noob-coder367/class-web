/**
 * Nguồn sự thật DUY NHẤT cho vai trò phía server.
 * Không tin role gửi từ client — luôn lấy từ profiles sau khi verify token.
 */

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
}

export const ROLE_VALUES = Object.freeze([ROLES.ADMIN, ROLES.USER])

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
