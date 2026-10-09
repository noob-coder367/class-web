import test from 'node:test'
import assert from 'node:assert/strict'

const { toPublicQuestion, normalizeResponseTime, assertUserTurn } = await import('../src/services/game/gameRoom.service.js')

test('game public question không lộ đáp án đúng hoặc reference answer', () => {
  const publicQuestion = toPublicQuestion({
    id: 'q1',
    order_index: 0,
    type: 'multiple_choice',
    content: '2 + 2 = ?',
    options: ['3', '4'],
    correct_option: 1,
    correct_boolean: null,
    reference_answer: '4',
    explanation: 'Phép cộng cơ bản.',
  })
  assert.deepEqual(publicQuestion, {
    id: 'q1',
    order_index: 0,
    type: 'multiple_choice',
    content: '2 + 2 = ?',
    options: ['3', '4'],
    explanation: 'Phép cộng cơ bản.',
  })
  assert.equal('correct_option' in publicQuestion, false)
  assert.equal('correct_boolean' in publicQuestion, false)
  assert.equal('reference_answer' in publicQuestion, false)
})

test('response time từ client bị chặn về miền hợp lệ', () => {
  assert.equal(normalizeResponseTime(-20), 0)
  assert.equal(normalizeResponseTime('250000'), 120000)
  assert.equal(normalizeResponseTime('not-a-number'), 0)
  assert.equal(normalizeResponseTime(1234.9), 1234)
})

test('kiểm tra lượt game từ chối người ngoài phòng và thành viên sai lượt', () => {
  const room = { host_id: 'host', settings: { single_device_mode: false } }
  const game = { current_turn: 0 }
  const teams = [{ id: 'team-a' }, { id: 'team-b' }]
  const players = [{ user_id: 'player-a', team_id: 'team-a' }, { user_id: 'player-b', team_id: 'team-b' }]

  assert.equal(assertUserTurn(room, game, teams, players, 'player-a'), teams[0])
  assert.throws(() => assertUserTurn(room, game, teams, players, 'outsider'), (error) => error.statusCode === 403 && error.code === 'not_in_room')
  assert.throws(() => assertUserTurn(room, game, teams, players, 'player-b'), (error) => error.statusCode === 409 && error.code === 'not_your_turn')
})

test('host có thể điều khiển mọi đội chỉ trong chế độ một thiết bị', () => {
  const room = { host_id: 'host', settings: { single_device_mode: true } }
  const game = { current_turn: 1 }
  const teams = [{ id: 'team-a' }, { id: 'team-b' }]
  const players = [{ user_id: 'host', team_id: null }]

  assert.equal(assertUserTurn(room, game, teams, players, 'host'), teams[1])
  assert.throws(() => assertUserTurn({ ...room, settings: { single_device_mode: false } }, game, teams, players, 'host'), (error) => error.statusCode === 409 && error.code === 'not_your_turn')
})
