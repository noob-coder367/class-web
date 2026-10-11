import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { advanceLocalWordChain, allocateWordChainTurns, normalizeWordChainPhrase, restoreLocalRoom, setWordChainDictionary, validateLocalWordChainAnswer } from '../src/lib/wordChain.js'

// Dùng đúng file từ điển thật của dự án (trình duyệt tải bằng ?raw, test đọc trực tiếp).
setWordChainDictionary(new Set(readFileSync(new URL('../../shared/vi-dictionary.txt', import.meta.url), 'utf8').split('\n').filter(Boolean)))

const localRoom = (overrides={}) => ({ status:'playing', turns_used:0, total_turns:2, current_turn:0, allowed_phrases:['học sinh','sinh học','học tập'], history:[], teams:[{id:'a',name:'A',turn_quota:1,turns_used:0},{id:'b',name:'B',turn_quota:1,turns_used:0}], ...overrides })

test('frontend normalization and exact turn allocation match backend rules', () => {
  assert.equal(normalizeWordChainPhrase('  HỌC—SINH!!! '), 'học sinh')
  assert.deepEqual(allocateWordChainTurns(2,31), [16,15])
  assert.deepEqual(allocateWordChainTurns(3,30), [10,10,10])
})

test('local answer is verified, failed input does not consume a turn, accepted answers alternate teams', () => {
  const room=localRoom()
  assert.throws(()=>validateLocalWordChainAnswer(room,'lịch sử'),/chưa nằm trong nguồn/)
  assert.equal(room.turns_used,0)
  const first=advanceLocalWordChain(room,'answer','Học sinh')
  assert.equal(first.current_turn,1)
  assert.equal(first.teams[0].turns_used,1)
  const second=advanceLocalWordChain(first,'answer','sinh học')
  assert.equal(second.status,'finished')
  assert.equal(second.turns_used,2)
})

test('local answers must be real dictionary words in every mode, including free mode', () => {
  const free = localRoom({ validation_mode: 'free', starting_phrase: 'học sinh', allowed_phrases: ['học sinh', 'sinh học'] })
  assert.equal(validateLocalWordChainAnswer(free, 'sinh lý'), 'sinh lý')
  assert.throws(() => validateLocalWordChainAnswer(free, 'sinh ksshdjs'), /không phải từ có nghĩa/)
  assert.throws(() => validateLocalWordChainAnswer(localRoom({ validation_mode: 'free', starting_phrase: '', allowed_phrases: [] }), 'ksshdjs'), /không phải từ có nghĩa/)
  assert.equal(free.turns_used, 0)
})

test('local validation fails closed when the dictionary has not loaded yet', () => {
  assert.throws(() => validateLocalWordChainAnswer(localRoom(), 'học sinh', null), /từ điển/i)
})

test('restoring a saved local room never rolls back a turn that was just accepted', () => {
  const saved = localRoom({ starting_phrase: 'học sinh' })
  const advanced = advanceLocalWordChain(saved, 'answer', 'sinh học')
  assert.equal(advanced.current_turn, 1)
  assert.equal(restoreLocalRoom(advanced, saved), advanced)
  assert.equal(restoreLocalRoom(null, saved), saved)
})
