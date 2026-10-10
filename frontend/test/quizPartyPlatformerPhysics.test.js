import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectNearbyCrystals,
  createPlatformerState,
  JUMP_SPEED,
  PLATFORMER_CRYSTALS,
  PLATFORMER_FINISH_Z,
  PLATFORMER_PLATFORMS,
  stepPlatformer,
} from '../src/lib/quizPartyPlatformerPhysics.js'

const tick = (state, input = {}, seconds = 0, dt = 1 / 60) => stepPlatformer(state, input, dt, seconds)

test('the authored route has a start, intermediate islands, checkpoint, and finish', () => {
  assert.equal(PLATFORMER_PLATFORMS[0].id, 'start')
  assert.ok(PLATFORMER_PLATFORMS.some((platform) => platform.style === 'moving'))
  assert.ok(PLATFORMER_PLATFORMS.some((platform) => platform.style === 'checkpoint'))
  assert.equal(PLATFORMER_PLATFORMS.at(-1).id, 'finish')
  assert.ok(PLATFORMER_FINISH_Z > PLATFORMER_PLATFORMS[0].z)
  assert.ok(PLATFORMER_PLATFORMS.every((platform, index, all) => index === 0 || Math.abs(platform.y - all[index - 1].y) <= 1.7))
})

test('a deterministic player can jump from every island to the finish platform', () => {
  let state = createPlatformerState()
  let seconds = 0
  const dt = 1 / 60
  for (let index = 0; index < PLATFORMER_PLATFORMS.length - 1; index += 1) {
    const from = PLATFORMER_PLATFORMS[index]
    const target = PLATFORMER_PLATFORMS[index + 1]
    let reached = false
    let jumped = false
    for (let frame = 0; frame < 240; frame += 1) {
      const dx = target.x - state.x
      const dz = target.z - state.z
      const magnitude = Math.hypot(dx, dz) || 1
      const jump = !jumped && state.grounded && state.z >= from.z + from.depth / 2 - 0.9
      if (jump) jumped = true
      state = tick(state, { x: dx / magnitude, z: dz / magnitude, run: true, jump }, seconds, dt).state
      seconds += dt
      if (state.grounded && state.groundPlatformId === target.id) { reached = true; break }
    }
    assert.equal(reached, true, `could not land on ${target.id} from ${from.id}`)
  }
  assert.ok(state.z >= PLATFORMER_FINISH_Z - PLATFORMER_PLATFORMS.at(-1).depth / 2)
})

test('a grounded player has gravity-free support on the starting island', () => {
  let state = createPlatformerState()
  for (let frame = 0; frame < 30; frame += 1) state = tick(state).state
  assert.equal(state.grounded, true)
  assert.equal(state.groundPlatformId, 'start')
  assert.ok(Math.abs(state.y - 0.56) < 0.001)
})

test('jump input launches the player and the player lands back on a platform', () => {
  let state = createPlatformerState()
  const launch = tick(state, { jump: true })
  state = launch.state
  assert.equal(launch.events.jumped, true)
  assert.equal(state.grounded, false)
  assert.ok(state.vy > 0 && state.vy <= JUMP_SPEED)
  for (let frame = 1; frame < 120 && !state.grounded; frame += 1) {
    state = tick(state, { jump: false }, frame / 60).state
  }
  assert.equal(state.grounded, true)
  assert.equal(state.groundPlatformId, 'start')
})

test('coyote time permits a late jump after stepping off an edge', () => {
  const edgeState = {
    ...createPlatformerState(),
    z: 3.65,
    grounded: false,
    groundPlatformId: null,
    coyote: 0.09,
  }
  const result = tick(edgeState, { jump: true, z: 1 })
  assert.equal(result.events.jumped, true)
  assert.ok(result.state.vy > 0)
})

test('jump buffering holds a jump request until a landing can consume it', () => {
  const falling = {
    ...createPlatformerState(),
    y: 0.57,
    vy: -0.7,
    grounded: false,
    groundPlatformId: null,
    coyote: 0,
  }
  const landing = tick(falling, { jump: true })
  assert.equal(landing.state.grounded, true)
  assert.ok(landing.state.jumpBuffer > 0)
  const bufferedJump = tick(landing.state, { jump: true }, 1 / 60)
  assert.equal(bufferedJump.events.jumped, true)
})

test('checkpoint contact survives a moving hazard respawn and grants brief invulnerability', () => {
  const checkpointPlatform = PLATFORMER_PLATFORMS.find((platform) => platform.id === 'checkpoint')
  const atCheckpoint = {
    ...createPlatformerState(),
    x: checkpointPlatform.x,
    y: checkpointPlatform.y + 0.56,
    z: checkpointPlatform.z,
    grounded: true,
    groundPlatformId: checkpointPlatform.id,
  }
  const result = tick(atCheckpoint, {}, 0)
  assert.equal(result.events.checkpoint, true)
  assert.equal(result.events.hitHazard, true)
  assert.equal(result.state.checkpointReached, true)
  assert.ok(result.state.invulnerable > 1)
  const protectedStep = tick(result.state, {}, 1 / 60)
  assert.equal(protectedStep.events.hitHazard, false)
  assert.equal(protectedStep.state.groundPlatformId, checkpointPlatform.id)
})

test('crystals are collected locally and never mutate the team score model', () => {
  const platform = PLATFORMER_PLATFORMS.find((item) => item.id === 'meadow')
  const player = { x: platform.x, y: platform.y + 0.56, z: platform.z }
  const result = collectNearbyCrystals(player, new Set())
  assert.ok(result.collected.includes(PLATFORMER_CRYSTALS[0].id))
  assert.equal(result.collectedIds.size, 1)
  assert.equal(result.collectedIds.has(PLATFORMER_CRYSTALS[0].id), true)
})

test('crossing the finish platform emits one local finish event without score mutation', () => {
  const state = {
    ...createPlatformerState(),
    x: 0.15,
    y: 3.01,
    z: 33.95,
    grounded: true,
    groundPlatformId: 'finish',
  }
  const finish = tick(state, { z: 1 }, 0, 0.05)
  assert.equal(finish.events.finish, true)
  assert.equal(finish.state.finishReached, true)
  const later = tick(finish.state, {}, 1 / 60)
  assert.equal(later.events.finish, false)
})

test('a fall returns the character to the last activated checkpoint', () => {
  const state = {
    ...createPlatformerState({ x: 1.5, z: 22.2, y: 1.55 }),
    y: -9.2,
    grounded: false,
    checkpointReached: true,
    respawns: 2,
  }
  const result = tick(state)
  assert.equal(result.events.respawned, true)
  assert.equal(result.state.x, 1.5)
  assert.equal(result.state.z, 22.2)
  assert.equal(result.state.respawns, 3)
  assert.equal(result.state.checkpointReached, true)
})
