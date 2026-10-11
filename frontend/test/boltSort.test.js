import test from 'node:test'
import assert from 'node:assert/strict'
import { hasLegalMove, isComplete, makeBoard, MYSTERY_BOLT_RATIO, PALETTE, shuffle } from '../src/lib/boltSort.js'

const LEVELS = [
  { capacity: 3, colors: 3, rods: 5 },
  { capacity: 4, colors: 4, rods: 6 },
  { capacity: 6, colors: 5, rods: 7 },
  { capacity: 8, colors: 6, rods: 8 },
]

test('shuffle returns a permutation without mutating the input', () => {
  const input = [1, 2, 3, 4, 5]
  const result = shuffle(input)
  assert.deepEqual([...result].sort(), input)
  assert.deepEqual(input, [1, 2, 3, 4, 5])
  assert.notEqual(result, input)
})

test('legal-move detection respects top colors, capacity, and completed rods', () => {
  const piece = (color) => ({ color, revealed: true })
  assert.equal(hasLegalMove([[piece('blue'), piece('red')], [piece('blue')], []], 2), true)
  assert.equal(hasLegalMove([[piece('blue'), piece('red')], [piece('red'), piece('blue')], [piece('blue'), piece('red')]], 2), false)
  assert.equal(hasLegalMove([[piece('green'), piece('green')], []], 2), false)
})

test('every level gets a balanced board, spare empty rods, and only a small mystery share', () => {
  for (const level of LEVELS) {
    for (let round = 0; round < 30; round += 1) {
      const board = makeBoard(level)
      const filled = board.filter((stack) => stack.length)
      const bolts = board.flat()
      const mysteryCount = bolts.filter((bolt) => !bolt.revealed).length
      const expectedMysteries = Math.max(1, Math.round(bolts.length * MYSTERY_BOLT_RATIO))

      assert.equal(board.length, level.rods)
      assert.equal(filled.length, level.colors)
      assert.equal(board.filter((stack) => !stack.length).length, level.rods - level.colors)
      assert.equal(bolts.length, level.colors * level.capacity)
      assert.equal(mysteryCount, expectedMysteries)
      assert.equal(mysteryCount / bolts.length <= MYSTERY_BOLT_RATIO + 1 / bolts.length, true)
      assert.equal(new Set(bolts.map((bolt) => bolt.id)).size, bolts.length)

      const counts = new Map()
      bolts.forEach((bolt) => counts.set(bolt.color, (counts.get(bolt.color) || 0) + 1))
      assert.deepEqual([...counts.values()].sort((a, b) => a - b), Array(level.colors).fill(level.capacity))
      assert.equal(bolts.every((bolt) => PALETTE.slice(0, level.colors).includes(bolt.color)), true)
      assert.equal(filled.some((stack) => isComplete(stack, level.capacity) && stack.some((bolt) => !bolt.revealed)), false)
    }
  }
})
