import test from 'node:test'
import assert from 'node:assert/strict'
import { activeMinigameId, createMinigameSchedule, rankQuizPartyTeams, scoreQuizPartyAnswer, QUIZ_PARTY_MINIGAMES } from '../src/services/game/quizParty.engine.js'

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

test('schedule stays within supported modes and does not repeat adjacent choices with varied picks', () => {
  const schedule = createMinigameSchedule(80, (size) => size - 1)
  assert.equal(schedule.length, 80)
  assert.ok(schedule.every((id) => QUIZ_PARTY_MINIGAMES.some((mode) => mode.id === id)))
  assert.ok(schedule.every((id, index) => index === 0 || id !== schedule[index - 1]))
})

test('answer scoring records correct/wrong/time and advances exactly one team turn', () => {
  const teams = [
    { id: 'a', correct_count: 1, wrong_count: 0, total_response_time: 800 },
    { id: 'b', correct_count: 0, wrong_count: 1, total_response_time: 900 },
  ]
  const game = { current_turn: 1, question_index: 2, total_questions: 5 }
  const correct = scoreQuizPartyAnswer({ game, teams, isCorrect: true, responseTime: 700, finishedAt: 'fixed' })
  assert.equal(correct.nextTeams[1].correct_count, 1)
  assert.equal(correct.nextTeams[1].wrong_count, 1)
  assert.equal(correct.nextTeams[1].total_response_time, 1600)
  assert.equal(correct.gamePatch.question_index, 3)
  assert.equal(correct.gamePatch.current_turn, 0)
  assert.equal(correct.gamePatch.status, 'playing')
  assert.equal(correct.gamePatch.winner_team_id, null)

  const wrong = scoreQuizPartyAnswer({ game, teams, isCorrect: false, responseTime: 500 })
  assert.equal(wrong.nextTeams[1].correct_count, 0)
  assert.equal(wrong.nextTeams[1].wrong_count, 2)
  assert.equal(wrong.nextTeams[1].total_response_time, 1400)
})

test('last Quiz Party answer sets finished state and server-ranked winner with tie-breaks', () => {
  const teams = [
    { id: 'b', correct_count: 1, wrong_count: 1, total_response_time: 1000 },
    { id: 'a', correct_count: 1, wrong_count: 0, total_response_time: 3000 },
  ]
  const outcome = scoreQuizPartyAnswer({
    game: { current_turn: 0, question_index: 3, total_questions: 4 },
    teams,
    isCorrect: false,
    responseTime: 100,
    finishedAt: '2026-10-10T00:00:00Z',
  })
  assert.equal(outcome.isFinished, true)
  assert.equal(outcome.gamePatch.question_index, 4)
  assert.equal(outcome.gamePatch.current_turn, 1)
  assert.equal(outcome.gamePatch.status, 'finished')
  assert.equal(outcome.gamePatch.phase, 'finished')
  assert.equal(outcome.gamePatch.winner_team_id, 'a')
  assert.equal(outcome.gamePatch.finished_at, '2026-10-10T00:00:00Z')
  assert.equal(scoreQuizPartyAnswer({ game: { current_turn: 8 }, teams, isCorrect: true, responseTime: 1 }), null)
})
