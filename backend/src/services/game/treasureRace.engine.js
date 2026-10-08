export const TREASURE_RACE_MODE = 'treasure_race'
export const GAME_PHASES = Object.freeze({ QUESTION: 'question', RESULT: 'result', DICE_ROLL: 'dice_roll', MOVEMENT: 'movement', NEXT_QUESTION: 'next_question', FINISHED: 'finished' })
export const DIRECTIONS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] })

export function calculateMovement({ isCorrect, responseTimeMs, timerEnabled = true }) {
  if (!isCorrect) return -1
  if (!timerEnabled) return 3
  return responseTimeMs <= 10000 ? 3 : 2
}

export function movePosition(position, movement, boardLength) {
  const finalPosition = Math.max(0, boardLength)
  return Math.min(finalPosition, Math.max(0, position + movement))
}

export function hasWinner(position, boardLength) {
  return position >= boardLength
}

export function orderTeamsByDice(rolls) {
  return [...rolls].sort((a, b) => b.value - a.value || a.teamId.localeCompare(b.teamId))
}

export function nextTurnIndex(currentIndex, teamCount) {
  return teamCount === 0 ? 0 : (currentIndex + 1) % teamCount
}

export function evaluateAnswer(question, answer) {
  if (!question) return false
  if (question.type === 'multiple_choice') return Number(answer) === Number(question.correct_option)
  if (question.type === 'true_false') return String(answer) === String(question.correct_boolean)
  if (question.type === 'essay') return String(answer || '').trim().length > 0
  return false
}

function seededRandom(seed) {
  let value = Number(seed) >>> 0
  return () => {
    value += 0x6D2B79F5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const reverseDirection = { n: 's', s: 'n', e: 'w', w: 'e' }
const directionDelta = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }

export function cellKey(x, y) { return `${x},${y}` }
export function cellIndex(x, y, width) { return y * width + x }

export function generateMaze(seed = 1, width = 9, height = 9) {
  const safeWidth = Math.max(5, Number(width) || 9)
  const safeHeight = Math.max(5, Number(height) || 9)
  const random = seededRandom(seed)
  const cells = Array.from({ length: safeWidth * safeHeight }, (_, index) => ({
    x: index % safeWidth,
    y: Math.floor(index / safeWidth),
    walls: { n: true, e: true, s: true, w: true },
  }))
  const visited = new Set()
  const visit = (x, y) => {
    visited.add(cellKey(x, y))
    const neighbours = Object.entries(directionDelta)
      .map(([direction, [dx, dy]]) => ({ direction, x: x + dx, y: y + dy }))
      .filter(({ x: nextX, y: nextY }) => nextX >= 0 && nextX < safeWidth && nextY >= 0 && nextY < safeHeight && !visited.has(cellKey(nextX, nextY)))
      .sort(() => random() - 0.5)
    for (const { direction, x: nextX, y: nextY } of neighbours) {
      if (visited.has(cellKey(nextX, nextY))) continue
      const from = cells[cellIndex(x, y, safeWidth)]
      const to = cells[cellIndex(nextX, nextY, safeWidth)]
      from.walls[direction] = false
      to.walls[reverseDirection[direction]] = false
      visit(nextX, nextY)
    }
  }
  visit(0, 0)
  const spawns = [[0, 0], [safeWidth - 1, 0], [0, safeHeight - 1], [Math.floor(safeWidth / 2), 0]]
  return { seed: Number(seed) >>> 0, width: safeWidth, height: safeHeight, cells, exit: { x: safeWidth - 1, y: safeHeight - 1 }, spawns }
}

export function getMazeCell(maze, x, y) {
  if (!maze || x < 0 || y < 0 || x >= maze.width || y >= maze.height) return null
  return maze.cells[cellIndex(x, y, maze.width)]
}

export function canMove(maze, position, direction) {
  const delta = DIRECTIONS[direction]
  if (!delta) return { allowed: false, reason: 'invalid_direction' }
  const [dx, dy] = delta
  const from = getMazeCell(maze, position.x, position.y)
  const to = getMazeCell(maze, position.x + dx, position.y + dy)
  if (!from || !to) return { allowed: false, reason: 'wall' }
  const wall = direction === 'up' ? 'n' : direction === 'down' ? 's' : direction === 'left' ? 'w' : 'e'
  return from.walls[wall] ? { allowed: false, reason: 'wall' } : { allowed: true, position: { x: to.x, y: to.y } }
}

export function shortestPathDistance(maze, start, target = maze?.exit) {
  if (!maze || !start || !target) return Number.POSITIVE_INFINITY
  const queue = [{ x: start.x, y: start.y, distance: 0 }]
  const visited = new Set([cellKey(start.x, start.y)])
  while (queue.length) {
    const current = queue.shift()
    if (current.x === target.x && current.y === target.y) return current.distance
    for (const [direction, [dx, dy]] of Object.entries(DIRECTIONS)) {
      const next = canMove(maze, { x: current.x, y: current.y }, direction)
      if (!next.allowed) continue
      const key = cellKey(next.position.x, next.position.y)
      if (!visited.has(key)) {
        visited.add(key)
        queue.push({ ...next.position, distance: current.distance + 1 })
      }
    }
  }
  return Number.POSITIVE_INFINITY
}

export function rankTeamsAtFinish(teams, maze) {
  const position = (team) => ({ x: team.x ?? team.maze_x ?? 0, y: team.y ?? team.maze_y ?? 0 })
  return [...teams].sort((a, b) => shortestPathDistance(maze, position(a), maze.exit) - shortestPathDistance(maze, position(b), maze.exit) || b.correct_count - a.correct_count || (a.total_response_time || 0) - (b.total_response_time || 0) || String(a.id).localeCompare(String(b.id)))
}
export function isExit(position, maze) { return Boolean(maze && position && position.x === maze.exit.x && position.y === maze.exit.y) }
