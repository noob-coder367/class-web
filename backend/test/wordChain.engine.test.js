import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateTurns, chooseStartingPhrase, makePhraseSet, normalizePhrase, validateAnswer, WordChainRuleError } from '../src/services/game/wordChain.engine.js'

test('normalization handles whitespace, punctuation, casing and canonically equivalent Vietnamese Unicode', () => {
  assert.equal(normalizePhrase('  HỌC—SINH!!!  '), 'học sinh')
  assert.equal(normalizePhrase('học sinh'), 'học sinh')
  assert.equal(normalizePhrase('...'), '')
})

test('word chain validates first/last syllables and source membership', () => {
  const allowedPhrases = new Set(['học sinh', 'sinh học', 'học tập'])
  assert.deepEqual(validateAnswer({ answer: '  SINH học! ', lastPhrase: 'học sinh', allowedPhrases }), { phrase: 'sinh học', firstWord: 'sinh', finalWord: 'học' })
  assert.throws(() => validateAnswer({ answer: 'học tập', lastPhrase: 'học sinh', allowedPhrases }), (error) => error instanceof WordChainRuleError && error.code === 'word_chain_mismatch')
  assert.throws(() => validateAnswer({ answer: 'lịch sử', allowedPhrases }), (error) => error.code === 'phrase_not_in_source')
  assert.throws(() => validateAnswer({ answer: '!!!', allowedPhrases }), (error) => error.code === 'empty_answer')
  assert.throws(() => validateAnswer({ answer: 'sinh học', allowedPhrases, usedPhrases: ['Sinh—học'] }), (error) => error.code === 'duplicate_answer')
})

test('allocation preserves the requested total and assigns remainders to earlier teams', () => {
  assert.deepEqual(allocateTurns(3, 30), [10, 10, 10])
  assert.deepEqual(allocateTurns(2, 31), [16, 15])
  assert.deepEqual(allocateTurns(4, 10), [3, 3, 2, 2])
  assert.throws(() => allocateTurns(9, 30))
  assert.throws(() => allocateTurns(2, 201))
})

test('topic and strict pasted-text sources are bounded to their advertised phrase sets', () => {
  assert.ok(makePhraseSet({ sourceMode: 'topic', topic: 'trường học' }).phrases.includes('học sinh'))
  const strict = makePhraseSet({ sourceMode: 'text', text: 'học sinh học tập', validationMode: 'strict' })
  assert.ok(strict.phrases.includes('sinh học'))
  assert.ok(!strict.phrases.includes('trường học'))
  assert.throws(() => makePhraseSet({ sourceMode: 'text', text: '' }))
})


test('strict paragraph mode only allows adjacent two-syllable phrases; expanded mode stays inside source vocabulary', () => {
  const strict = makePhraseSet({ sourceMode: 'text', text: 'học sinh chăm chỉ', validationMode: 'strict' })
  assert.deepEqual(new Set(strict.phrases), new Set(['học sinh', 'sinh chăm', 'chăm chỉ']))
  const expanded = makePhraseSet({ sourceMode: 'text', text: 'học sinh', validationMode: 'expanded' })
  assert.ok(expanded.phrases.includes('học học'))
  assert.ok(expanded.phrases.includes('sinh học'))
  assert.ok(!expanded.phrases.includes('trường học'))
})

test('opening phrase is chosen from source and has at least one distinct valid continuation', () => {
  const phrases = ['học sinh', 'sinh học', 'học tập']
  const start = chooseStartingPhrase(phrases)
  assert.ok(phrases.includes(start))
  assert.ok(phrases.some((phrase) => phrase !== start && phrase.split(' ')[0] === start.split(' ').at(-1)))
  assert.throws(() => chooseStartingPhrase(['học sinh', 'chăm chỉ']), /nước nối hợp lệ/)
})
