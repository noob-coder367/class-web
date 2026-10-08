import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMovement, movePosition, hasWinner, orderTeamsByDice, nextTurnIndex, evaluateAnswer, generateMaze, shortestPathDistance } from '../src/services/game/treasureRace.engine.js'

test('treasure race movement is bounded and timer-aware', () => {
  assert.equal(calculateMovement({ isCorrect: true, responseTimeMs: 5000 }), 3)
  assert.equal(calculateMovement({ isCorrect: true, responseTimeMs: 12000 }), 2)
  assert.equal(calculateMovement({ isCorrect: false, responseTimeMs: 1 }), -1)
  assert.equal(calculateMovement({ isCorrect: true, responseTimeMs: 1000, timerEnabled: false }), 3)
  assert.equal(movePosition(0, -1, 10), 0)
  assert.equal(movePosition(9, 3, 10), 10)
  assert.equal(hasWinner(10, 10), true)
})

test('turn order and next team are deterministic', () => {
  assert.deepEqual(orderTeamsByDice([{ teamId: 'b', value: 5 }, { teamId: 'a', value: 5 }, { teamId: 'c', value: 2 }]).map((x) => x.teamId), ['a', 'b', 'c'])
  assert.equal(nextTurnIndex(1, 3), 2)
  assert.equal(nextTurnIndex(2, 3), 0)
})

test('answers are evaluated from the question key only', () => {
  assert.equal(evaluateAnswer({ type: 'multiple_choice', correct_option: 1 }, 1), true)
  assert.equal(evaluateAnswer({ type: 'true_false', correct_boolean: true }, true), true)
  assert.equal(evaluateAnswer({ type: 'true_false', correct_boolean: true }, false), false)
  assert.equal(evaluateAnswer({ type: 'essay' }, '  giải thích  '), true)
})

test('mọi đội xuất phát cách đích số ô bằng nhau (2-8 đội)', () => {
  for (let teams = 2; teams <= 8; teams += 1) {
    for (const seed of [1, 7, 42, 99, 2024, 31337]) {
      const maze = generateMaze(seed, 9, 9, teams)
      assert.equal(maze.spawns.length, teams)
      const distances = maze.spawns.map(([x, y]) => shortestPathDistance(maze, { x, y }))
      assert.equal(new Set(distances).size, 1, `teams=${teams} seed=${seed} distances=${distances}`)
      assert.equal(new Set(maze.spawns.map((s) => s.join(','))).size, teams)
    }
  }
})
