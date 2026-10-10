export const PLAYER_FOOT_OFFSET = 0.56
export const PLAYER_RADIUS = 0.3
export const JUMP_SPEED = 8.4
export const GRAVITY = 21
export const COYOTE_TIME = 0.12
export const JUMP_BUFFER_TIME = 0.14
export const PLATFORMER_FINISH_Z = 34

// Hand-authored route: short gaps, broad landing surfaces and modest height changes
// keep every jump reachable with the default run speed and jump impulse.
export const PLATFORMER_PLATFORMS = Object.freeze([
  Object.freeze({ id: 'start', x: 0, z: 0, y: 0, width: 8, depth: 7, style: 'start' }),
  Object.freeze({ id: 'meadow', x: 1.1, z: 6.2, y: 0.35, width: 4.6, depth: 4.3, style: 'meadow' }),
  Object.freeze({ id: 'bloom', x: -1.15, z: 11.8, y: 0.95, width: 4.5, depth: 4.2, style: 'bloom' }),
  Object.freeze({ id: 'drift', x: 0.25, z: 17.05, y: 1.05, width: 4.2, depth: 3.8, style: 'moving', motionAxis: 'x', motionRange: 1.15, motionPeriod: 4.8 }),
  Object.freeze({ id: 'checkpoint', x: 1.5, z: 22.2, y: 1.55, width: 4.7, depth: 4.2, style: 'checkpoint' }),
  Object.freeze({ id: 'spire', x: -0.85, z: 27.7, y: 2.15, width: 4.6, depth: 4.4, style: 'spire' }),
  Object.freeze({ id: 'finish', x: 0.15, z: 34, y: 2.45, width: 8, depth: 8, style: 'finish' }),
])

export const PLATFORMER_CRYSTALS = Object.freeze([
  Object.freeze({ id: 'crystal-1', x: 1.1, y: 1.45, z: 6.2 }),
  Object.freeze({ id: 'crystal-2', x: -1.15, y: 2.08, z: 11.8 }),
  Object.freeze({ id: 'crystal-3', x: 0.25, y: 2.2, z: 17.05 }),
  Object.freeze({ id: 'crystal-4', x: -0.85, y: 3.25, z: 27.7 }),
])

export const PLATFORMER_HAZARD = Object.freeze({ id: 'wind-wheel', x: 1.5, z: 22.2, y: 2.25, radius: 0.72, period: 3.6, range: 1.4 })

export function createPlatformerState(checkpoint = { x: 0, z: 0, y: 0 }) {
  return {
    x: checkpoint.x,
    y: checkpoint.y + PLAYER_FOOT_OFFSET,
    z: checkpoint.z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    groundPlatformId: null,
    coyote: COYOTE_TIME,
    jumpBuffer: 0,
    jumpHeld: false,
    checkpoint: { ...checkpoint },
    checkpointReached: false,
    finishReached: false,
    respawns: 0,
    invulnerable: 0,
  }
}

export function platformTransform(platform, seconds = 0) {
  const result = { x: platform.x, y: platform.y, z: platform.z }
  if (platform.motionAxis && platform.motionRange && platform.motionPeriod) {
    const offset = Math.sin((seconds / platform.motionPeriod) * Math.PI * 2) * platform.motionRange
    result[platform.motionAxis] += offset
  }
  return result
}

function insidePlatform(x, z, platform, seconds) {
  const transform = platformTransform(platform, seconds)
  return Math.abs(x - transform.x) <= platform.width / 2 - PLAYER_RADIUS * 0.25
    && Math.abs(z - transform.z) <= platform.depth / 2 - PLAYER_RADIUS * 0.25
}

function supportingPlatform(x, z, y, platforms, seconds) {
  let best = null
  for (const platform of platforms) {
    if (!insidePlatform(x, z, platform, seconds)) continue
    const top = platformTransform(platform, seconds).y
    if (Math.abs((y - PLAYER_FOOT_OFFSET) - top) <= 0.075 && (!best || top > best.y)) best = { platform, y: top }
  }
  return best
}

export function hazardPosition(seconds = 0) {
  return {
    x: PLATFORMER_HAZARD.x + Math.sin((seconds / PLATFORMER_HAZARD.period) * Math.PI * 2) * PLATFORMER_HAZARD.range,
    y: PLATFORMER_HAZARD.y,
    z: PLATFORMER_HAZARD.z,
  }
}

export function stepPlatformer(state, input = {}, rawDelta = 1 / 60, seconds = 0, platforms = PLATFORMER_PLATFORMS) {
  const dt = Math.max(0, Math.min(0.05, Number(rawDelta) || 0))
  if (!dt) return { state, events: { jumped: false, landed: false, checkpoint: false, respawned: false, hitHazard: false, finish: false } }

  const next = { ...state, checkpoint: { ...state.checkpoint } }
  const events = { jumped: false, landed: false, checkpoint: false, respawned: false, hitHazard: false, finish: false }
  next.invulnerable = Math.max(0, (Number(next.invulnerable) || 0) - dt)
  let jumpBuffer = Math.max(0, next.jumpBuffer - dt)
  if (input.jump && !next.jumpHeld) jumpBuffer = JUMP_BUFFER_TIME
  next.jumpHeld = Boolean(input.jump)

  // Carry a rider along a moving platform before accepting new movement input.
  if (next.grounded && next.groundPlatformId) {
    const carrier = platforms.find((platform) => platform.id === next.groundPlatformId)
    if (carrier?.motionAxis) {
      const before = platformTransform(carrier, seconds - dt)
      const after = platformTransform(carrier, seconds)
      next.x += after.x - before.x
      next.z += after.z - before.z
    }
  }

  const axisX = Math.max(-1, Math.min(1, Number(input.x) || 0))
  const axisZ = Math.max(-1, Math.min(1, Number(input.z) || 0))
  const magnitude = Math.hypot(axisX, axisZ)
  const scale = magnitude > 1 ? 1 / magnitude : 1
  const speed = input.run ? 8.3 : 6.2
  const targetVx = axisX * scale * speed
  const targetVz = axisZ * scale * speed
  const acceleration = next.grounded ? 29 : 14
  const friction = next.grounded ? 21 : 1.6
  const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount)
  next.vx = approach(next.vx, magnitude ? targetVx : 0, (magnitude ? acceleration : friction) * dt)
  next.vz = approach(next.vz, magnitude ? targetVz : 0, (magnitude ? acceleration : friction) * dt)

  let jumped = false
  if (jumpBuffer > 0 && (next.grounded || next.coyote > 0)) {
    next.vy = JUMP_SPEED
    next.grounded = false
    next.groundPlatformId = null
    next.coyote = 0
    jumpBuffer = 0
    jumped = true
    events.jumped = true
  }

  const oldFoot = next.y - PLAYER_FOOT_OFFSET
  const wasGrounded = next.grounded
  next.x += next.vx * dt
  next.z += next.vz * dt

  if (!jumped && wasGrounded) {
    const support = supportingPlatform(next.x, next.z, next.y, platforms, seconds)
    if (support) {
      next.y = support.y + PLAYER_FOOT_OFFSET
      next.vy = 0
      next.grounded = true
      next.groundPlatformId = support.platform.id
      next.coyote = COYOTE_TIME
    } else {
      next.grounded = false
      next.groundPlatformId = null
      next.coyote = COYOTE_TIME
    }
  }

  if (!next.grounded) {
    next.coyote = Math.max(0, next.coyote - dt)
    next.vy -= GRAVITY * dt
    next.y += next.vy * dt
    const foot = next.y - PLAYER_FOOT_OFFSET
    if (next.vy <= 0) {
      const landing = platforms
        .map((platform) => ({ platform, transform: platformTransform(platform, seconds) }))
        .filter(({ platform, transform }) => oldFoot >= transform.y - 0.04 && foot <= transform.y && insidePlatform(next.x, next.z, platform, seconds))
        .sort((a, b) => b.transform.y - a.transform.y)[0]
      if (landing) {
        next.y = landing.transform.y + PLAYER_FOOT_OFFSET
        next.vy = 0
        next.grounded = true
        next.groundPlatformId = landing.platform.id
        next.coyote = COYOTE_TIME
        events.landed = true
      }
    }
  }

  next.jumpBuffer = jumpBuffer
  if (next.grounded && !state.grounded) events.landed = true

  if (next.grounded && !next.checkpointReached && next.z >= 19 && next.z <= 25) {
    next.checkpoint = { x: 1.5, z: 22.2, y: 1.55 }
    next.checkpointReached = true
    events.checkpoint = true
  }

  if (next.grounded && next.groundPlatformId === 'finish' && next.z >= PLATFORMER_FINISH_Z && !next.finishReached) {
    next.finishReached = true
    events.finish = true
  }

  const hazard = hazardPosition(seconds)
  const hazardDx = next.x - hazard.x
  const hazardDy = next.y - hazard.y
  const hazardDz = next.z - hazard.z
  if (next.grounded && next.invulnerable <= 0 && hazardDx * hazardDx + hazardDy * hazardDy + hazardDz * hazardDz < PLATFORMER_HAZARD.radius ** 2) {
    events.hitHazard = true
    const respawned = createPlatformerState(next.checkpoint)
    respawned.respawns = next.respawns + 1
    respawned.checkpointReached = next.checkpointReached
    respawned.invulnerable = 1.1
    return { state: respawned, events }
  }

  if (next.y < -9 || Math.abs(next.x) > 28 || next.z < -12) {
    events.respawned = true
    const respawned = createPlatformerState(next.checkpoint)
    respawned.respawns = next.respawns + 1
    respawned.checkpointReached = next.checkpointReached
    respawned.invulnerable = 0.6
    return { state: respawned, events }
  }

  return { state: next, events }
}

export function collectNearbyCrystals(state, collectedIds, crystals = PLATFORMER_CRYSTALS) {
  const nextIds = new Set(collectedIds)
  const collected = []
  for (const crystal of crystals) {
    if (nextIds.has(crystal.id)) continue
    const dx = state.x - crystal.x
    const dy = state.y - crystal.y
    const dz = state.z - crystal.z
    if (dx * dx + dy * dy + dz * dz < 1.35 ** 2) {
      nextIds.add(crystal.id)
      collected.push(crystal.id)
    }
  }
  return { collectedIds: nextIds, collected }
}
