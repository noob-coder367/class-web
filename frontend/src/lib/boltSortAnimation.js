export const BOLT_MOVE_DURATION_MS = 900

const LIFT_END = 0.18
const LAND_START = 0.78
const SPIN_RADIANS = Math.PI * 6

const clamp01 = (value) => Math.min(1, Math.max(0, value))
const smoothstep = (value) => value * value * (3 - 2 * value)
const easeOutCubic = (value) => 1 - (1 - value) ** 3
const lerp = (from, to, amount) => from + (to - from) * amount

/**
 * A bolt's path is deliberately split into three axis-aligned movements:
 * lift vertically, travel horizontally above the rods, then descend vertically.
 */
export function getBoltFlightPose({ progress, fromX, toX, startY, endY, clearanceY }) {
  const t = clamp01(progress)
  const rotationY = SPIN_RADIANS * t

  if (t < LIFT_END) {
    const phase = easeOutCubic(t / LIFT_END)
    return {
      x: fromX,
      y: lerp(startY, clearanceY, phase),
      z: 0,
      rotationY,
    }
  }

  if (t < LAND_START) {
    const phase = smoothstep((t - LIFT_END) / (LAND_START - LIFT_END))
    return {
      x: lerp(fromX, toX, phase),
      y: clearanceY,
      z: 0,
      rotationY,
    }
  }

  const phase = smoothstep((t - LAND_START) / (1 - LAND_START))
  return {
    x: toX,
    y: lerp(clearanceY, endY, phase),
    z: 0,
    rotationY,
  }
}
