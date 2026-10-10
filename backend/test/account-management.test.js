import test from 'node:test'
import assert from 'node:assert/strict'
import { toPublicProfile, ghostEmailFor, registerUser, safeSupabaseErrorDetails } from '../src/services/auth.service.js'
import { requireAdmin } from '../src/middlewares/admin.middleware.js'

test('ghost email numbering remains deterministic and separate from normal accounts', () => {
  assert.equal(ghostEmailFor(7), 'taikhoanma-7@ghost.com')
})

test('Supabase error logging giữ metadata an toàn nhưng không làm lộ message', () => {
  assert.deepEqual(
    safeSupabaseErrorDetails({ code: 'email_exists', status: 422, name: 'FetchError', cause: { code: 'ECONNRESET' }, message: 'secret@example.com already registered' }),
    { code: 'email_exists', status: 422, name: 'FetchError', causeCode: 'ECONNRESET' },
  )
  assert.deepEqual(safeSupabaseErrorDetails(null), { code: 'unknown', status: null, name: null, causeCode: null })
})

test('new Google profile is marked as requiring display name', () => {
  const profile = toPublicProfile(
    { id: 'google-user', email: 'google@example.test', role: 'user', full_name: null },
    { email: 'google@example.test', identities: [{ provider: 'google' }] },
  )
  assert.equal(profile.needs_display_name, true)
  assert.equal(profile.is_ghost, undefined)
})

test('normal email profile keeps the stable public profile contract', () => {
  const profile = toPublicProfile(
    { id: 'email-user', email: 'email@example.test', role: 'user', full_name: 'Quizly User' },
    { email: 'email@example.test', identities: [{ provider: 'email' }] },
  )
  assert.equal(profile.display_name, 'Quizly User')
  assert.equal('needs_display_name' in profile, false)
  assert.equal('is_ghost' in profile, false)
})

test('ghost registration requires server-side secret before reserving a slot', async () => {
  await assert.rejects(
    registerUser({ ghost: true, secretCode: '' }),
    (error) => error?.statusCode === 400 && /mã thành viên/i.test(error.message),
  )
})

test('admin middleware is a server-side role boundary', () => {
  let nextError
  requireAdmin({ profile: { role: 'user' } }, {}, (error) => { nextError = error })
  assert.equal(nextError?.statusCode, 403)
  let passed = false
  requireAdmin({ profile: { role: 'admin' } }, {}, (error) => { passed = !error })
  assert.equal(passed, true)
})
