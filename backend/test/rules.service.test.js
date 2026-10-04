import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ||= 'https://test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.FRONTEND_ORIGIN ||= 'http://localhost:5173'
process.env.SECRET_CODE ||= 'test-secret'

const { buildLeaderboard, inferPoints, normalizeRules } = await import('../src/services/rules.service.js')

test('Rules normalization preserves public shape and clamps settings', () => {
  const rules = normalizeRules({
    title: '  Nội quy  ',
    startingPoints: 999,
    sections: [{ id: 'Kỷ luật', title: '  Kỷ luật ', items: ['Nhắc nhở'] }],
    notice: { title: '', body: '  Lưu ý  ' },
  })
  assert.equal(rules.title, 'Nội quy')
  assert.equal(rules.startingPoints, 200)
  assert.equal(rules.sections[0].id, 'ky-luat')
  assert.deepEqual(rules.sections[0].items, [{ text: 'Nhắc nhở', points: 3 }])
  assert.equal(rules.notice.body, 'Lưu ý')
})

test('point inference keeps the existing Vietnamese offense rules', () => {
  assert.equal(inferPoints('đánh dấu 1 lần'), 5)
  assert.equal(inferPoints('đánh dấu 2 lần'), 10)
  assert.equal(inferPoints('đánh dấu 3 lần'), 15)
  assert.equal(inferPoints('bị nhắc nhở'), 3)
  assert.equal(inferPoints('vi phạm khác'), 5)
})

test('leaderboard preserves score, tie-break, and dense ranking behavior', () => {
  const result = buildLeaderboard([
    { id: 'u2', username: 'Bình', role: 'user', is_placeholder: false },
    { id: 'u1', username: 'An', role: 'user', is_placeholder: false },
    { id: 'roster:r1', username: 'Chi', role: 'user', is_placeholder: true, roster_id: 'r1' },
  ], [
    { id: 'v1', name: 'Bình', userId: 'u2', offense: 'Lỗi', points: 5 },
    { id: 'v2', name: 'Chi', rosterId: 'r1', offense: 'Lỗi', points: 5 },
  ], { startingPoints: 100, sections: [] })
  assert.deepEqual(result.rows.map((row) => [row.id, row.score, row.rank]), [
    ['u1', 100, 1],
    ['u2', 95, 2],
    ['roster:r1', 95, 2],
  ])
  assert.equal(result.total, 3)
})
