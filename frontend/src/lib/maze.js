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
