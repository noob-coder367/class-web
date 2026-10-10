const EMPTY_OUTFIT = Object.freeze({ hat: null, acc: null, shirt: null })

export function quizPartySessionKey(code) {
  return `quiz-party-session:${String(code || '').toUpperCase()}`
}

export function makeTeamDrafts(teams = [], stored = []) {
  const savedDrafts = Array.isArray(stored) ? stored : []
  return teams.map((team, index) => {
    const previous = savedDrafts.find((item) => item.id === team.id)
    return {
      id: team.id,
      name: String(typeof previous?.name === 'string' ? previous.name : (team.name || `Đội ${index + 1}`)).slice(0, 28),
      outfit: { ...EMPTY_OUTFIT, ...previous?.outfit },
    }
  })
}

export function updateTeamDraft(drafts, teamId, patch) {
  return drafts.map((team) => {
    if (team.id !== teamId) return team
    return {
      ...team,
      ...patch,
      ...(patch.outfit ? { outfit: { ...team.outfit, ...patch.outfit } } : {}),
    }
  })
}

export function serializeTeamDrafts(drafts = []) {
  return drafts.map(({ id, name, outfit = {} }) => ({
    id,
    name: String(name || '').slice(0, 28),
    outfit: {
      hat: outfit.hat || null,
      acc: outfit.acc || null,
      shirt: outfit.shirt || null,
    },
  }))
}

export function readTeamDrafts(code, storage) {
  try {
    const target = storage === undefined ? globalThis.sessionStorage : storage
    const raw = target?.getItem(quizPartySessionKey(code))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeTeamDrafts(code, drafts, storage) {
  try {
    const target = storage === undefined ? globalThis.sessionStorage : storage
    target?.setItem(quizPartySessionKey(code), JSON.stringify(serializeTeamDrafts(drafts)))
  } catch {
    // Private browsing can disable storage; in-memory play still works.
  }
}
