import test from 'node:test'
import assert from 'node:assert/strict'
import {
  changeQuestionType, createQuestion, describeTypeChange, hasErrors, questionFromApi, toPayload, toPayloadQuestion, validateDraft, validateQuestion,
} from '../src/lib/questionModel.js'
import { initialDraft, questionListReducer, quizDraftReducer } from '../src/lib/quizDraftReducer.js'

const filledMc = () => createQuestion('multiple_choice', { content: 'Q', options: ['a', 'b', 'c', 'd'], correct_option: 2 })

test('mặc định: trắc nghiệm có 4 đáp án trống, chưa chọn đáp án đúng', () => {
  const q = createQuestion('multiple_choice')
  assert.equal(q.options.length, 4)
  assert.equal(q.correct_option, null)
  assert.equal(validateQuestion({ ...q, content: 'x' }), 'Đáp án A đang trống.')
})

test('validate từng loại', () => {
  assert.equal(validateQuestion(filledMc()), null)
  assert.match(validateQuestion({ ...filledMc(), correct_option: null }), /đáp án đúng/)
  assert.match(validateQuestion({ ...filledMc(), options: ['a', 'A', 'c', 'd'] }), /trùng/)
  assert.match(validateQuestion(createQuestion('true_false', { content: 'x' })), /Đúng hoặc Sai/)
  assert.equal(validateQuestion(createQuestion('true_false', { content: 'x', correct_boolean: false })), null)
  assert.equal(validateQuestion(createQuestion('essay', { content: 'x' })), null)
  assert.match(validateQuestion(createQuestion('essay', { content: '  ' })), /nội dung/)
})

test('đổi loại: cảnh báo khi có dữ liệu, giữ dữ liệu để đổi lại khôi phục, payload đúng cấu trúc', () => {
  const mc = filledMc()
  assert.match(describeTypeChange(mc, 'true_false'), /sẽ không được dùng/)
  assert.equal(describeTypeChange(createQuestion('multiple_choice'), 'essay'), null)
  assert.equal(describeTypeChange(mc, 'multiple_choice'), null)
  const tf = changeQuestionType(mc, 'true_false')
  assert.deepEqual(toPayloadQuestion(tf), { type: 'true_false', content: 'Q', explanation: '', correct_boolean: null })
  const back = changeQuestionType(tf, 'multiple_choice')
  assert.deepEqual(back.options, ['a', 'b', 'c', 'd'])
  assert.equal(back.correct_option, 2)
  assert.deepEqual(toPayloadQuestion(back).options, ['a', 'b', 'c', 'd'])
  assert.equal('correct_boolean' in toPayloadQuestion(back), false)
})

test('reducer: thêm / sửa / xoá / nhân đôi / đổi thứ tự', () => {
  let list = []
  const a = createQuestion('essay', { content: 'A' })
  const b = createQuestion('essay', { content: 'B' })
  const c = createQuestion('essay', { content: 'C' })
  list = questionListReducer(list, { type: 'addMany', questions: [a, b, c] })
  list = questionListReducer(list, { type: 'move', key: c.key, delta: -1 })
  assert.deepEqual(list.map((q) => q.content), ['A', 'C', 'B'])
  assert.equal(questionListReducer(list, { type: 'move', key: a.key, delta: -1 }), list)
  assert.equal(questionListReducer(list, { type: 'move', key: b.key, delta: 1 }), list)
  list = questionListReducer(list, { type: 'duplicate', key: a.key })
  assert.deepEqual(list.map((q) => q.content), ['A', 'A', 'C', 'B'])
  assert.notEqual(list[0].key, list[1].key)
  list = questionListReducer(list, { type: 'update', key: b.key, patch: { content: 'B2' } })
  list = questionListReducer(list, { type: 'remove', key: c.key })
  assert.deepEqual(list.map((q) => q.content), ['A', 'A', 'B2'])
})

test('reducer: thêm/xoá đáp án giữ đúng đáp án đúng, giới hạn 2..8', () => {
  let list = [filledMc()]
  const key = list[0].key
  list = questionListReducer(list, { type: 'removeOption', key, index: 0 })
  assert.deepEqual([list[0].options, list[0].correct_option], [['b', 'c', 'd'], 1])
  list = questionListReducer(list, { type: 'removeOption', key, index: 1 })
  assert.equal(list[0].correct_option, null)
  list = questionListReducer(list, { type: 'removeOption', key, index: 0 })
  assert.equal(list[0].options.length, 2)
  assert.equal(questionListReducer(list, { type: 'removeOption', key, index: 0 }), list)
  for (let i = 0; i < 10; i += 1) list = questionListReducer(list, { type: 'addOption', key })
  assert.equal(list[0].options.length, 8)
})

test('draft: sửa -> dirty, lưu -> sạch, load từ API, validate cả phòng và payload', () => {
  let state = quizDraftReducer(initialDraft, { type: 'meta', field: 'title', value: ' Vật lý ' })
  assert.equal(state.dirty, true)
  assert.equal(validateDraft(state).summary, 'Phòng cần có ít nhất 1 câu hỏi.')
  state = quizDraftReducer(state, { type: 'add', question: filledMc() })
  state = quizDraftReducer(state, { type: 'add', question: createQuestion('true_false', { content: 'x' }) })
  const errors = validateDraft(state)
  assert.equal(hasErrors(errors), true)
  assert.equal(Object.keys(errors.questions).length, 1)
  assert.equal(toPayload(state).title, 'Vật lý')
  state = quizDraftReducer(state, { type: 'saved' })
  assert.equal(state.dirty, false)
  const loaded = quizDraftReducer(initialDraft, {
    type: 'load',
    quiz: { title: 'T', description: null, questions: [{ type: 'true_false', content: 'x', correct_boolean: true, options: null, explanation: null }] },
  })
  assert.equal(loaded.questions[0].correct_boolean, true)
  assert.equal(loaded.questions[0].options.length, 4)
  assert.equal(hasErrors(validateDraft(loaded)), false)
  assert.equal(questionFromApi({ type: 'weird', content: 'x' }).type, 'multiple_choice')
})
