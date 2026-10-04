import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ||= 'https://test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.FRONTEND_ORIGIN ||= 'http://localhost:5173'
process.env.SECRET_CODE ||= 'test-secret'

const { getApplicationRange, normalizeTimetable, diffTimetable } = await import('../src/services/timetable.service.js')

test('normalizeTimetable keeps the public DTO shape and defaults', () => {
  const timetable = normalizeTimetable({ className: '  10A4  ', subjects: ['Toán', 'Toán', ''] })
  assert.equal(timetable.className, '10A4')
  assert.deepEqual(timetable.subjects, ['Toán'])
  assert.equal(timetable.days.length, 6)
  assert.equal(timetable.morning.periods.length, 5)
  assert.equal(timetable.afternoon.periods.length, 4)
  assert.equal(timetable.changeNotice, null)
})

test('diffTimetable reports grid changes with the existing Vietnamese labels', () => {
  const previous = normalizeTimetable({})
  const next = normalizeTimetable({})
  previous.morning.grid.t2[0] = ''
  next.morning.grid.t2[0] = 'Toán'
  assert.deepEqual(diffTimetable(previous, next), ['Buổi sáng · Thứ 2 · Tiết 1: (trống) → Toán'])
})

test('getApplicationRange resets Sunday to the following Monday', () => {
  const { from, to } = getApplicationRange(new Date(2026, 9, 4, 12, 30, 0))
  assert.equal(from.getDay(), 1)
  assert.equal(from.getDate(), 5)
  assert.equal(to.getDay(), 6)
  assert.equal(to.getDate(), 10)
})
