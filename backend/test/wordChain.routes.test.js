import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'

const server = createApp().listen(0)
const baseUrl = await new Promise((resolve) => server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)))
test.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))

test('Word Chain create/join/state endpoints require authenticated Supabase session', async () => {
  const cases = [
    ['POST', '/api/word-chain/rooms'],
    ['GET', '/api/word-chain/rooms/ABC123'],
    ['POST', '/api/word-chain/rooms/ABC123/join'],
    ['POST', '/api/word-chain/rooms/ABC123/start'],
    ['POST', '/api/word-chain/rooms/ABC123/answer'],
    ['POST', '/api/word-chain/rooms/ABC123/skip'],
  ]
  for (const [method, path] of cases) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'content-type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) })
    assert.equal(response.status, 401, `${method} ${path} must require auth`)
  }
})
