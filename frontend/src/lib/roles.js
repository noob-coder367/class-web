const VALID_ROLES = new Set(['admin', 'user'])

export function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase()
  return VALID_ROLES.has(value) ? value : 'user'
}

export function isAdminRole(role) {
  return normalizeRole(role) === 'admin'
}
