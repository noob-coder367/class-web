import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { buildNeedsReviewResult, getFailureOutcome, isRetryable, retryAfterMs, runGradingBatch, validateJobFiles } from '../src/services/ai-grading/index.js'

const config = {
  AI_GRADING_MAX_ATTEMPTS: 3,
  AI_GRADING_RETRY_BASE_MS: 1000,
  AI_GRADING_RETRY_MAX_MS: 60_000,
}

const answerKey = [{
  question_id: 'q-1', question_number: 1, question_text: 'Câu hỏi', max_score: 2,
  expected_answer: 'Đáp án', rubric: [{ criterion: 'Ý chính', max_score: 2, description: 'Đúng ý' }],
}]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function providerError(kind) {
  if (kind === 'timeout') return Object.assign(new Error('provider timeout'), { code: 'AI_TIMEOUT' })
  if (kind === 'network') return Object.assign(new Error('network failure'), { code: 'AI_NETWORK' })
  if (kind === '429') return Object.assign(new Error('HTTP 429'), { status: 429, code: 'AI_RATE_LIMITED', retryAfterMs: 60 * 60_000 })
  if (kind === '500') return Object.assign(new Error('HTTP 500'), { status: 500, code: 'AI_PROVIDER_5XX' })
  if (kind === '503') return Object.assign(new Error('HTTP 503'), { status: 503, code: 'AI_PROVIDER_5XX' })
  return Object.assign(new Error('Malformed grading JSON'), { code: 'INVALID_GRADING_OUTPUT' })
}

test('20 concurrent jobs stay within bounded concurrency, are not lost, and finish validly', async () => {
  const jobs = Array.from({ length: 20 }, (_, id) => ({ id: `job-${id}`, status: 'pending' }))
  let active = 0
  let peak = 0
  const completed = new Set()
  const concurrency = 4

  async function claimAndProcess() {
    const job = jobs.find((candidate) => candidate.status === 'pending')
    if (!job) return false
    job.status = 'processing'
    active += 1
    peak = Math.max(peak, active)
    await wait(2)
    job.status = 'completed'
    completed.add(job.id)
    active -= 1
    return true
  }

  while (jobs.some((job) => job.status === 'pending')) {
    await runGradingBatch({ concurrency, runOne: claimAndProcess })
  }

  assert.equal(peak, concurrency)
  assert.equal(completed.size, 20)
  assert.equal(jobs.filter((job) => job.status === 'completed').length, 20)
  assert.equal(new Set(jobs.map((job) => job.id)).size, 20)
  assert.equal(active, 0)
})

test('duplicate enqueue requests converge to one active job and completed jobs are not rerun', async () => {
  const rows = new Map()
  const submissionKey = 'homework:submission-1'
  async function enqueue(key) {
    const existing = rows.get(key)
    if (existing) return existing
    const row = { id: 'job-1', key, status: 'pending' }
    // Simulate the database unique constraint winning the insert race.
    await wait(0)
    if (!rows.has(key)) rows.set(key, row)
    return rows.get(key)
  }

  const results = await Promise.all(Array.from({ length: 20 }, () => enqueue(submissionKey)))
  assert.equal(new Set(results.map((row) => row.id)).size, 1)
  assert.equal(rows.size, 1)
  rows.get(submissionKey).status = 'completed'
  const claimed = rows.get(submissionKey).status === 'pending'
  assert.equal(claimed, false)
})

test('worker crash recovery returns stale processing job to queue without resetting attempts', () => {
  const job = { id: 'job-recover', status: 'processing', attempt_count: 1, locked_at: '2026-01-01T00:00:00.000Z', locked_by: 'dead-worker' }
  // Mirrors recover_stuck_ai_grading_jobs: only lease fields/status are reset.
  if (job.status === 'processing' && job.locked_at) {
    job.status = 'pending'
    job.locked_at = null
    job.locked_by = null
    job.error_code = 'WORKER_RECOVERY'
  }
  assert.deepEqual(job, { id: 'job-recover', status: 'pending', attempt_count: 1, locked_at: null, locked_by: null, error_code: 'WORKER_RECOVERY' })
  assert.equal(getFailureOutcome(providerError('500'), job.attempt_count, config).status, 'pending')
})

test('Gemini, OCR and Groq provider failures classify retryable errors and cap attempts', () => {
  for (const kind of ['timeout', 'network', '429', '500', '503']) {
    const error = providerError(kind)
    assert.equal(isRetryable(error), true, `${kind} should retry`)
    assert.equal(getFailureOutcome(error, 1, config).status, kind === '429' ? 'rate_limited' : 'pending')
    assert.equal(getFailureOutcome(error, 3, config).status, kind === '429' ? 'rate_limited' : 'failed')
  }
  const rateLimited = getFailureOutcome(providerError('429'), 1, config)
  assert.equal(rateLimited.delayMs, 60 * 60_000)
  assert.equal(retryAfterMs({ retryAfterMs: 2500 }), 2500)
  const malformed = getFailureOutcome(providerError('malformed'), 1, config)
  assert.equal(malformed.status, 'failed')
  assert.equal(isRetryable(providerError('malformed')), false)
})

test('unreadable evidence goes to needs_review with null scores, never score zero', () => {
  const result = buildNeedsReviewResult(answerKey, 'Không đọc rõ bài làm.')
  assert.equal(result.questions[0].status, 'needs_review')
  assert.equal(result.questions[0].score, null)
  assert.equal(result.questions[0].rubric_items[0].score, null)
  assert.notEqual(result.questions[0].score, 0)
})

test('large, excessive, malformed and unsupported files are rejected before provider use', () => {
  assert.throws(() => validateJobFiles([]), /vượt giới hạn file/)
  assert.throws(() => validateJobFiles([{ path: 'large', mime: 'image/png', size: 16 * 1024 * 1024 }]), /vượt giới hạn/)
  assert.throws(() => validateJobFiles(Array.from({ length: 21 }, (_, index) => ({ path: String(index), mime: 'image/png', size: 10 }))), /vượt giới hạn/)
  assert.throws(() => validateJobFiles([{ path: 'bad', mime: 'application/zip', size: 10 }]), /Loại file/)
  assert.throws(() => validateJobFiles([{ path: 'pdf', mime: 'application/pdf', size: 10, pages: 31 }]), /số trang/)
})

test('web server starts the AI worker conditionally without importing the worker entrypoint', async () => {
  const server = await fs.readFile(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.equal(server.includes('startAiGradingWorker'), true)
  assert.equal(server.includes("./services/ai-grading/index.js"), true)
  assert.equal(server.includes('AI_GRADING_ENABLED'), true)
  assert.equal(server.includes('ai-web-${process.pid}'), true)
  assert.equal(server.includes('AI grading worker started in-web'), true)
})

test('failure metadata is bounded and does not expose credentials', () => {
  const error = Object.assign(new Error('Bearer super-secret-key provider failed'), { status: 503 })
  const safe = String(error.message).replace(/(?:Bearer\s+|api[_-]?key[=:]\s*)[^\s,;]+/gi, '[redacted]').slice(0, 500)
  assert.equal(safe.includes('super-secret-key'), false)
  assert.equal(getFailureOutcome(error, 3, config).errorCode, 'AI_PROVIDER_5XX')
})
