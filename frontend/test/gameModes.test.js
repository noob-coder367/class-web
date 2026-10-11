import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_CATALOG, GAME_MODES, gameCatalogById, gameCreateLink, gameDetailPath, gameModeByApiMode, gameModeById, roomPathForApiMode } from '../src/lib/gameModes.js'
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

test('Game Catalog gồm cả game phòng và game chơi trực tiếp, id là duy nhất', () => {
  assert.deepEqual(GAME_CATALOG.map((game) => game.id), ['treasure-race', 'quiz-party', 'bolt-sort', 'word-chain'])
  assert.equal(new Set(GAME_CATALOG.map((game) => game.id)).size, GAME_CATALOG.length)
  for (const game of GAME_CATALOG) {
    assert.ok(game.title && game.description && game.icon, `${game.id} thiếu metadata`)
    assert.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(game.id), `${game.id} không hợp lệ làm game_key`)
    assert.ok(game.facts.length > 0)
  }
  assert.equal(gameCatalogById('bolt-sort').joinPath, ROUTES.boltSort)
  assert.equal(gameCatalogById('word-chain').joinPath, ROUTES.wordChain)
  assert.equal(gameCatalogById('nope'), null)
})

test('Game chơi trực tiếp không lọt vào registry tạo phòng', () => {
  assert.equal(gameModeById('bolt-sort'), null)
  assert.equal(gameModeById('word-chain'), null)
})

test('Đường dẫn chi tiết và link tạo phòng chọn sẵn game', () => {
  assert.equal(gameDetailPath('bolt-sort'), `${ROUTES.gameDetail}/bolt-sort`)
  assert.equal(gameCreateLink(gameCatalogById('quiz-party')), `${ROUTES.createRoom}?mode=quiz-party`)
  assert.equal(gameCreateLink(gameCatalogById('bolt-sort')), null)
})
