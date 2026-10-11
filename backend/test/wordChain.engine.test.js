import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateTurns, chooseStartingPhrase, isDictionaryPhrase, makePhraseSet, normalizePhrase, validateAnswer, WordChainRuleError } from '../src/services/game/wordChain.engine.js'

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


test('strict paragraph mode only keeps adjacent pairs that are real dictionary words; expanded mode stays inside source vocabulary', () => {
  const strict = makePhraseSet({ sourceMode: 'text', text: 'học sinh sinh học học tập sinh chăm', validationMode: 'strict' })
  assert.deepEqual(new Set(strict.phrases), new Set(['học sinh', 'sinh học', 'học tập']))
  assert.ok(!strict.phrases.includes('sinh chăm'), 'non-word pairs from the text must be dropped')
  const expanded = makePhraseSet({ sourceMode: 'text', text: 'học sinh tập thể', validationMode: 'expanded' })
  assert.ok(expanded.phrases.includes('sinh học'))
  assert.ok(expanded.phrases.includes('học tập'))
  assert.ok(!expanded.phrases.includes('học học'), 'expanded mode must not invent non-words')
  assert.ok(!expanded.phrases.includes('trường học'))
})

test('free mode accepts any real dictionary word but rejects gibberish', () => {
  const free = { allowedPhrases: new Set(), validationMode: 'free' }
  assert.equal(validateAnswer({ answer: 'lịch sử', ...free }).phrase, 'lịch sử')
  assert.throws(() => validateAnswer({ answer: 'ksshdjs', ...free }), (error) => error.code === 'not_in_dictionary')
  assert.throws(() => validateAnswer({ answer: 'sinh ksshdjs', lastPhrase: 'học sinh', ...free }), (error) => error.code === 'not_in_dictionary')
  assert.throws(() => validateAnswer({ answer: 'học', ...free }), (error) => error.code === 'not_in_dictionary')
})

test('free mode source falls back to the Vietnamese dictionary and always has a meaningful opening chain', () => {
  const free = makePhraseSet({ sourceMode: 'topic', topic: '', validationMode: 'free' })
  assert.equal(free.fromDictionary, true)
  const start = chooseStartingPhrase(free.phrases)
  assert.ok(isDictionaryPhrase(start))
})

test('topic mode merges AI suggestions with the dictionary and drops anything that is not a real word', () => {
  const ai = { keywords: ['biển'], phrases: ['bãi biển', 'sóng biển', 'ksshdjs ab', 'hải âu'] }
  const { phrases } = makePhraseSet({ sourceMode: 'topic', topic: 'đại dương', validationMode: 'strict', aiTopic: ai })
  assert.ok(phrases.includes('bãi biển'))
  assert.ok(phrases.includes('hải âu'))
  assert.ok(!phrases.includes('sóng biển'), 'a phrase the dictionary does not know is dropped even if AI suggested it')
  assert.ok(!phrases.includes('ksshdjs ab'))
  assert.ok(phrases.every((phrase) => isDictionaryPhrase(phrase)))
  assert.ok(phrases.length <= 8000)
})

test('free-form topic works without AI by filtering the dictionary on the topic syllables', () => {
  const { phrases } = makePhraseSet({ sourceMode: 'topic', topic: 'bóng đá', validationMode: 'strict', aiTopic: null })
  assert.ok(phrases.length > 5)
  assert.ok(phrases.every((phrase) => phrase.split(' ').some((syllable) => ['bóng', 'đá'].includes(syllable))))
})

test('opening phrase is chosen from source and has at least one distinct valid continuation', () => {
  const phrases = ['học sinh', 'sinh học', 'học tập']
  const start = chooseStartingPhrase(phrases)
  assert.ok(phrases.includes(start))
  assert.ok(phrases.some((phrase) => phrase !== start && phrase.split(' ')[0] === start.split(' ').at(-1)))
  assert.throws(() => chooseStartingPhrase(['học sinh', 'chăm chỉ']), /nước nối hợp lệ/)
  assert.throws(() => chooseStartingPhrase(['ksshdjs abc', 'abc xyz']), /nước nối hợp lệ/, 'a non-word opening is never chosen')
})
