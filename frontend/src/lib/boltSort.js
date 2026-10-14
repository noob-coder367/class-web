export const PALETTE = ['#39df53', '#ffc13c', '#ff5d68', '#32baf5', '#b86bff', '#ff8c52', '#f58dc9', '#a6d936']
export const MYSTERY_BOLT_RATIO = 0.13

export function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function isComplete(stack, capacity) {
  return stack.length === capacity && stack.every((bolt) => bolt.color === stack[0]?.color)
}

export function hasLegalMove(stacks, capacity) {
  return stacks.some((source, sourceIndex) => {
    const bolt = source[source.length - 1]
    if (!bolt || isComplete(source, capacity)) return false
    return stacks.some((target, targetIndex) => (
      targetIndex !== sourceIndex
      && target.length < capacity
      && (!target.length || target[target.length - 1].color === bolt.color)
    ))
  })
}

export function planBoltMove(stacks, fromIndex, toIndex, capacity) {
  if (!Array.isArray(stacks) || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex)
    || fromIndex < 0 || toIndex < 0 || fromIndex >= stacks.length || toIndex >= stacks.length
    || fromIndex === toIndex || !Number.isInteger(capacity) || capacity < 1) {
    return { ok: false, reason: 'invalid-move' }
  }

  const source = stacks[fromIndex]
  const target = stacks[toIndex]
  const topBolt = source[source.length - 1]
  if (!topBolt) return { ok: false, reason: 'empty-source' }
  if (!topBolt.revealed) return { ok: false, reason: 'hidden-top' }
  if (target.length >= capacity) return { ok: false, reason: 'target-full' }
  if (target.length && target[target.length - 1].color !== topBolt.color) {
    return { ok: false, reason: 'color-mismatch' }
  }

  let matchingRun = 0
  for (let index = source.length - 1; index >= 0; index -= 1) {
    const bolt = source[index]
    if (!bolt.revealed || bolt.color !== topBolt.color) break
    matchingRun += 1
  }

  const movedCount = Math.min(matchingRun, capacity - target.length)
  if (!movedCount) return { ok: false, reason: 'no-visible-run' }

  const movedBolts = source.slice(-movedCount).map((bolt) => ({ ...bolt, revealed: true }))
  const nextStacks = stacks.map((stack, index) => {
    if (index === fromIndex) return source.slice(0, -movedCount)
    if (index === toIndex) return [...target, ...movedBolts]
    return stack
  })

  return {
    ok: true,
    stacks: nextStacks,
    movedBolts,
    movedCount,
    fromLength: source.length,
    toLength: target.length,
  }
}

export function makeBoard(level) {
  const colors = PALETTE.slice(0, level.colors)
  let stacks
  do {
    const pieces = shuffle(colors.flatMap((color) => Array(level.capacity).fill(color)))
    stacks = Array.from({ length: level.rods }, (_, index) => (
      index < colors.length
        ? pieces.slice(index * level.capacity, (index + 1) * level.capacity).map((color) => ({
          color,
          revealed: true,
          id: Math.random().toString(36).slice(2),
        }))
        : []
    ))
  } while (stacks.slice(0, colors.length).every((stack) => isComplete(stack, level.capacity)))
  const hideableBolts = shuffle(stacks.filter((stack) => !isComplete(stack, level.capacity)).flat())
  const mysteryCount = Math.min(hideableBolts.length, Math.max(1, Math.round(stacks.flat().length * MYSTERY_BOLT_RATIO)))
  hideableBolts.slice(0, mysteryCount).forEach((bolt) => { bolt.revealed = false })

  return stacks
}
