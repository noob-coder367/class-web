import test from 'node:test'
import assert from 'node:assert/strict'
import { findAnswer, TURN_TIME_LIMIT_SECONDS } from '../src/services/game/wordChain.engine.js'
import { dictionaryPhrasesStartingWith, isDictionaryPhrase } from '../src/services/game/wordChainDictionary.js'

test('mỗi lượt có 60 giây', () => {
  assert.equal(TURN_TIME_LIMIT_SECONDS, 60)
})

test('findAnswer trả cụm hợp lệ nối đúng tiếng cuối, có trong nguồn và chưa dùng', () => {
  for (let index = 0; index < 20; index += 1) {
    const answer = findAnswer({ lastPhrase: 'học sinh', usedPhrases: ['học sinh'], allowedPhrases: ['học sinh', 'sinh học', 'sinh viên'] })
    assert.ok(['sinh học', 'sinh viên'].includes(answer), answer)
    assert.ok(isDictionaryPhrase(answer))
  }
})

test('findAnswer ưu tiên cụm mà đội kế tiếp vẫn còn nước nối', () => {
  // "sinh viên" kết thúc bằng "viên" (không có cụm nào nối tiếp trong nguồn); "sinh học" -> "học sinh" bị dùng => cả hai đều cụt,
  // thêm "học tập" để "sinh học" còn đường đi.
  const allowed = ['học sinh', 'sinh học', 'sinh viên', 'học tập']
  for (let index = 0; index < 20; index += 1) {
    assert.equal(findAnswer({ lastPhrase: 'học sinh', usedPhrases: ['học sinh'], allowedPhrases: allowed }), 'sinh học')
  }
})

test('findAnswer trả null khi không còn cụm nào nối được', () => {
  assert.equal(findAnswer({ lastPhrase: 'sinh viên', usedPhrases: ['sinh viên'], allowedPhrases: ['sinh viên'] }), null)
  assert.equal(findAnswer({ lastPhrase: '', allowedPhrases: ['sinh viên'] }), null)
})

test('luật Tự do: đáp án lấy từ toàn bộ từ điển và chưa dùng', () => {
  const pool = dictionaryPhrasesStartingWith('sinh')
  assert.ok(pool.length > 1)
  const answer = findAnswer({ lastPhrase: 'học sinh', usedPhrases: ['học sinh'], allowedPhrases: [], validationMode: 'free' })
  assert.ok(pool.includes(answer))
  const blocked = findAnswer({ lastPhrase: 'học sinh', usedPhrases: ['học sinh', ...pool], allowedPhrases: [], validationMode: 'free' })
  assert.equal(blocked, null)
})
