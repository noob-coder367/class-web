import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_MODES, gameModeById } from '../src/lib/gameModes.js'
import { ROUTES } from '../src/lib/routes.js'

test('Game Mode Registry chỉ liệt kê game thật và cung cấp metadata cho picker/Admin', () => {
  assert.deepEqual(GAME_MODES.map((mode) => mode.id), ['treasure-race'])
  const mode = gameModeById('treasure-race')
  assert.equal(mode.title, 'Đua tới kho báu')
  assert.equal(mode.createPath, ROUTES.createRoom)
  assert.equal(mode.joinAction, 'passcode')
  assert.ok(mode.icon)
  assert.equal(gameModeById('coming-soon'), null)
})
