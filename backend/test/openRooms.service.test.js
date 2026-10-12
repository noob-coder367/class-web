import test from 'node:test'
import assert from 'node:assert/strict'
import { filterOpenRoomCandidates, mergeRoomCandidates, prioritizeOwnerRooms } from '../src/services/game/openRooms.service.js'

const room = (id, overrides = {}) => ({
  id,
  code: id.toUpperCase(),
  host_id: 'host-a',
  status: 'lobby',
  settings: { is_public: true, single_device_mode: false },
  created_at: '2026-10-12T10:00:00.000Z',
  ...overrides,
})

test('host-private rooms remain visible to their owner and private from other players', () => {
  const privateRoom = room('private-host-room', { settings: { is_public: false, single_device_mode: false } })
  const publicRoom = room('public-room', { host_id: 'host-b' })
  const candidates = mergeRoomCandidates([privateRoom], [publicRoom])

  assert.deepEqual(filterOpenRoomCandidates(candidates, 'host-a').map(({ id }) => id), ['private-host-room', 'public-room'])
  assert.deepEqual(filterOpenRoomCandidates(candidates, 'guest').map(({ id }) => id), ['public-room'])
})

test('public rooms are discoverable only while joinable; host can still see own active room', () => {
  const activePublic = room('active-public', { status: 'playing', host_id: 'host-b' })
  const privateOther = room('private-other', { host_id: 'host-b', settings: { is_public: false, single_device_mode: false } })
  const singleDevice = room('single-device', { settings: { is_public: true, single_device_mode: true } })
  const candidates = [activePublic, privateOther, singleDevice]
  const hostPresent = new Set(['active-public'])

  assert.deepEqual(filterOpenRoomCandidates(candidates, 'host-a', hostPresent).map(({ id }) => id), [])
  assert.deepEqual(filterOpenRoomCandidates(candidates, 'host-b', hostPresent).map(({ id }) => id), ['active-public', 'private-other'])
  assert.deepEqual(filterOpenRoomCandidates(candidates, 'guest').map(({ id }) => id), ['active-public'])
})

test('candidate merge de-duplicates rooms without losing host-first ordering', () => {
  const ownerCopy = room('shared-room', { settings: { is_public: false, single_device_mode: false } })
  const publicCopy = room('shared-room', { settings: { is_public: true, single_device_mode: false } })
  const otherPrivate = room('owner-only', { settings: { is_public: false, single_device_mode: false } })

  const merged = mergeRoomCandidates([ownerCopy, otherPrivate], [publicCopy])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].settings.is_public, true)
  assert.deepEqual(merged.map(({ id }) => id), ['shared-room', 'owner-only'])
})

test('host rooms are pinned ahead of public rooms within the 20-room display limit', () => {
  const publicRooms = Array.from({ length: 25 }, (_, index) => room(`public-${index}`, { host_id: `guest-${index}` }))
  const privateRoom = room('host-private', { settings: { is_public: false, single_device_mode: false } })
  const filtered = filterOpenRoomCandidates([...publicRooms, privateRoom], 'host-a')
  const shown = prioritizeOwnerRooms(filtered, 'host-a', 20)

  assert.equal(shown.length, 20)
  assert.equal(shown[0].id, 'host-private')
  assert.ok(shown.some(({ id }) => id === 'public-0'))
})
