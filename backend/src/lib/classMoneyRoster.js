/**
 * Map the already-parsed Tiện ích PDF roster onto optional profile accounts.
 * Does not read or parse PDF. STT is kept from the stored roster and never
 * reindexed after skipping empty rows or selecting a subset.
 */

function foldName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function namesEqual(a, b) {
  const x = foldName(a)
  const y = foldName(b)
  return Boolean(x) && x === y
}

export function parseStudentNumber(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function sortByStudentNumber(rows) {
  return (rows || []).slice().sort((a, b) => {
    const left = parseStudentNumber(a?.student_number)
    const right = parseStudentNumber(b?.student_number)
    if (left != null && right != null && left !== right) return left - right
    if (left != null && right == null) return -1
    if (left == null && right != null) return 1
    return String(a?.display_name_snapshot || a?.name || '').localeCompare(
      String(b?.display_name_snapshot || b?.name || ''),
      'vi'
    )
  })
}

export function buildMoneyMembersFromUtilityRoster(rosterNames, profiles) {
  const names = Array.isArray(rosterNames) ? rosterNames : []
  const namedProfiles = (Array.isArray(profiles) ? profiles : []).filter((row) => {
    const username = String(row?.username || '').trim()
    return Boolean(username) && !username.toLowerCase().startsWith('pending:')
  })
  const usedProfileIds = new Set()
  const members = []

  for (const item of names) {
    const src = item && typeof item === 'object' ? item : { name: item }
    const name = String(src.name || '').trim()
    if (!name) continue
    const studentNumber = parseStudentNumber(src.stt ?? src.student_number)
    if (studentNumber == null) continue

    const matches = namedProfiles.filter((row) => !usedProfileIds.has(row.id) && namesEqual(row.username, name))
    const profile = matches.find((row) => row.is_member === true) || matches[0] || null
    if (profile?.id) usedProfileIds.add(profile.id)

    members.push({
      id: `stt:${studentNumber}`,
      student_number: studentNumber,
      profile_id: profile?.id || null,
      name,
      role: profile?.role || null,
      has_account: Boolean(profile?.id),
    })
  }

  return sortByStudentNumber(members)
}
