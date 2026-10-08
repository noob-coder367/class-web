import test from 'node:test'
import assert from 'node:assert/strict'
import { extractTextFromImage } from '../src/services/files/ocrImage.js'
const response = (payload, ok = true) => ({ ok, json: async () => payload })
test('OCR image map ParsedResults thành text', async () => {
  const result = await extractTextFromImage({ buffer: Buffer.from('image'), filename: 'photo.jpg', contentType: 'image/jpeg', apiKey: 'test', fetchImpl: async (_url, init) => { assert.equal(init.method, 'POST'); return response({ ParsedResults: [{ ParsedText: 'Câu hỏi mẫu' }], IsErroredOnProcessing: false }) } })
  assert.equal(result.text, 'Câu hỏi mẫu'); assert.equal(result.provider, 'ocr.space')
})
test('OCR image báo rõ khi không đọc được', async () => {
  await assert.rejects(extractTextFromImage({ buffer: Buffer.from('image'), filename: 'photo.jpg', contentType: 'image/jpeg', apiKey: 'test', fetchImpl: async () => response({ ParsedResults: [], IsErroredOnProcessing: true }) }), (error) => error.code === 'ocr_empty' && error.statusCode === 422)
})
