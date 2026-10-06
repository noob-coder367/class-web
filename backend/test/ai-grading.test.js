import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNeedsReviewResult, calculateGradeTotals, isRetryable, retryAfterMs, validateAnswerKey, validateGradeResult, validateJobFiles } from '../src/services/ai-grading/index.js'

const answerKey = [
  {
    question_id: 'q-1', question_number: 1, question_text: 'Giải thích định luật.', max_score: 2,
    expected_answer: 'Nêu đúng định luật và điều kiện áp dụng.',
    rubric: [
      { criterion: 'Nêu định luật', max_score: 1, description: 'Nêu đúng nội dung định luật.' },
      { criterion: 'Điều kiện áp dụng', max_score: 1, description: 'Nêu đúng điều kiện áp dụng.' },
    ],
  },
  {
    question_id: 'q-2', question_number: 2, question_text: 'Tính kết quả.', max_score: 3,
    expected_answer: 'Kết quả cuối cùng là 42 và có trình bày phép tính.',
    rubric: [{ criterion: 'Kết quả', max_score: 2, description: 'Kết quả đúng.' }, { criterion: 'Trình bày', max_score: 1, description: 'Có các bước hợp lý.' }],
  },
]

function validOutput() {
  return { questions: [
    { question_id: 'q-1', question_number: 1, question_text: 'Giải thích định luật.', score: 1.5, max_score: 2, confidence: 0.94, status: 'graded', comment: 'Đạt một phần.', rubric_items: [{ criterion: 'Nêu định luật', score: 1, max_score: 1, comment: 'Đúng.' }, { criterion: 'Điều kiện áp dụng', score: 0.5, max_score: 1, comment: 'Thiếu một ý.' }] },
    { question_id: 'q-2', question_number: 2, question_text: 'Tính kết quả.', score: 3, max_score: 3, confidence: 0.98, status: 'graded', comment: 'Đúng.', rubric_items: [{ criterion: 'Kết quả', score: 2, max_score: 2, comment: 'Đúng.' }, { criterion: 'Trình bày', score: 1, max_score: 1, comment: 'Đủ bước.' }] },
  ] }
}

test('answer key supports multiple questions and multiple rubric criteria', () => {
  const result = validateAnswerKey(answerKey)
  assert.equal(result.length, 2)
  assert.equal(result[0].rubric.length, 2)
})

test('valid structured output is returned per question without totals', () => {
  const result = validateGradeResult(JSON.stringify(validOutput()), answerKey)
  assert.deepEqual(result.questions.map((q) => q.question_number), [1, 2])
  assert.equal('total_score' in result, false)
})

test('server calculates totals from answer key and ignores AI total_score', () => {
  const output = validOutput()
  output.total_score = 999
  output.total_max_score = 999
  const grade = validateGradeResult(output, answerKey)
  const totals = calculateGradeTotals(grade, answerKey)
  assert.deepEqual(totals, { total_score: 4.5, total_max_score: 5, grading_status: 'graded', total_score_complete: true })
})

test('server calculates a one-question total', () => {
  const oneQuestion = validateGradeResult({ questions: [validOutput().questions[0]] }, [answerKey[0]])
  assert.deepEqual(calculateGradeTotals(oneQuestion, [answerKey[0]]), { total_score: 1.5, total_max_score: 2, grading_status: 'graded', total_score_complete: true })
})

test('missing answer key or rubric is rejected and never invented', () => {
  assert.throws(() => validateAnswerKey([{ ...answerKey[0], expected_answer: '' }]))
  assert.throws(() => validateAnswerKey([{ ...answerKey[0], rubric: [] }]))
})

test('score and rubric score cannot exceed their max', () => {
  const output = validOutput(); output.questions[0].score = 2.1
  assert.throws(() => validateGradeResult(output, answerKey))
  const rubricOutput = validOutput(); rubricOutput.questions[0].rubric_items[0].score = 1.1
  assert.throws(() => validateGradeResult(rubricOutput, answerKey))
  const rubricTotalOutput = validOutput()
  rubricTotalOutput.questions[0].rubric_items[1].score = 1
  rubricTotalOutput.questions[0].score = 2
  assert.throws(() => validateGradeResult(rubricTotalOutput, [{ ...answerKey[0], max_score: 1 }, answerKey[1]]))
})

test('negative scores are rejected', () => {
  const output = validOutput(); output.questions[0].score = -0.1
  assert.throws(() => validateGradeResult(output, answerKey))
})

test('duplicate and unknown questions are rejected', () => {
  const duplicate = validOutput(); duplicate.questions[1] = { ...duplicate.questions[0] }
  assert.throws(() => validateGradeResult(duplicate, answerKey))
  const unknown = validOutput(); unknown.questions[0].question_id = 'q-unknown'; unknown.questions[0].question_number = 1
  assert.throws(() => validateGradeResult(unknown, answerKey))
})

test('malformed output is rejected instead of repaired', () => {
  assert.throws(() => validateGradeResult('{not-json}', answerKey))
  const missingRubric = validOutput(); delete missingRubric.questions[0].rubric_items
  assert.throws(() => validateGradeResult(missingRubric, answerKey))
})

test('unreadable evidence produces needs_review without guessed scores', () => {
  const result = buildNeedsReviewResult(answerKey, 'Không đọc rõ bài làm.')
  assert.equal(result.questions[0].status, 'needs_review')
  assert.equal(result.questions[0].score, null)
  assert.equal(result.questions[0].rubric_items[0].score, null)
})

test('needs_review output may keep scores null but remains structurally bounded', () => {
  const output = validOutput()
  for (const question of output.questions) {
    question.status = 'needs_review'
    question.score = null
    for (const item of question.rubric_items) item.score = null
  }
  const result = validateGradeResult(output, answerKey)
  assert.equal(result.questions.every((q) => q.status === 'needs_review' && q.score === null), true)
  const totals = calculateGradeTotals(result, answerKey)
  assert.deepEqual(totals, { total_score: null, total_max_score: 5, grading_status: 'needs_review', total_score_complete: false })
})

test('normalized handwritten math steps, equivalent notation and final answer are preserved', () => {
  const output = validOutput()
  output.questions[0] = {
    ...output.questions[0],
    status: 'correct',
    student_solution: 'x² - 4x + 4 = (x - 2)²',
    steps: [{ step_number: 1, content: 'Hoàn thành bình phương', math_expression: 'x^2-4x+4=(x-2)^2', intermediate_result: '(x-2)^2', confidence: 0.91 }],
    final_answer: '(x - 2)^2',
    readability: 'clear',
  }
  const result = validateGradeResult(output, [answerKey[0], answerKey[1]])
  assert.equal(result.questions[0].status, 'correct')
  assert.equal(result.questions[0].steps[0].math_expression, 'x^2-4x+4=(x-2)^2')
  assert.equal(result.questions[0].final_answer, '(x - 2)^2')
})

test('partially correct physics-style grading remains scoreable while unreadable evidence stays null', () => {
  const output = validOutput()
  output.questions[1] = {
    ...output.questions[1],
    status: 'partially_correct',
    score: 2,
    student_solution: 'v = 10 m/s',
    steps: [{ step_number: 1, content: 'Đổi đơn vị', math_expression: '10 m/s = 36 km/h', intermediate_result: '36 km/h', confidence: 0.88 }],
    final_answer: '36 km/h',
    readability: 'partial',
  }
  const result = validateGradeResult(output, answerKey)
  assert.equal(result.questions[1].status, 'partially_correct')
  assert.equal(calculateGradeTotals(result, answerKey).grading_status, 'graded')

  const unreadable = validOutput()
  unreadable.questions[0] = { ...unreadable.questions[0], status: 'unreadable', score: null, readability: 'unreadable', rubric_items: unreadable.questions[0].rubric_items.map((item) => ({ ...item, score: null })) }
  const safe = validateGradeResult(unreadable, answerKey)
  assert.equal(safe.questions[0].score, null)
  assert.equal(safe.questions[0].rubric_items[0].score, null)
})

test('AI file safety rejects unsupported types, oversized images and too many images', () => {
  assert.throws(() => validateJobFiles([{ path: 'x', mime: 'application/zip', size: 10 }]), /Loại file/)
  assert.throws(() => validateJobFiles([{ path: 'x', mime: 'image/png', size: 16 * 1024 * 1024 }]), /vượt giới hạn/)
})

test('retry classification separates provider failures from validation failures and honors retry-after', () => {
  assert.equal(isRetryable({ code: 'AI_TIMEOUT' }), true)
  assert.equal(isRetryable({ status: 503 }), true)
  assert.equal(isRetryable({ code: 'INVALID_GRADING_OUTPUT' }), false)
  assert.equal(retryAfterMs({ retryAfterMs: 2500 }), 2500)
})
