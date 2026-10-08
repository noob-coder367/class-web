import test from 'node:test'
import assert from 'node:assert/strict'
import { getAIProvider } from '../src/services/ai/aiProvider.js'
const args = { systemPrompt: 's', userPrompt: 'u', timeoutMs: 100 }
const okGemini = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"questions":[]}' }] } }] }) }
const okGroq = { ok: true, json: async () => ({ choices: [{ message: { content: '{"questions":[]}' } }] }) }
test('Gemini thành công không gọi Groq', async () => {
  const calls = []
  const provider = getAIProvider({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', fetchImpl: async (url) => { calls.push(url); return okGemini } })
  assert.equal(await provider.generateQuestions(args), '{"questions":[]}')
  assert.equal(calls.length, 1); assert.match(calls[0], /generativelanguage/); assert.equal(provider.name, 'gemini')
})
test('Gemini lỗi tạm thời fallback đúng một lần sang Groq', async () => {
  const calls = []
  const provider = getAIProvider({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', fetchImpl: async (url) => { calls.push(url); return url.includes('generativelanguage') ? { ok: false, status: 429 } : okGroq } })
  assert.equal(await provider.generateQuestions(args), '{"questions":[]}')
  assert.equal(calls.length, 2); assert.match(calls[0], /generativelanguage/); assert.match(calls[1], /api.groq.com/); assert.equal(provider.name, 'gemini -> groq')
})
test('Thiếu Gemini dùng Groq, thiếu cả hai báo lỗi cấu hình', () => {
  assert.equal(getAIProvider({ GROQ_API_KEY: 'q' }).name, 'groq')
  assert.throws(() => getAIProvider({}), (error) => error.code === 'ai_not_configured')
})
