import test from 'node:test'
import assert from 'node:assert/strict'

const { toPublicQuestion } = await import('../src/services/game/gameRoom.service.js')

test('game public question không lộ đáp án đúng hoặc reference answer', () => {
  const publicQuestion = toPublicQuestion({
    id: 'q1',
    order_index: 0,
    type: 'multiple_choice',
    content: '2 + 2 = ?',
    options: ['3', '4'],
    correct_option: 1,
    correct_boolean: null,
    reference_answer: '4',
    explanation: 'Phép cộng cơ bản.',
  })
  assert.deepEqual(publicQuestion, {
    id: 'q1',
    order_index: 0,
    type: 'multiple_choice',
    content: '2 + 2 = ?',
    options: ['3', '4'],
    explanation: 'Phép cộng cơ bản.',
  })
  assert.equal('correct_option' in publicQuestion, false)
  assert.equal('correct_boolean' in publicQuestion, false)
  assert.equal('reference_answer' in publicQuestion, false)
})
