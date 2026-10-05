import test from 'node:test'
import assert from 'node:assert/strict'
import { validateGradeResult } from '../src/services/ai-grading/index.js'

test('AI grading accepts the documented structured result', () => {
  const result = validateGradeResult('{"score":8.5,"max_score":10,"questions":[{"question":"1","score":2,"max_score":2,"comment":"ok","confidence":0.97}],"overall_comment":"good","confidence":0.91}')
  assert.equal(result.score, 8.5)
  assert.equal(result.questions.length, 1)
})

test('AI grading rejects malformed grader JSON safely', () => {
  assert.throws(() => validateGradeResult('{"score":"no"}'))
})
