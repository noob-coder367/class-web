import test from 'node:test'
import assert from 'node:assert/strict'
import { activeMinigameId, createMinigameSchedule, rankQuizPartyTeams, QUIZ_PARTY_MINIGAMES } from '../src/services/game/quizParty.engine.js'

test('Quiz Party creates a bounded schedule using only supported mini-games', () => {
  const schedule = createMinigameSchedule(8, () => 0)
  assert.equal(schedule.length, 8)
  assert.ok(schedule.every((id) => QUIZ_PARTY_MINIGAMES.some((mode) => mode.id === id)))
  assert.ok(schedule.every((id, index) => index === 0 || id !== schedule[index - 1]))
})

test('Quiz Party schedule clamps invalid or excessive round counts', () => {
  assert.equal(createMinigameSchedule(0, () => 0).length, 1)
  assert.equal(createMinigameSchedule(500, () => 0).length, 200)
})

test('active minigame safely falls back when state or index is missing', () => {
  assert.equal(activeMinigameId({ mode: 'quiz_party', minigame_schedule: ['boss-battle'] }, 0), 'boss-battle')
  assert.equal(activeMinigameId({ mode: 'quiz_party', minigame_schedule: [] }, 12), 'whack-a-choice')
  assert.equal(activeMinigameId(null, 0), 'whack-a-choice')
})

test('Quiz Party ranking uses correct answers, then fewer errors, then response time', () => {
  const teams = [
    { id: 'late', correct_count: 3, wrong_count: 1, total_response_time: 9000 },
    { id: 'winner', correct_count: 4, wrong_count: 2, total_response_time: 10000 },
    { id: 'fast', correct_count: 3, wrong_count: 1, total_response_time: 3000 },
    { id: 'careful', correct_count: 3, wrong_count: 0, total_response_time: 15000 },
  ]
  assert.deepEqual(rankQuizPartyTeams(teams).map((team) => team.id), ['winner', 'careful', 'fast', 'late'])
})
