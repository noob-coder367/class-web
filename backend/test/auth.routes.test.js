import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { isAdminRole } from '../src/lib/roles.js'
import { toPublicProfile } from '../src/services/auth.service.js'

const server = createApp().listen(0)
const baseUrl = await new Promise((resolve) => {
  server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}`))
})
test.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  return { response, body: await response.json() }
}

test('health route is available', async () => {
  const { response, body } = await jsonRequest('/api/health')
  assert.equal(response.status, 200)
  assert.deepEqual(body, { status: 'ok' })
})

test('profile endpoint rejects requests without a Supabase session', async () => {
  const { response } = await jsonRequest('/api/auth/me')
  assert.equal(response.status, 401)
})

test('login contract requires email and does not accept username-only payloads', async () => {
  const { response, body } = await jsonRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'legacy-user', password: 'correct-horse' }),
  })
  assert.equal(response.status, 400)
  assert.match(body.message, /email/)
})

test('registration validates email/password input before calling Supabase', async () => {
  const { response, body } = await jsonRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ displayName: 'Quizly User', email: 'not-an-email', password: 'correct-horse' }),
  })
  assert.equal(response.status, 400)
  assert.match(body.message, /email/i)
})

test('class-management API routes are no longer mounted', async () => {
  const { response } = await jsonRequest('/api/classroom')
  assert.equal(response.status, 404)
})

test('AI API routes are no longer mounted', async () => {
  const { response } = await jsonRequest('/api/ai')
  assert.equal(response.status, 404)
})

test('admin role remains recognized and public profiles do not expose legacy username fields', () => {
  assert.equal(isAdminRole('ADMIN'), true)
  assert.equal(isAdminRole('user'), false)
  const profile = toPublicProfile(
    { id: 'user-id', email: 'admin@example.test', username: 'legacy-class-name', role: 'admin' },
    { email: 'admin@example.test', user_metadata: { display_name: 'Quizly Admin' } },
  )
  assert.deepEqual(profile, {
    id: 'user-id',
    display_name: 'Quizly Admin',
    email: 'admin@example.test',
    role: 'admin',
    created_at: undefined,
  })
  assert.equal('username' in profile, false)
  assert.equal('is_member' in profile, false)
})
