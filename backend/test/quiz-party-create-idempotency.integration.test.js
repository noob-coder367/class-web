import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { Client } from 'pg'

// Staging-only integration test. Never point this at production.
// Required environment (set privately, do not commit credentials):
//   QUIZ_PARTY_TEST_ENV=staging
//   QUIZ_PARTY_TEST_STAGING_REF=<staging project ref>
//   QUIZ_PARTY_TEST_DATABASE_URL=<direct PostgreSQL URL for that staging ref>
//   QUIZ_PARTY_TEST_HOST_ID=<auth.users UUID owning the test quiz>
//   QUIZ_PARTY_TEST_QUIZ_ID=<quiz UUID with at least one question>
// Run with: npm run test:quiz-party-create-idempotency:integration

const PRODUCTION_REF = 'ckcolzvopsgbwlsihjcj'
const databaseUrl = process.env.QUIZ_PARTY_TEST_DATABASE_URL || ''
const stagingRef = process.env.QUIZ_PARTY_TEST_STAGING_REF || ''
const hostId = process.env.QUIZ_PARTY_TEST_HOST_ID || ''
const quizId = process.env.QUIZ_PARTY_TEST_QUIZ_ID || ''
const integrationRequested = process.env.QUIZ_PARTY_TEST_ENV === 'staging'

if (databaseUrl.toLowerCase().includes(PRODUCTION_REF) || stagingRef === PRODUCTION_REF) {
  throw new Error('Refusing to connect: the production Supabase project is forbidden for this test.')
}
if (integrationRequested && (!databaseUrl || !stagingRef || !hostId || !quizId)) {
  throw new Error('Staging integration requested but a required staging URL/ref/host/quiz setting is missing.')
}
if (integrationRequested && !databaseUrl.toLowerCase().includes(stagingRef.toLowerCase())) {
  throw new Error('The database URL must identify the supplied staging project ref; use its direct database hostname.')
}

const runId = randomUUID().slice(0, 8)

function newClient(label) {
  return new Client({
    connectionString: databaseUrl,
    application_name: `qpci-${runId}-${label}`,
    connectionTimeoutMillis: 8000,
    statement_timeout: 20000,
  })
}

async function connectAll(clients) {
  await Promise.all(clients.map((client) => client.connect()))
}

async function closeAll(clients) {
  await Promise.allSettled(clients.map((client) => client.end()))
}

async function verifyFixture(client) {
  const { rows } = await client.query(
    `select
       exists(select 1 from auth.users where id = $1::uuid) as host_exists,
       exists(select 1 from public.quizzes where id = $2::uuid and owner_id = $1::uuid) as quiz_owned,
       (select count(*)::int from public.questions where quiz_id = $2::uuid) as question_count`,
    [hostId, quizId],
  )
  assert.equal(rows[0].host_exists, true, 'staging fixture host must exist')
  assert.equal(rows[0].quiz_owned, true, 'staging fixture quiz must belong to the host')
  assert.ok(rows[0].question_count >= 1, 'staging fixture quiz must have at least one question')
}

function createArgs(gameMode, requestId = randomUUID()) {
  return {
    p_room_id: randomUUID(),
    p_game_id: randomUUID(),
    p_host_id: hostId,
    p_quiz_id: quizId,
    p_code: randomBytes(3).toString('hex').toUpperCase(),
    p_settings: {
      title: 'Quiz Party create idempotency integration test',
      game_mode: gameMode,
      team_count: 2,
      max_players_per_team: 4,
      board_length: 20,
      question_limit: 1,
      timer_enabled: true,
      single_device_mode: true,
      question_time_seconds: 30,
    },
    p_team_count: 2,
    p_question_limit: 1,
    p_game_mode: gameMode,
    p_request_id: requestId,
  }
}

async function createRoom(client, args) {
  const { rows } = await client.query(
    `select public.create_game_room_atomic_v2(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::jsonb,
       $7::integer, $8::integer, $9::text, $10::uuid
     ) as room_id`,
    [
      args.p_room_id,
      args.p_game_id,
      args.p_host_id,
      args.p_quiz_id,
      args.p_code,
      JSON.stringify(args.p_settings),
      args.p_team_count,
      args.p_question_limit,
      args.p_game_mode,
      args.p_request_id,
    ],
  )
  return rows[0].room_id
}

async function readRoom(client, roomId) {
  const { rows } = await client.query(
    'select id::text, game_mode from public.game_rooms where id = $1::uuid',
    [roomId],
  )
  return rows[0] || null
}

async function cleanupRooms(client, argsList) {
  const ids = [...new Set(argsList.map((args) => args.p_room_id))]
  if (ids.length) {
    await client.query('delete from public.game_rooms where id = any($1::uuid[])', [ids])
  }
}

async function waitForAdvisoryWaiters(monitor, applicationNames, expectedCount, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { rows } = await monitor.query(
      `select count(*)::int as count
       from pg_stat_activity
       where application_name = any($1::text[])
         and wait_event_type = 'Lock'
         and wait_event = 'advisory'`,
      [applicationNames],
    )
    if (rows[0].count >= expectedCount) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out waiting for ${expectedCount} RPC sessions to block on the shared advisory lock.`)
}

async function holdRoomCreationLock(client, requestId) {
  const lockMaterial = `${hostId}:${requestId}:create_room`
  await client.query('select pg_advisory_lock(hashtextextended($1, 0))', [lockMaterial])
  return lockMaterial
}

async function releaseRoomCreationLock(client, lockMaterial) {
  const { rows } = await client.query('select pg_advisory_unlock(hashtextextended($1, 0)) as released', [lockMaterial])
  assert.equal(rows[0].released, true, 'test must release its advisory lock')
}

const integrationTest = integrationRequested ? test : test.skip

integrationTest('staging fixture host owns a quiz with at least one question', async () => {
  const client = newClient('fixture')
  try {
    await client.connect()
    await verifyFixture(client)
  } finally {
    await client.end()
  }
})

integrationTest('same idempotency key retried with the same mode returns one unchanged room', async () => {
  const client = newClient('retry')
  const key = randomUUID()
  const firstArgs = createArgs('quiz_party', key)
  const retryArgs = createArgs('quiz_party', key)
  try {
    await client.connect()
    await verifyFixture(client)
    const firstRoomId = await createRoom(client, firstArgs)
    const retriedRoomId = await createRoom(client, retryArgs)
    assert.equal(retriedRoomId, firstRoomId)
    assert.equal((await readRoom(client, firstRoomId))?.game_mode, 'quiz_party')
    const { rows } = await client.query(
      `select count(*)::int as count
       from public.game_action_claims
       where user_id = $1::uuid and request_id = $2::uuid and action = 'create_room'`,
      [hostId, key],
    )
    assert.equal(rows[0].count, 1)
  } finally {
    try {
      await cleanupRooms(client, [firstArgs, retryArgs])
    } finally {
      await client.end()
    }
  }
})

integrationTest('concurrent same-key requests with different modes serialize and preserve the winner mode', async () => {
  const key = randomUUID()
  const argsA = createArgs('quiz_party', key)
  const argsB = createArgs('treasure_race', key)
  const coordinator = newClient('coord')
  const monitor = newClient('monitor')
  const clientA = newClient('racea')
  const clientB = newClient('raceb')
  const clients = [coordinator, monitor, clientA, clientB]
  let lockMaterial
  let pending
  try {
    await connectAll(clients)
    await verifyFixture(monitor)
    lockMaterial = await holdRoomCreationLock(coordinator, key)

    // Both RPCs must reach a blocked advisory lock before releasing the gate.
    // This makes the old check-before-lock race reproducible instead of hoping
    // that two short network calls happen to overlap.
    const argsByApp = new Map([
      [clientA, argsA],
      [clientB, argsB],
    ])
    pending = Promise.allSettled([
      createRoom(clientA, argsByApp.get(clientA)),
      createRoom(clientB, argsByApp.get(clientB)),
    ])
    const appNames = [`qpci-${runId}-racea`, `qpci-${runId}-raceb`]
    let waitError
    try {
      await waitForAdvisoryWaiters(monitor, appNames, 2)
    } catch (error) {
      waitError = error
    } finally {
      await releaseRoomCreationLock(coordinator, lockMaterial)
      lockMaterial = null
    }

    const outcomes = await pending
    pending = null
    if (waitError) throw waitError

    const successes = outcomes.filter((result) => result.status === 'fulfilled')
    const failures = outcomes.filter((result) => result.status === 'rejected')
    assert.equal(successes.length, 1, 'exactly one mode may create the room for this key')
    assert.equal(failures.length, 1, 'the conflicting mode must be rejected')
    assert.match(String(failures[0].reason?.message), /different game mode/i)

    const roomId = successes[0].value
    const winningArgs = roomId === argsA.p_room_id ? argsA : argsB
    assert.equal((await readRoom(monitor, roomId))?.game_mode, winningArgs.p_game_mode)
    const { rows } = await monitor.query(
      `select count(*)::int as count
       from public.game_action_claims
       where user_id = $1::uuid and request_id = $2::uuid and action = 'create_room'`,
      [hostId, key],
    )
    assert.equal(rows[0].count, 1)
  } finally {
    if (lockMaterial) await releaseRoomCreationLock(coordinator, lockMaterial)
    if (pending) await pending
    try {
      await cleanupRooms(coordinator, [argsA, argsB])
    } finally {
      await closeAll(clients)
    }
  }
})

integrationTest('concurrent independent room requests both succeed with their requested modes', async () => {
  const clientA = newClient('normal1')
  const clientB = newClient('normal2')
  const clients = [clientA, clientB]
  const argsA = createArgs('quiz_party')
  const argsB = createArgs('treasure_race')
  try {
    await connectAll(clients)
    await verifyFixture(clientA)
    const outcomes = await Promise.allSettled([
      createRoom(clientA, argsA),
      createRoom(clientB, argsB),
    ])
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 2)
    const [roomA, roomB] = outcomes.map((result) => {
      if (result.status === 'rejected') throw result.reason
      return result.value
    })
    assert.notEqual(roomA, roomB)
    assert.equal((await readRoom(clientA, roomA))?.game_mode, 'quiz_party')
    assert.equal((await readRoom(clientB, roomB))?.game_mode, 'treasure_race')
  } finally {
    try {
      await cleanupRooms(clientA, [argsA, argsB])
    } finally {
      await closeAll(clients)
    }
  }
})
