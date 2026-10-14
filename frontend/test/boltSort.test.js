import test from 'node:test'
import assert from 'node:assert/strict'
import { hasLegalMove, isComplete, makeBoard, MYSTERY_BOLT_RATIO, PALETTE, planBoltMove, shuffle } from '../src/lib/boltSort.js'

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

test('one move transfers the full visible same-color run that fits, preserving bottom-to-top order', () => {
  const piece = (id, color) => ({ id, color, revealed: true })
  const source = [piece('a', 'blue'), piece('b', 'red'), piece('c', 'red'), piece('d', 'red')]
  const target = [piece('e', 'red')]
  const originalStacks = [source, target, []]

  const plan = planBoltMove(originalStacks, 0, 1, 4)

  assert.equal(plan.ok, true)
  assert.equal(plan.movedCount, 3)
  assert.deepEqual(plan.movedBolts.map((bolt) => bolt.id), ['b', 'c', 'd'])
  assert.deepEqual(plan.stacks[0].map((bolt) => bolt.id), ['a'])
  assert.deepEqual(plan.stacks[1].map((bolt) => bolt.id), ['e', 'b', 'c', 'd'])
  assert.equal(plan.stacks[1].length, 4)
  assert.deepEqual(originalStacks[0].map((bolt) => bolt.id), ['a', 'b', 'c', 'd'])
})

test('a same-color run larger than the open slots only moves the top bolts that fit', () => {
  const piece = (id, color) => ({ id, color, revealed: true })
  const stacks = [
    [piece('base', 'blue'), piece('red-1', 'red'), piece('red-2', 'red'), piece('red-3', 'red')],
    [piece('target-1', 'red'), piece('target-2', 'red')],
  ]

  const plan = planBoltMove(stacks, 0, 1, 3)

  assert.equal(plan.ok, true)
  assert.equal(plan.movedCount, 1)
  assert.deepEqual(plan.stacks[0].map((bolt) => bolt.id), ['base', 'red-1', 'red-2'])
  assert.deepEqual(plan.stacks[1].map((bolt) => bolt.id), ['target-1', 'target-2', 'red-3'])
})

test('a color mismatch or an unrevealed bolt stops the run; only available capacity moves', () => {
  const piece = (id, color, revealed = true) => ({ id, color, revealed })
  const stacks = [
    [piece('base', 'blue'), piece('hidden', 'red', false), piece('top', 'red')],
    [piece('target', 'red'), piece('target-top', 'red')],
  ]

  const plan = planBoltMove(stacks, 0, 1, 4)

  assert.equal(plan.ok, true)
  assert.equal(plan.movedCount, 1)
  assert.deepEqual(plan.stacks[0].map((bolt) => bolt.id), ['base', 'hidden'])
  assert.equal(plan.stacks[1].length, 3)
  assert.equal(plan.stacks[1][2].id, 'top')
  assert.equal(planBoltMove(stacks, 0, 1, 2).reason, 'target-full')
  assert.equal(planBoltMove([[piece('source', 'red')], [piece('wrong', 'blue')]], 0, 1, 4).reason, 'color-mismatch')
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
