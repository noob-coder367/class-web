import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_MODES, gameModeByApiMode, gameModeById, roomPathForApiMode } from '../src/lib/gameModes.js'
import { ROUTES } from '../src/lib/routes.js'

test('Game Mode Registry chỉ liệt kê game thật và cung cấp metadata cho picker/Admin', () => {
  assert.deepEqual(GAME_MODES.map((mode) => mode.id), ['treasure-race', 'quiz-party'])
  const mode = gameModeById('treasure-race')
  assert.equal(mode.title, 'Đua tới kho báu')
  assert.equal(mode.createPath, ROUTES.createRoom)
  assert.equal(mode.joinAction, 'passcode')
  assert.ok(mode.icon)
  const party = gameModeById('quiz-party')
  assert.equal(party.title, 'Quiz Party — Đại chiến mini-game')
  assert.equal(party.createPath, ROUTES.createRoom)
  assert.equal(party.joinAction, 'passcode')
  assert.equal(gameModeById('coming-soon'), null)
  assert.equal(gameModeByApiMode('quiz_party'), party)
  assert.equal(roomPathForApiMode('quiz_party'), ROUTES.quizParty)
  assert.equal(roomPathForApiMode('unknown'), ROUTES.room)
})
