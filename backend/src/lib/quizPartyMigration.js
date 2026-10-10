const MISSING_RPC_CODES = new Set(['42883', 'PGRST202'])

export function isQuizPartyMigrationUnavailable(error, gameMode) {
  return gameMode === 'quiz_party' && MISSING_RPC_CODES.has(String(error?.code || '').toUpperCase())
}
