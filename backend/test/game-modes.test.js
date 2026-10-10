import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_MODE_IDS, getGameMode } from '../src/services/game/gameModes.js'

test('game registry resolves the legacy Treasure Race request and only exposes supported database modes', () => {
  assert.deepEqual([...GAME_MODE_IDS], ['treasure_race', 'quiz_party'])
  assert.equal(getGameMode('treasure-race')?.id, 'treasure_race')
  assert.equal(getGameMode('treasure_race')?.createRpc, 'create_game_room_atomic')
  assert.equal(getGameMode('quiz_party')?.createRpc, 'create_game_room_atomic_v2')
  assert.equal(getGameMode('unknown'), null)
})

test('mode modules keep their distinct start state and answer rules', () => {
  const teams = [{ id: 'a' }, { id: 'b' }]
  const ordered = [{ teamId: 'a', value: 6 }, { teamId: 'b', value: 4 }]
  const race = getGameMode('treasure_race').start({ ordered, teams, seed: 42, questionLimit: 2 })
  const party = getGameMode('quiz_party').start({ ordered, teams, seed: 42, questionLimit: 2 })
  assert.equal(race.gameLayout.seed, 42)
  assert.equal(race.teamLayout.length, 2)
  assert.equal(party.gameLayout.mode, 'quiz_party')
  assert.equal(party.gameLayout.minigame_schedule.length, 2)
  assert.deepEqual(party.teamLayout.map((team) => [team.maze_x, team.maze_y]), [[0, 0], [0, 0]])

  const raceAnswer = getGameMode('treasure_race').scoreAnswer({
    game: { current_turn: 0, question_index: 0, total_questions: 2, maze_layout: race.gameLayout },
    teams: [{ id: 'a', correct_count: 0, wrong_count: 0, total_response_time: 0 }, { id: 'b', correct_count: 0, wrong_count: 0, total_response_time: 0 }],
    currentTeam: { id: 'a', correct_count: 0, wrong_count: 0, total_response_time: 0 },
    isCorrect: true,
    responseTime: 100,
  })
  assert.equal(raceAnswer.gamePatch.phase, 'dice_roll')
  assert.ok(raceAnswer.gamePatch.remaining_moves >= 1 && raceAnswer.gamePatch.remaining_moves <= 6)
})
