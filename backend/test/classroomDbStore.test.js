import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ||= 'https://test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.FRONTEND_ORIGIN ||= 'http://localhost:5173'
process.env.SECRET_CODE ||= 'test-secret'

const { createClassroomDbStore } = await import('../src/utils/classroomDbStore.js')

class FakeSupabase {
  constructor(initial = null) {
    this.record = initial ? { ...initial } : null
    this.failNext = null
    this.readDelay = 0
  }

  from(table) {
    assert.equal(table, 'classroom_store')
    return new FakeQuery(this)
  }
}

class FakeQuery {
  constructor(db) {
    this.db = db
    this.operation = null
    this.payload = null
    this.filters = []
  }

  select() { return this }
  insert(payload) { this.operation = 'insert'; this.payload = payload; return this }
  update(payload) { this.operation = 'update'; this.payload = payload; return this }
  eq(column, value) { this.filters.push([column, value]); return this }
  maybeSingle() { return this }

  async then(resolve, reject) {
    try {
      const result = await this.run()
      resolve(result)
    } catch (error) {
      reject(error)
    }
  }

  matches(record) {
    return this.filters.every(([column, value]) => record?.[column] === value)
  }

  async run() {
    if (this.db.readDelay) await new Promise((resolve) => setTimeout(resolve, this.db.readDelay))
    if (this.db.failNext) {
      const error = this.db.failNext
      this.db.failNext = null
      return { data: null, error }
    }
    if (this.operation === 'insert') {
      if (this.db.record) return { data: null, error: { code: '23505', message: 'duplicate key' } }
      this.db.record = { ...this.payload, updated_at: new Date().toISOString() }
      return { data: { ...this.db.record }, error: null }
    }
    if (this.operation === 'update') {
      if (!this.db.record || !this.matches(this.db.record)) return { data: null, error: null }
      this.db.record = { ...this.db.record, ...this.payload }
      return { data: { version: this.db.record.version, updated_at: this.db.record.updated_at }, error: null }
    }
    return { data: this.db.record ? { ...this.db.record } : null, error: null }
  }
}

function storeWith(record) {
  const db = new FakeSupabase(record)
  return { db, store: createClassroomDbStore({ client: db, readJson: async () => ({}) }) }
}

test('đọc ghost-state thành công', async () => {
  const { store } = storeWith({ key: 'ghost-state', value: { nextIndex: 3, created: [], reserved: [] }, version: 4 })
  assert.deepEqual(await store.readStore({ key: 'ghost-state', empty: {} }), { nextIndex: 3, created: [], reserved: [] })
})

test('DB lỗi khi đọc không fallback thành empty state', async () => {
  const { db, store } = storeWith(null)
  db.failNext = { code: '42501', message: 'permission denied' }
  await assert.rejects(store.readStore({ key: 'ghost-state', empty: { nextIndex: 1, created: [] } }), (error) => error.code === 'PERMISSION_DENIED' && error.status === 503)
})

test('ghi ghost-state thành công dùng version kế tiếp', async () => {
  const { db, store } = storeWith({ key: 'ghost-state', value: { nextIndex: 1, created: [], reserved: [] }, version: 1 })
  await store.writeStore({ key: 'ghost-state', value: { nextIndex: 2, created: [], reserved: [] }, expectedVersion: 1 })
  assert.equal(db.record.version, 2)
  assert.equal(db.record.value.nextIndex, 2)
})

test('version conflict trả lỗi 409 và không overwrite dữ liệu mới', async () => {
  const { db, store } = storeWith({ key: 'ghost-state', value: { nextIndex: 8 }, version: 2 })
  await assert.rejects(store.writeStore({ key: 'ghost-state', value: { nextIndex: 9 }, expectedVersion: 1 }), (error) => error.code === 'VERSION_CONFLICT' && error.status === 409)
  assert.equal(db.record.value.nextIndex, 8)
})

test('concurrent mutation retry không làm mất increment', async () => {
  const { db, store } = storeWith({ key: 'username-changes', value: { user: [1] }, version: 1 })
  db.readDelay = 1
  await Promise.all([
    store.updateStore('username-changes', (value) => ({ ...value, user: [...value.user, 2] }), { label: 'lịch sử đổi tên' }),
    store.updateStore('username-changes', (value) => ({ ...value, user: [...value.user, 3] }), { label: 'lịch sử đổi tên' }),
  ])
  assert.deepEqual(db.record.value.user.sort(), [1, 2, 3])
})

test('username history concurrent update giữ đủ hai entry', async () => {
  const { db, store } = storeWith({ key: 'username-changes', value: { user: [] }, version: 1 })
  await Promise.all([2, 3].map((stamp) => store.updateStore('username-changes', (value) => ({ ...value, user: [...(value.user || []), stamp] }), { label: 'lịch sử đổi tên' })))
  assert.deepEqual(db.record.value.user.sort(), [2, 3])
})

test('khởi động lại store đọc lại state đã persisted', async () => {
  const { db, store } = storeWith({ key: 'ghost-state', value: { nextIndex: 5, created: [{ at: Date.now() }] }, version: 9 })
  const first = await store.readStore({ key: 'ghost-state', empty: {} })
  const restarted = createClassroomDbStore({ client: db, readJson: async () => ({}) })
  const second = await restarted.readStore({ key: 'ghost-state', empty: {} })
  assert.deepEqual(second, first)
})

test('ghost registration không tạo account marker khi final persistence thất bại', async () => {
  const { db, store } = storeWith({ key: 'ghost-state', value: { nextIndex: 1, created: [], reserved: [] }, version: 1 })
  await store.updateStore('ghost-state', (value) => ({ ...value, nextIndex: 2, reserved: [{ id: 'r1', index: 1, at: Date.now() }] }))
  db.failNext = { code: '42501', message: 'permission denied' }
  await assert.rejects(store.updateStore('ghost-state', () => { throw new Error('simulated profile failure') }))
  const state = await store.readStore({ key: 'ghost-state', empty: {} })
  assert.deepEqual(state.created, [])
  assert.equal(state.reserved.length, 1)
})

test('ghost registration thành công chỉ ghi created sau khi persistence OK', async () => {
  const { store } = storeWith({ key: 'ghost-state', value: { nextIndex: 2, created: [], reserved: [{ id: 'r2', index: 1, at: Date.now() }] }, version: 1 })
  await store.updateStore('ghost-state', (value) => ({
    ...value,
    reserved: value.reserved.filter((item) => item.id !== 'r2'),
    created: [...value.created, { index: 1, userId: 'u1', at: Date.now() }],
  }))
  const state = await store.readStore({ key: 'ghost-state', empty: {} })
  assert.equal(state.created[0].userId, 'u1')
  assert.deepEqual(state.reserved, [])
})

test('username history mutation enforces two changes per rolling week', async () => {
  const { store } = storeWith({ key: 'username-changes', value: { user: [Date.now() - 1000] }, version: 1 })
  await store.updateStore('username-changes', (value) => ({ ...value, user: [...value.user, Date.now()] }))
  const current = await store.readStore({ key: 'username-changes', empty: {} })
  assert.equal(current.user.length, 2)
  await assert.rejects(store.updateStore('username-changes', (value) => {
    if (value.user.length >= 2) throw new Error('weekly limit')
    return value
  }))
})
