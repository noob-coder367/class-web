export const TREASURE_RACE_MODE = 'treasure_race'

export function calculateMovement({ isCorrect, responseTimeMs, timerEnabled = true }) {
  if (!isCorrect) return -1
  if (!timerEnabled) return 3
  return responseTimeMs <= 10000 ? 3 : 2
}

export function movePosition(position, movement, boardLength) {
  const finalPosition = Math.max(0, boardLength)
  return Math.min(finalPosition, Math.max(0, position + movement))
}

export function hasWinner(position, boardLength) {
  return position >= boardLength
}

export function orderTeamsByDice(rolls) {
  return [...rolls].sort((a, b) => b.value - a.value || a.teamId.localeCompare(b.teamId))
}

export function nextTurnIndex(currentIndex, teamCount) {
  return teamCount === 0 ? 0 : (currentIndex + 1) % teamCount
}

export function evaluateAnswer(question, answer) {
  if (!question) return false
  if (question.type === 'multiple_choice') return Number(answer) === Number(question.correct_option)
  if (question.type === 'true_false') return Boolean(answer) === Boolean(question.correct_boolean)
  if (question.type === 'essay') return String(answer || '').trim().length > 0
  return false
}
