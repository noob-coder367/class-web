import test from 'node:test'
import assert from 'node:assert/strict'
import { requireRoomIdentity } from '../src/middlewares/auth.middleware.js'

function responseMock() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('room identity middleware accepts a valid stable guest UUID without creating a profile', async () => {
  const req = {
    headers: {},
    get: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }
  const res = responseMock()
  let nextCalled = false
  await requireRoomIdentity(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
  assert.equal(req.user.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  assert.equal(req.user.is_anonymous, true)
  assert.equal(req.profile, null)
  assert.equal(req.isGuest, true)
  assert.equal(res.statusCode, null)
})

test('room identity middleware rejects malformed guest UUIDs', async () => {
  const req = { headers: {}, get: () => 'not-a-uuid' }
  const res = responseMock()
  let nextCalled = false
  await requireRoomIdentity(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.code, 'guest_identity_required')
})
