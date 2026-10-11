import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceLocalWordChain, allocateWordChainTurns, buildWordChainSource, normalizeWordChainPhrase, validateLocalWordChainAnswer } from '../src/lib/wordChain.js'

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

test('strict pasted text reports its heuristic n-gram pool', () => {
  const source=buildWordChainSource({sourceMode:'text',text:'học sinh học tập',validationMode:'strict'})
  assert.ok(source.phrases.includes('sinh học'))
  assert.ok(!source.phrases.includes('trường học'))
  assert.throws(()=>buildWordChainSource({sourceMode:'text',text:''}))
})
