import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGradingQueueStatus, selectGradingCandidates } from '../src/services/exam.service.js'

test('grading status reports real queue states and unavailable usage without inventing values', () => {
  const result = buildGradingQueueStatus({
    examId: 'exam-1', aiEnabled: true, hasAnswerKey: true, submissionCount: 8,
    jobs: [
      { submission_id: 's1', status: 'pending' },
      { submission_id: 's2', status: 'processing' },
      { submission_id: 's3', status: 'completed' },
      { submission_id: 's4', status: 'needs_review' },
      { submission_id: 's5', status: 'failed' },
      { submission_id: 's6', status: 'rate_limited' },
    ],
  })
  assert.deepEqual(result.queue, { pending: 1, processing: 1, completed: 1, needs_review: 1, failed: 1, rate_limited: 1, not_queued: 2 })
  assert.equal(result.worker_status, 'processing')
  assert.deepEqual(result.usage, { available: false })
})

test('grading candidates include only missing and retryable jobs, never active or completed jobs', () => {
  const result = selectGradingCandidates(
    [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' }],
    [
      { submission_id: 's1', status: 'pending' },
      { submission_id: 's2', status: 'processing' },
      { submission_id: 's3', status: 'completed' },
      { submission_id: 's4', status: 'failed' },
    ],
  )
  assert.deepEqual(result.candidates.map((item) => [item.submission.id, item.job?.status || null]), [['s4', 'failed'], ['s5', null]])
  assert.deepEqual(result.skipped.map((item) => [item.submission.id, item.job.status]), [['s1', 'pending'], ['s2', 'processing'], ['s3', 'completed']])
})

test('empty exam status is safe and does not report fake work', () => {
  const result = buildGradingQueueStatus({ examId: 'exam-empty', aiEnabled: false, hasAnswerKey: false, submissionCount: 0, jobs: [] })
  assert.equal(result.submission_count, 0)
  assert.equal(result.queue.not_queued, 0)
  assert.equal(result.worker_status, 'unavailable')
  assert.equal(result.ai_enabled, false)
  assert.equal(result.has_answer_key, false)
})
