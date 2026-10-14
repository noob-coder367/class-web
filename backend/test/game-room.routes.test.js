import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'

const server = createApp().listen(0)
const baseUrl = await new Promise((resolve) => server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)))
test.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))

test('public open-room endpoint does not require auth and validates game mode', async () => {
  const response = await fetch(`${baseUrl}/api/game-rooms/open?game_mode=not-a-game`)
  assert.equal(response.status, 400)
  const body = await response.json()
  assert.equal(body.code, 'invalid_game_mode')
})

test('game room mutations reject missing guest identity', async () => {
  const response = await fetch(`${baseUrl}/api/game-rooms/ABC123/leave`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ close: true }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'guest_identity_required')
})
