import test from 'node:test'
import assert from 'node:assert/strict'
import { getQuizPartyAnswerRequest } from '../src/lib/quizPartyRequests.js'

test('Quiz Party retries reuse the same idempotency key for one question, then rotate on the next question', () => {
  let generated = 0
  const createKey = () => `request-${++generated}`
  const first = getQuizPartyAnswerRequest(null, 'question-a', createKey)
  const retry = getQuizPartyAnswerRequest(first, 'question-a', createKey)
  const next = getQuizPartyAnswerRequest(retry, 'question-b', createKey)

  assert.equal(first.requestId, 'request-1')
  assert.equal(retry.requestId, first.requestId)
  assert.equal(next.requestId, 'request-2')
  assert.equal(generated, 2)
})
