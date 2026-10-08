export const DIRECTIONS = ['up', 'down', 'left', 'right']

export function normalizeMaze(maze) {
  if (!maze?.width || !maze?.height || !Array.isArray(maze.cells)) return null
  return { ...maze, cells: maze.cells.map((cell) => ({ ...cell, walls: { n: true, e: true, s: true, w: true, ...cell.walls } })) }
}

export function mazePosition(team) {
  return { x: Number(team?.maze_x ?? 0), y: Number(team?.maze_y ?? 0) }
}

export function mazeCell(maze, x, y) {
  if (!maze || x < 0 || y < 0 || x >= maze.width || y >= maze.height) return null
  return maze.cells[y * maze.width + x]
}

const STEPS = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]]

// Đường ngắn nhất theo từng ô, không xuyên tường. Trả về mảng ô từ start tới target (rỗng nếu không có đường).
export function shortestPath(maze, start, target = maze?.exit) {
  if (!maze || !start || !target) return []
  const key = (x, y) => y * maze.width + x
  const previous = new Map([[key(start.x, start.y), null]])
  const queue = [{ x: start.x, y: start.y }]
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]
    if (current.x === target.x && current.y === target.y) {
      const path = []
      let node = current
      while (node) { path.unshift({ x: node.x, y: node.y }); node = previous.get(key(node.x, node.y)) }
      return path
    }
    const cell = mazeCell(maze, current.x, current.y)
    if (!cell) continue
    for (const [wall, dx, dy] of STEPS) {
      const nx = current.x + dx
      const ny = current.y + dy
      if (cell.walls[wall] || !mazeCell(maze, nx, ny) || previous.has(key(nx, ny))) continue
      previous.set(key(nx, ny), current)
      queue.push({ x: nx, y: ny })
    }
  }
  return []
}
