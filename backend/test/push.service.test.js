import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ||= 'https://test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.FRONTEND_ORIGIN ||= 'http://localhost:5173'
process.env.SECRET_CODE ||= 'test-secret'
process.env.API_PUBLIC_URL = ''
process.env.RENDER_EXTERNAL_URL = ''

const pushService = await import('../src/services/push.service.js')

test('push service preserves request-derived receipt URL behavior', () => {
  assert.equal(
    pushService.receiptUrlFromRequest({
      protocol: 'http',
      headers: { host: 'localhost:4000' },
    }),
    'http://localhost:4000/api/push/receipt'
  )
})

test('push service rejects malformed subscriptions before persistence', async () => {
  await assert.rejects(
    pushService.saveSubscription('user-1', { endpoint: 'https://push.example' }),
    (error) => error?.message === 'Subscription không hợp lệ.'
  )
})

test('push service keeps the configured VAPID public-key DTO', () => {
  assert.equal(pushService.getPublicVapidKey(), process.env.VAPID_PUBLIC_KEY || '')
})
