import test from 'node:test'
import assert from 'node:assert/strict'
import { getAIProvider } from '../src/services/ai/aiProvider.js'
import { listGeminiModels } from '../src/services/ai/geminiProvider.js'
const args = { systemPrompt: 's', userPrompt: 'u', timeoutMs: 100 }
const okGemini = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"questions":[]}' }] } }] }) }
const okGroq = { ok: true, json: async () => ({ choices: [{ message: { content: '{"questions":[]}' } }] }) }
test('Gemini thành công không gọi Groq', async () => {
  const calls = []
  const provider = getAIProvider({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', fetchImpl: async (url, init) => { calls.push({ url, init }); return okGemini } })
  assert.equal(await provider.generateQuestions(args), '{"questions":[]}')
  assert.equal(calls.length, 1); assert.match(calls[0].url, /generativelanguage/); assert.match(calls[0].url, /gemini-3\.8-flash/); assert.equal(provider.name, 'gemini')
  const generationConfig = JSON.parse(calls[0].init.body).generationConfig
  assert.deepEqual(generationConfig, { responseMimeType: 'application/json' })
  assert.equal('temperature' in generationConfig, false)
  assert.equal('topP' in generationConfig, false)
  assert.equal('topK' in generationConfig, false)
  assert.equal('candidateCount' in generationConfig, false)
})
test('Gemini lỗi tạm thời fallback đúng một lần sang Groq', async () => {
  const calls = []
  const provider = getAIProvider({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', fetchImpl: async (url) => { calls.push(url); return url.includes('generativelanguage') ? { ok: false, status: 429 } : okGroq } })
  assert.equal(await provider.generateQuestions(args), '{"questions":[]}')
  assert.equal(calls.length, 2); assert.match(calls[0], /generativelanguage/); assert.match(calls[1], /api.groq.com/); assert.equal(provider.name, 'gemini -> groq')
})
test('Gemini model không tồn tại: đọc lỗi, kiểm tra models.list và không log secret/prompt', async () => {
  const logs = []
  const calls = []
  const originalError = console.error
  console.error = (...args) => logs.push(args)
  try {
    const provider = getAIProvider({
      GEMINI_API_KEY: 'secret-key',
      GEMINI_MODEL: 'missing-model',
      fetchImpl: async (url) => {
        calls.push(url)
        if (url.includes(':generateContent')) {
          return { ok: false, status: 404, json: async () => ({ error: { message: 'Model missing-model not found', status: 'NOT_FOUND' } }) }
        }
        return { ok: true, json: async () => ({ models: [
          { name: 'models/gemini-available', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-only', supportedGenerationMethods: ['embedContent'] },
        ] }) }
      },
    })
    await assert.rejects(provider.generateQuestions({ ...args, userPrompt: 'do-not-log-this-prompt' }), (error) => error.code === 'ai_model_not_found' && error.statusCode === 503)
    assert.equal(calls.length, 2)
    const output = JSON.stringify(logs)
    assert.match(output, /missing-model/)
    assert.match(output, /Model missing-model not found/)
    assert.match(output, /NOT_FOUND/)
    assert.match(output, /gemini-available/)
    assert.doesNotMatch(output, /secret-key|do-not-log-this-prompt/)
  } finally {
    console.error = originalError
  }
})
test('models.list chỉ trả model có generateContent', async () => {
  const models = await listGeminiModels({
    apiKey: 'secret-key',
    fetchImpl: async () => ({ ok: true, json: async () => ({ models: [
      { name: 'models/gemini-available', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embedding-only', supportedGenerationMethods: ['embedContent'] },
    ] }) }),
  })
  assert.deepEqual(models, ['gemini-available'])
})
test('Thiếu Gemini dùng Groq, thiếu cả hai báo lỗi cấu hình', () => {
  assert.equal(getAIProvider({ GROQ_API_KEY: 'q' }).name, 'groq')
  assert.throws(() => getAIProvider({}), (error) => error.code === 'ai_not_configured')
})
