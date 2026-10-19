import test from 'node:test'
import assert from 'node:assert/strict'
import { BOLT_MOVE_DURATION_MS, getBoltFlightPose } from '../src/lib/boltSortAnimation.js'

const path = {
  fromX: -1.4,
  toX: 0.7,
  startY: 0.8,
  endY: 0.48,
  clearanceY: 2.1,
}

 test('bolt lifts vertically before moving toward the destination rod', () => {
  const pose = getBoltFlightPose({ ...path, progress: 0.1 })

  assert.equal(pose.x, path.fromX)
  assert.equal(pose.z, 0)
  assert.ok(pose.y > path.startY && pose.y < path.clearanceY)
  assert.ok(pose.rotationY > 0)
})

test('bolt travels horizontally at a fixed height above the rods while spinning', () => {
  const pose = getBoltFlightPose({ ...path, progress: 0.5 })

  assert.ok(pose.x > path.fromX && pose.x < path.toX)
  assert.equal(pose.y, path.clearanceY)
  assert.equal(pose.z, 0)
  assert.equal(pose.rotationY, Math.PI * 3)
})

test('bolt descends straight into the destination rod and finishes its spin', () => {
  const pose = getBoltFlightPose({ ...path, progress: 0.9 })
  const landed = getBoltFlightPose({ ...path, progress: 1 })

  assert.equal(pose.x, path.toX)
  assert.ok(pose.y < path.clearanceY && pose.y > path.endY)
  assert.equal(pose.z, 0)
  assert.ok(pose.rotationY > Math.PI * 5)
  assert.equal(landed.x, path.toX)
  assert.equal(landed.y, path.endY)
  assert.equal(landed.rotationY, Math.PI * 6)
})

test('flight duration is long enough to show all three movement phases', () => {
  assert.equal(BOLT_MOVE_DURATION_MS, 900)
})
