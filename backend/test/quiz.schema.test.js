import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQuestion, normalizeQuizPayload, LIMITS } from '../src/services/quiz/questionSchema.js'

const mc = (over = {}) => ({ type: 'multiple_choice', content: '  2 + 2 = ?  ', options: ['3', '4', '5', '6'], correct_option: 1, ...over })

test('multiple_choice: hợp lệ được chuẩn hóa và bỏ field thừa', () => {
  const q = normalizeQuestion({ ...mc(), hacked: true, correct_boolean: true }, 0)
  assert.equal(q.content, '2 + 2 = ?')
  assert.deepEqual(q.options, ['3', '4', '5', '6'])
  assert.equal(q.correct_option, 1)
  assert.equal(q.correct_boolean, null)
  assert.equal('hacked' in q, false)
})

test('multiple_choice: từ chối thiếu đáp án đúng, đáp án trống/trùng, sai số lượng', () => {
  assert.throws(() => normalizeQuestion(mc({ correct_option: null })), /đáp án đúng/)
  assert.throws(() => normalizeQuestion(mc({ correct_option: 9 })), /đáp án đúng/)
  assert.throws(() => normalizeQuestion(mc({ options: ['a', '', 'c', 'd'] })), /không được để trống/)
  assert.throws(() => normalizeQuestion(mc({ options: ['a', 'A', 'c', 'd'] })), /trùng/)
  assert.throws(() => normalizeQuestion(mc({ options: ['only'] })), /từ 2 đến 8/)
  assert.throws(() => normalizeQuestion(mc({ options: Array.from({ length: 9 }, (_, i) => `o${i}`) })), /từ 2 đến 8/)
})

test('true_false: bắt buộc boolean thật sự', () => {
  assert.equal(normalizeQuestion({ type: 'true_false', content: 'Trái đất tròn', correct_boolean: false }).correct_boolean, false)
  assert.throws(() => normalizeQuestion({ type: 'true_false', content: 'x', correct_boolean: 'true' }), /Đúng hoặc Sai/)
  assert.throws(() => normalizeQuestion({ type: 'true_false', content: 'x' }), /Đúng hoặc Sai/)
})

test('essay: đáp án tham khảo là tuỳ chọn', () => {
  const q = normalizeQuestion({ type: 'essay', content: 'Giải thích?', reference_answer: '   ' })
  assert.equal(q.reference_answer, null)
  assert.equal(normalizeQuestion({ type: 'essay', content: 'Giải thích?', reference_answer: 'Vì...' }).reference_answer, 'Vì...')
})

test('loại lạ / nội dung trống / quá dài bị từ chối', () => {
  assert.throws(() => normalizeQuestion({ type: 'matching', content: 'x' }), /loại câu hỏi/)
  assert.throws(() => normalizeQuestion({ type: 'essay', content: '   ' }), /không được để trống/)
  assert.throws(() => normalizeQuestion({ type: 'essay', content: 'x'.repeat(LIMITS.CONTENT_MAX + 1) }), /tối đa/)
  assert.throws(() => normalizeQuestion(null), /không hợp lệ/)
})

test('quiz payload: tiêu đề, số câu, thứ tự được giữ nguyên', () => {
  const payload = normalizeQuizPayload({
    title: '  Vật lý 10 ',
    description: '',
    questions: [mc({ content: 'B' }), { type: 'essay', content: 'A' }],
  })
  assert.equal(payload.title, 'Vật lý 10')
  assert.equal(payload.description, null)
  assert.deepEqual(payload.questions.map((q) => q.content), ['B', 'A'])
  assert.throws(() => normalizeQuizPayload({ title: '', questions: [mc()] }), /Tên phòng/)
  assert.throws(() => normalizeQuizPayload({ title: 'x', questions: [] }), /ít nhất 1/)
  assert.throws(() => normalizeQuizPayload({ title: 'x', questions: Array.from({ length: 101 }, () => mc()) }), /tối đa 100/)
  assert.throws(() => normalizeQuizPayload({ title: 'x', questions: [mc(), { type: 'true_false', content: 'q' }] }), /Câu 2/)
})
