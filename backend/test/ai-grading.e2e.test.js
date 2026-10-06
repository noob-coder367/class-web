import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGradeTotals, getFailureOutcome, validateGradeResult } from '../src/services/ai-grading/index.js'

const answerKey = [{
  question_id: 'q-1', question_number: 1, question_text: 'Tính 2 + 2', max_score: 2,
  expected_answer: '4', rubric: [{ criterion: 'Kết quả', max_score: 2, description: 'Kết quả đúng' }],
}]
const grade = { questions: [{
  question_id: 'q-1', question_number: 1, question_text: 'Tính 2 + 2', score: 2, max_score: 2,
  confidence: 0.98, status: 'graded', comment: 'Đúng',
  rubric_items: [{ criterion: 'Kết quả', score: 2, max_score: 2, comment: 'Đúng' }],
}] }

function mockPipeline(providerMode = 'completed') {
  const jobs = new Map()
  const reviews = new Map()
  let nextId = 1
  return {
    submit(submission) {
      const key = `homework:${submission.id}`
      if (!jobs.has(key)) jobs.set(key, { id: `job-${nextId++}`, key, submission, status: 'pending', attempt_count: 0, result: null })
      return jobs.get(key)
    },
    worker() {
      const job = [...jobs.values()].find((item) => ['pending', 'rate_limited'].includes(item.status))
      if (!job) return false
      job.status = 'processing'; job.attempt_count += 1
      if (providerMode === 'rate_limited') { job.status = 'rate_limited'; job.error_code = 'AI_RATE_LIMITED'; return true }
      if (providerMode === 'failed') { job.status = 'failed'; job.error_code = 'AI_PROVIDER_5XX'; return true }
      const valid = validateGradeResult(grade, answerKey)
      job.result = { ...valid, ...calculateGradeTotals(valid, answerKey), grading_status: providerMode === 'needs_review' ? 'needs_review' : 'graded' }
      job.status = providerMode === 'needs_review' ? 'needs_review' : 'completed'
      return true
    },
    api(submissionId) {
      const job = [...jobs.values()].find((item) => item.submission.id === submissionId)
      return { submission_id: submissionId, status: job?.status || 'not_queued', grading_status: job?.result?.grading_status || job?.status || 'not_queued', questions: job?.result?.questions || [], total_score: job?.result?.total_score ?? null, total_max_score: job?.result?.total_max_score ?? null, total_score_complete: job?.result?.total_score_complete === true, final_score: job?.result?.final_score ?? null }
    },
    review(submissionId, teacherScore) {
      const job = [...jobs.values()].find((item) => item.submission.id === submissionId)
      assert.ok(job && ['completed', 'needs_review'].includes(job.status))
      assert.ok(teacherScore >= 0 && teacherScore <= 2)
      reviews.set(job.id, { teacher_score: teacherScore })
      job.result = { ...job.result, final_score: teacherScore, final_max_score: 2, final_score_complete: true, grading_status: 'graded_after_review' }
      return this.api(submissionId)
    },
  }
}

test('mocked E2E completed flow reaches server total and teacher final score', () => {
  const pipeline = mockPipeline()
  const job = pipeline.submit({ id: 'submission-1', files: [{ path: 'answer.png' }] })
  assert.equal(job.status, 'pending')
  pipeline.worker()
  const result = pipeline.api('submission-1')
  assert.equal(result.status, 'completed')
  assert.deepEqual(result.total_score, 2)
  assert.equal(result.total_max_score, 2)
  assert.equal(result.total_score_complete, true)
  assert.equal(pipeline.review('submission-1', 1.5).final_score, 1.5)
})

test('mocked E2E needs_review, failed, rate_limited and retry outcomes stay score-safe', () => {
  for (const mode of ['needs_review', 'failed', 'rate_limited']) {
    const pipeline = mockPipeline(mode)
    pipeline.submit({ id: `submission-${mode}`, files: [{ path: 'answer.png' }] })
    pipeline.worker()
    const result = pipeline.api(`submission-${mode}`)
    assert.equal(result.status, mode)
    if (mode !== 'needs_review') assert.equal(result.total_score, null)
  }
  const retry = getFailureOutcome(Object.assign(new Error('temporary'), { status: 503 }), 1, { AI_GRADING_MAX_ATTEMPTS: 3, AI_GRADING_RETRY_BASE_MS: 1000, AI_GRADING_RETRY_MAX_MS: 60_000 })
  assert.deepEqual({ status: retry.status, delayMs: retry.delayMs }, { status: 'pending', delayMs: 1000 })
})

test('mocked E2E duplicate submission/enqueue keeps one job', () => {
  const pipeline = mockPipeline()
  const first = pipeline.submit({ id: 'submission-duplicate', files: [] })
  const second = pipeline.submit({ id: 'submission-duplicate', files: [] })
  assert.equal(first.id, second.id)
  pipeline.worker()
  assert.equal(pipeline.api('submission-duplicate').status, 'completed')
})
