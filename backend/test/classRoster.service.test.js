import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ||= 'https://test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.FRONTEND_ORIGIN ||= 'http://localhost:5173'
process.env.SECRET_CODE ||= 'test-secret'

const { foldName, namesEqual, placeholderMemberId } = await import('../src/services/classRoster.service.js')

test('roster name matching remains accent- and whitespace-insensitive', () => {
  assert.equal(foldName('  Nguyễn  Ánh  '), 'nguyen anh')
  assert.equal(namesEqual(' Nguyễn Ánh ', 'nguyen anh'), true)
  assert.equal(namesEqual('Nguyễn Ánh', 'Nguyễn Bình'), false)
  assert.equal(namesEqual('', '  '), false)
})

test('placeholder identifiers preserve the public roster prefix', () => {
  assert.equal(placeholderMemberId('abc-123'), 'roster:abc-123')
  assert.equal(placeholderMemberId('  abc-123  '), 'roster:abc-123')
})
