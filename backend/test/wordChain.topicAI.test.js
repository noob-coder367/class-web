import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeTopicWithAI } from '../src/services/game/wordChainTopicAI.js'
import { previewSource } from '../src/services/game/wordChain.service.js'
import { createApp } from '../src/app.js'

const fakeProvider = (output) => ({ generateQuestions: async () => output })

test('AI topic analysis parses JSON (even fenced) and normalizes suggestions', async () => {
  const ai = await analyzeTopicWithAI('đại dương', { provider: fakeProvider('```json\n{"keywords":["Biển","sóng"],"phrases":["Sóng biển","hải âu","một hai ba"]}\n```') })
  assert.deepEqual(ai.keywords, ['biển', 'sóng'])
  assert.deepEqual(ai.phrases, ['sóng biển', 'hải âu'])
})

test('AI failure or garbage never breaks the game: it falls back to the dictionary filter', async () => {
  assert.equal(await analyzeTopicWithAI('biển', { provider: { generateQuestions: async () => { throw new Error('down') } } }), null)
  assert.equal(await analyzeTopicWithAI('biển', { provider: fakeProvider('not json') }), null)
  const result = await previewSource({ source_mode: 'topic', topic: 'bóng đá', validation_mode: 'strict' }, { analyzeTopic: async () => null })
  assert.equal(result.ai_used, false)
  assert.ok(result.count > 5)
  assert.ok(result.phrases.includes(result.starting_phrase))
})

test('previewSource uses AI phrases but keeps only dictionary words and returns a meaningful opening pair', async () => {
  const result = await previewSource({ source_mode: 'topic', topic: 'đại dương', validation_mode: 'strict' }, { analyzeTopic: async () => ({ keywords: [], phrases: ['bãi biển', 'biển cả', 'xyz abc'] }) })
  assert.equal(result.ai_used, true)
  assert.ok(result.phrases.includes('bãi biển') && !result.phrases.includes('xyz abc'))
  assert.ok(result.starting_phrase.split(' ').length === 2)
})

test('previewSource rejects pasted text that has no real words to chain', async () => {
  await assert.rejects(() => previewSource({ source_mode: 'text', text: 'ksshdjs qwxz plmok', validation_mode: 'strict' }), /từ có nghĩa|ngắn/)
})

test('POST /api/word-chain/source is available without login (1-device mode) and validates input', async () => {
  const server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/word-chain/source`
    const bad = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source_mode: 'text', text: '' }) })
    assert.equal(bad.status, 400)
    const ok = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source_mode: 'text', text: 'học sinh sinh học học tập', validation_mode: 'strict' }) })
    assert.equal(ok.status, 200)
    const body = await ok.json()
    assert.ok(body.phrases.includes('sinh học'))
    assert.ok(body.starting_phrase)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
