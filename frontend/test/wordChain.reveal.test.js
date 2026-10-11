import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { advanceLocalWordChain, findLocalWordChainAnswer, setWordChainDictionary, WORD_CHAIN_TURN_SECONDS } from '../src/lib/wordChain.js'

const dictionary = new Set(readFileSync(new URL('../../shared/vi-dictionary.txt', import.meta.url), 'utf8').split('\n').filter(Boolean))
setWordChainDictionary(dictionary)

const room = (overrides = {}) => ({ local: true, status: 'playing', turns_used: 0, total_turns: 4, current_turn: 0, validation_mode: 'strict', starting_phrase: 'học sinh', allowed_phrases: ['học sinh', 'sinh học', 'sinh viên'], history: [], teams: [{ id: 'a', name: 'A', turn_quota: 2, turns_used: 0 }, { id: 'b', name: 'B', turn_quota: 2, turns_used: 0 }], ...overrides })

test('mỗi lượt có 60 giây', () => {
  assert.equal(WORD_CHAIN_TURN_SECONDS, 60)
})

test('đáp án hệ thống luôn nối đúng tiếng cuối, có trong nguồn và chưa dùng', () => {
  for (let index = 0; index < 20; index += 1) {
    const answer = findLocalWordChainAnswer(room())
    assert.ok(['sinh học', 'sinh viên'].includes(answer), answer)
  }
})

test('đáp án hệ thống bỏ qua cụm đã dùng và trả null khi hết nước nối', () => {
  const afterOne = advanceLocalWordChain(room(), 'answer', 'sinh viên')
  // tiếng cuối là "viên": nguồn không còn cụm nào bắt đầu bằng "viên"
  assert.equal(findLocalWordChainAnswer(afterOne), null)
  const loop = room({ allowed_phrases: ['học sinh', 'sinh học'], history: [{ action: 'answer', phrase: 'sinh học' }] })
  // tiếng cuối "học": chỉ còn "học sinh" nhưng đó là từ khởi đầu đã dùng
  assert.equal(findLocalWordChainAnswer(loop), null)
})

test('luật Tự do: đáp án lấy từ toàn bộ từ điển, hợp lệ với bộ kiểm tra đáp án', () => {
  const free = room({ validation_mode: 'free', allowed_phrases: ['học sinh'] })
  const answer = findLocalWordChainAnswer(free)
  assert.ok(answer.startsWith('sinh '), answer)
  assert.ok(dictionary.has(answer))
  assert.doesNotThrow(() => advanceLocalWordChain(free, 'answer', answer))
})

test('bắt đầu lượt mới thì có mốc thời gian mới cho đồng hồ 60 giây', () => {
  const next = advanceLocalWordChain(room(), 'answer', 'sinh học')
  assert.ok(Number.isFinite(Date.parse(next.turn_started_at)))
  assert.equal(advanceLocalWordChain(room({ total_turns: 1, teams: [{ id: 'a', name: 'A', turn_quota: 1, turns_used: 0 }, { id: 'b', name: 'B', turn_quota: 0, turns_used: 0 }] }), 'skip').turn_started_at, null)
})
