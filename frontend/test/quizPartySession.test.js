import test from 'node:test'
import assert from 'node:assert/strict'
import { makeTeamDrafts, readTeamDrafts, serializeTeamDrafts, updateTeamDraft, writeTeamDrafts } from '../src/lib/quizPartySession.js'

const teams = [{ id: 'a', name: 'Đội 1' }, { id: 'b', name: 'Đội 2' }]

test('Quiz Party giữ tên và outfit trong draft phiên, tách object outfit giữa các đội', () => {
  const drafts = makeTeamDrafts(teams)
  const edited = updateTeamDraft(drafts, 'a', { name: 'Sao Băng', outfit: { hat: 'crown', shirt: 'tee-blue' } })

  assert.equal(edited[0].name, 'Sao Băng')
  assert.equal(edited[0].outfit.hat, 'crown')
  assert.deepEqual(edited[1].outfit, { hat: null, acc: null, shirt: null })
  assert.notEqual(edited[0].outfit, edited[1].outfit)
  assert.deepEqual(drafts[0].outfit, { hat: null, acc: null, shirt: null })
})

test('session serialization chỉ chứa id, tên và ba category outfit; không chứa dữ liệu backend khác', () => {
  const drafts = makeTeamDrafts(teams)
  const edited = updateTeamDraft(drafts, 'b', { name: 'Đội Biển', outfit: { acc: 'glasses' } })
  edited[1].secret = 'never persist'
  const serialized = serializeTeamDrafts(edited)

  assert.deepEqual(serialized[1], {
    id: 'b',
    name: 'Đội Biển',
    outfit: { hat: null, acc: 'glasses', shirt: null },
  })
  assert.equal('secret' in serialized[1], false)
})

test('session draft round-trip được trong cùng tab và lỗi storage không làm crash game', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const drafts = updateTeamDraft(makeTeamDrafts(teams), 'a', { name: 'Chớp' })
  writeTeamDrafts('abc123', drafts, storage)
  assert.deepEqual(readTeamDrafts('ABC123', storage), serializeTeamDrafts(drafts))
  assert.doesNotThrow(() => writeTeamDrafts('ABC123', drafts, { setItem: () => { throw new Error('quota') } }))
})
