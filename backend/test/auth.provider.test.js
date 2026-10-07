import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeJwtClaims, isGoogleSession, describeSessionProvider } from '../src/lib/authProvider.js'

const jwt = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`
const user = (...providers) => ({ identities: providers.map((provider) => ({ provider })) })

test('Google OAuth session được chấp nhận', () => {
  const claims = decodeJwtClaims(jwt({ amr: [{ method: 'oauth', timestamp: 1 }] }))
  assert.equal(isGoogleSession(user('google'), claims), true)
  assert.equal(describeSessionProvider(user('google'), claims), 'google')
})

test('email/password bị từ chối, kể cả khi user_metadata/app_metadata giả mạo "google"', () => {
  const claims = decodeJwtClaims(jwt({ amr: [{ method: 'password', timestamp: 1 }], user_metadata: { provider: 'google' } }))
  const fake = { ...user('email'), user_metadata: { provider: 'google' }, app_metadata: { provider: 'google' }, email: 'a@gmail.com' }
  assert.equal(isGoogleSession(fake, claims), false)
  assert.equal(describeSessionProvider(fake, claims), 'email')
})

test('tài khoản có link Google nhưng đăng nhập bằng mật khẩu thì KHÔNG phải phiên Google', () => {
  const claims = decodeJwtClaims(jwt({ amr: [{ method: 'password' }] }))
  assert.equal(isGoogleSession(user('email', 'google'), claims), false)
  const viaGoogle = decodeJwtClaims(jwt({ amr: [{ method: 'password' }, { method: 'oauth' }] }))
  assert.equal(isGoogleSession(user('email', 'google'), viaGoogle), true)
})

test('thiếu amr: chỉ chấp nhận khi không có identity email; token rác/không có user bị từ chối', () => {
  assert.equal(isGoogleSession(user('google'), {}), true)
  assert.equal(isGoogleSession(user('google', 'email'), {}), false)
  assert.equal(isGoogleSession(user('github'), { amr: [{ method: 'oauth' }] }), false)
  assert.equal(isGoogleSession(null, null), false)
  assert.equal(decodeJwtClaims('garbage'), null)
  assert.equal(decodeJwtClaims(undefined), null)
})
