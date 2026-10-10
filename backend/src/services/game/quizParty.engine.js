export const QUIZ_PARTY_MINIGAMES = Object.freeze([
  Object.freeze({ id: 'whack-a-choice', title: 'Đập đáp án', instruction: 'Chọn thật nhanh ô chứa đáp án đúng.', accent: 'pink' }),
  Object.freeze({ id: 'memory-tiles', title: 'Ô trí nhớ', instruction: 'Ghi nhớ đáp án rồi chọn đúng ô sau khi các ô bị úp lại.', accent: 'violet' }),
  Object.freeze({ id: 'safe-island', title: 'Đảo an toàn', instruction: 'Chọn hòn đảo mang đáp án đúng trước khi nước dâng.', accent: 'cyan' }),
  Object.freeze({ id: 'boss-battle', title: 'Đấu trùm', instruction: 'Mỗi đáp án đúng gây sát thương; trả lời sai làm trùm phản công.', accent: 'orange' }),
  Object.freeze({ id: 'color-rush', title: 'Cổng màu', instruction: 'Chọn cánh cổng mang đáp án đúng để tăng tốc.', accent: 'green' }),
  Object.freeze({ id: 'obby-dash', title: 'Vượt chướng ngại', instruction: 'Chọn đáp án đúng để nhảy qua chướng ngại và tiến về đích.', accent: 'blue' }),
])

/**
 * Build a server-authoritative schedule. The injected picker accepts an exclusive
 * upper bound, which lets production use crypto.randomInt and tests be deterministic.
 * Adjacent rounds avoid repeating the same mini-game whenever there are alternatives.
 */
export function createMinigameSchedule(roundCount, pickIndex = (size) => Math.floor(Math.random() * size)) {
  const count = Math.max(1, Math.min(200, Math.floor(Number(roundCount) || 1)))
  const schedule = []
  for (let index = 0; index < count; index += 1) {
    const choices = QUIZ_PARTY_MINIGAMES.filter((item) => item.id !== schedule[index - 1])
    const picked = choices[Math.max(0, Math.min(choices.length - 1, Math.floor(Number(pickIndex(choices.length)) || 0)))]
    schedule.push(picked.id)
  }
  return schedule
}

export function rankQuizPartyTeams(teams = []) {
  return [...teams].sort((a, b) =>
    (Number(b.correct_count) || 0) - (Number(a.correct_count) || 0) ||
    (Number(a.wrong_count) || 0) - (Number(b.wrong_count) || 0) ||
    (Number(a.total_response_time) || 0) - (Number(b.total_response_time) || 0) ||
    String(a.id).localeCompare(String(b.id)),
  )
}

export function activeMinigameId(state, questionIndex) {
  const schedule = state?.mode === 'quiz_party' && Array.isArray(state.minigame_schedule)
    ? state.minigame_schedule
    : []
  return schedule[questionIndex] || QUIZ_PARTY_MINIGAMES[0].id
}
