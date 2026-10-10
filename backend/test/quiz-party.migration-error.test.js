import test from 'node:test'
import assert from 'node:assert/strict'
import { isQuizPartyMigrationUnavailable } from '../src/lib/quizPartyMigration.js'

test('missing Quiz Party RPC errors are separated from unrelated and Treasure Race errors', () => {
  assert.equal(isQuizPartyMigrationUnavailable({ code: '42883' }, 'quiz_party'), true)
  assert.equal(isQuizPartyMigrationUnavailable({ code: 'PGRST202' }, 'quiz_party'), true)
  assert.equal(isQuizPartyMigrationUnavailable({ code: '23505' }, 'quiz_party'), false)
  assert.equal(isQuizPartyMigrationUnavailable({ code: 'PGRST202' }, 'treasure_race'), false)
  assert.equal(isQuizPartyMigrationUnavailable(null, 'quiz_party'), false)
})
