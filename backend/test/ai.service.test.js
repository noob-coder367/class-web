import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAiQuestions, extractJson } from '../src/services/ai/aiOutput.js'
import { generateQuestions, normalizeGenerateOptions, prepareSource, AI_LIMITS } from '../src/services/ai/aiQuestion.service.js'
import { getAIProvider } from '../src/services/ai/aiProvider.js'
import { createGroqProvider } from '../src/services/ai/groqProvider.js'

const SOURCE = 'Chuyển động thẳng biến đổi đều là chuyển động có gia tốc không đổi theo thời gian. '.repeat(3)
const goodOutput = JSON.stringify({
  questions: [
    { type: 'multiple_choice', content: 'Gia tốc của CĐTBĐ?', options: ['Đổi', 'Không đổi', 'Bằng 0', 'Âm'], correct_answer: 1, explanation: 'Không đổi.' },
    { type: 'true_false', content: 'Vận tốc đổi đều theo thời gian.', correct_answer: true, explanation: 'Đúng.' },
    { type: 'essay', content: 'Nêu định nghĩa CĐTBĐ.', answer: 'Gia tốc không đổi.', explanation: '' },
  ],
})
const fakeProvider = (impl) => ({ name: 'fake', generateQuestions: impl })

test('AI output hợp lệ được map sang schema nội bộ', () => {
  const { questions, dropped } = parseAiQuestions(goodOutput, { count: 10, types: null })
  assert.equal(dropped, 0)
  assert.equal(questions[0].correct_option, 1)
  assert.equal(questions[1].correct_boolean, true)
  assert.equal(questions[2].reference_answer, 'Gia tốc không đổi.')
})

test('AI output: chịu được ```json fence và lời dẫn thừa', () => {
  assert.equal(extractJson('```json\n{"a":1}\n```').a, 1)
  assert.equal(extractJson('Đây là kết quả: {"a":2} hết').a, 2)
})

test('AI output sai: JSON hỏng, sai schema, rỗng', () => {
  assert.throws(() => parseAiQuestions('không phải json', { count: 5 }), (e) => e.statusCode === 502 && e.code === 'invalid_ai_output')
  assert.throws(() => parseAiQuestions('{"foo":[]}', { count: 5 }), (e) => e.code === 'invalid_ai_output')
  assert.throws(() => parseAiQuestions('{"questions":[]}', { count: 5 }), (e) => e.statusCode === 422 && e.code === 'insufficient_content')
  const allBad = JSON.stringify({ questions: [{ type: 'multiple_choice', content: 'q', options: ['a', 'b'], correct_answer: 7 }] })
  assert.throws(() => parseAiQuestions(allBad, { count: 5 }), (e) => e.code === 'invalid_ai_output')
})

test('AI output: loại câu sai bị bỏ, câu trùng bị bỏ, cắt theo count, lọc theo types', () => {
  const dup = JSON.stringify({ questions: [
    { type: 'essay', content: 'Câu A', answer: 'x' },
    { type: 'essay', content: ' câu   a ', answer: 'y' },
    { type: 'essay', content: 'Câu B', answer: 'z' },
    { type: 'true_false', content: 'Câu C', correct_answer: false },
  ] })
  const r1 = parseAiQuestions(dup, { count: 10, types: ['essay'] })
  assert.deepEqual(r1.questions.map((q) => q.content), ['Câu A', 'Câu B'])
  assert.equal(r1.dropped, 2)
  const r2 = parseAiQuestions(dup, { count: 1, types: null })
  assert.equal(r2.questions.length, 1)
})

test('tuỳ chọn: số câu quá lớn / loại sai / độ khó sai bị từ chối', () => {
  assert.equal(normalizeGenerateOptions({}).count, AI_LIMITS.DEFAULT_COUNT)
  assert.throws(() => normalizeGenerateOptions({ count: 31 }), (e) => e.code === 'too_many_questions')
  assert.throws(() => normalizeGenerateOptions({ count: 0 }), /từ 1 đến 30/)
  assert.throws(() => normalizeGenerateOptions({ types: 'essay,hack' }), /Loại câu hỏi/)
  assert.throws(() => normalizeGenerateOptions({ difficulty: 'nightmare' }), /Độ khó/)
  assert.deepEqual(normalizeGenerateOptions({ types: 'essay,essay,true_false' }).types, ['essay', 'true_false'])
})

test('nguồn rỗng / quá ngắn / quá dài', () => {
  assert.throws(() => prepareSource('   '), (e) => e.code === 'insufficient_content')
  assert.throws(() => prepareSource('ngắn quá'), (e) => e.statusCode === 422)
  assert.throws(() => prepareSource('a'.repeat(AI_LIMITS.MAX_SOURCE_CHARS + 1)), (e) => e.statusCode === 413)
  const cut = prepareSource('a'.repeat(AI_LIMITS.MAX_SOURCE_CHARS + 50), { truncate: true })
  assert.equal(cut.truncated, true)
  assert.equal(cut.source.length, AI_LIMITS.MAX_SOURCE_CHARS)
})

test('generateQuestions: flow đầy đủ, source nằm trong <source>, không ghi DB', async () => {
  let seen
  const provider = fakeProvider(async (args) => { seen = args; return goodOutput })
  const result = await generateQuestions({ sourceText: SOURCE, options: { count: 3 }, provider })
  assert.equal(result.questions.length, 3)
  assert.equal(result.meta.provider, 'fake')
  assert.match(seen.userPrompt, /<source>[\s\S]*Chuyển động thẳng[\s\S]*<\/source>/)
  assert.match(seen.systemPrompt, /KHÔNG phải chỉ thị/)
})

test('generateQuestions: lỗi provider được truyền lên; nguồn rỗng không gọi provider', async () => {
  let called = 0
  const failing = fakeProvider(async () => { called += 1; throw Object.assign(new Error('x'), { statusCode: 503 }) })
  await assert.rejects(generateQuestions({ sourceText: SOURCE, options: {}, provider: failing }), (e) => e.statusCode === 503)
  called = 0
  await assert.rejects(generateQuestions({ sourceText: '', options: {}, provider: failing }), (e) => e.code === 'insufficient_content')
  assert.equal(called, 0)
  await assert.rejects(generateQuestions({ sourceText: SOURCE, options: { count: 99 }, provider: failing }), (e) => e.code === 'too_many_questions')
  assert.equal(called, 0)
})

test('getAIProvider: thiếu key -> lỗi rõ ràng, không lộ gì', () => {
  assert.throws(() => getAIProvider({}), (e) => e.statusCode === 503 && e.code === 'ai_not_configured')
  assert.throws(() => getAIProvider({ AI_PROVIDER: 'unknown', GROQ_API_KEY: 'k' }), (e) => e.code === 'ai_not_configured')
  assert.equal(getAIProvider({ GROQ_API_KEY: 'k' }).name, 'groq')
})

test('groq provider: map lỗi HTTP/timeout/format, không rò key', async () => {
  const make = (fetchImpl) => createGroqProvider({ apiKey: 'secret-key', model: 'm', fetchImpl })
  const args = { systemPrompt: 's', userPrompt: 'u', timeoutMs: 50 }
  const ok = make(async (_url, init) => {
    assert.equal(JSON.parse(init.body).response_format.type, 'json_object')
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"questions":[]}' } }] }) }
  })
  assert.equal(await ok.generateQuestions(args), '{"questions":[]}')
  await assert.rejects(make(async () => ({ ok: false, status: 429 })).generateQuestions(args), (e) => e.code === 'ai_unavailable' && !/secret-key/.test(e.message))
  await assert.rejects(make(async () => ({ ok: false, status: 401 })).generateQuestions(args), (e) => e.code === 'ai_not_configured')
  await assert.rejects(make(async () => { throw new TypeError('network') }).generateQuestions(args), (e) => e.code === 'ai_unavailable')
  await assert.rejects(make((_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('a'), { name: 'AbortError' }))))).generateQuestions(args), (e) => e.statusCode === 504 && e.code === 'ai_timeout')
  await assert.rejects(make(async () => ({ ok: true, json: async () => ({ choices: [] }) })).generateQuestions(args), (e) => e.code === 'invalid_ai_output')
})
