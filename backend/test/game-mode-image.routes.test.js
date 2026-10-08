import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'
const { createApp } = await import('../src/app.js')
const { supabaseAdmin } = await import('../src/config/supabaseClient.js')

const ADMIN_TOKEN = 'valid-admin-token'
const USER_TOKEN = 'valid-user-token'
const users = new Map([
  [ADMIN_TOKEN, { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'admin@example.test', role: 'admin' }],
  [USER_TOKEN, { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'user@example.test', role: 'user' }],
])
const profiles = new Map([...users.values()].map((user) => [user.id, user]))
const imageRows = new Map()
const storedObjects = new Map()
let uploadCalls = 0

supabaseAdmin.auth.getUser = async (token) => {
  const user = users.get(token)
  return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid token' } }
}
supabaseAdmin.from = (table) => {
  const filters = {}
  let action = 'select'
  let values = null
  const builder = {
    select: () => builder,
    eq: (column, value) => { filters[column] = value; return builder },
    upsert: (row) => { action = 'upsert'; values = row; return builder },
    update: (row) => { action = 'update'; values = row; return builder },
    delete: () => { action = 'delete'; return builder },
    maybeSingle: async () => {
      if (table === 'profiles') return { data: profiles.get(filters.id) || null, error: null }
      if (table === 'game_mode_images') return { data: imageRows.get(filters.game_key) || null, error: null }
      return { data: null, error: null }
    },
    single: async () => {
      if (table === 'game_mode_images' && action === 'upsert') {
        const row = { ...imageRows.get(values.game_key), ...values, updated_at: new Date().toISOString() }
        imageRows.set(row.game_key, row)
        return { data: row, error: null }
      }
      return { data: null, error: null }
    },
    then: (resolve, reject) => {
      if (table === 'game_mode_images' && action === 'delete') imageRows.delete(filters.game_key)
      if (table === 'game_mode_images' && action === 'update') imageRows.set(filters.game_key, { ...imageRows.get(filters.game_key), ...values })
      return Promise.resolve({ data: null, error: null }).then(resolve, reject)
    },
  }
  return builder
}
supabaseAdmin.storage.from = (bucket) => ({
  upload: async (path, bytes, options) => {
    uploadCalls += 1
    assert.equal(bucket, 'game-images')
    storedObjects.set(path, { bytes: Buffer.from(bytes), contentType: options.contentType })
    return { data: { path }, error: null }
  },
  remove: async (paths) => {
    paths.forEach((path) => storedObjects.delete(path))
    return { data: paths.map((path) => ({ name: path })), error: null }
  },
  getPublicUrl: (path) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
})

const server = createApp().listen(0)
const baseUrl = await new Promise((resolve) => server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)))
test.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))))

async function call(path, { token, method = 'GET', bytes, json, contentType = 'image/png' } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(bytes ? { 'Content-Type': contentType } : {}),
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : bytes,
  })
  let body = null
  try { body = await response.json() } catch { /* no response body */ }
  return { status: response.status, body }
}
const validPng = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const endpoint = '/api/admin/game-mode-images/treasure-race'

test('upload/delete ảnh Game Mode chỉ đi qua API admin có xác thực', async () => {
  const deniedUpload = await call(endpoint, { method: 'PUT', token: USER_TOKEN, bytes: validPng() })
  assert.equal(deniedUpload.status, 403)
  const deniedDelete = await call(endpoint, { method: 'DELETE', token: USER_TOKEN })
  assert.equal(deniedDelete.status, 403)
  assert.equal((await call(endpoint, { method: 'PATCH', token: USER_TOKEN, json: { display_title: 'X', display_note: '', text_color: '#FFFFFF' } })).status, 403)
  assert.equal(uploadCalls, 0)

  const settings = await call(endpoint, { method: 'PATCH', token: ADMIN_TOKEN, json: { display_title: 'Đua kho báu', display_note: 'Ghi chú mẫu', overlay_content: 'Nội dung phủ ảnh', text_color: '#F4D35E' } })
  assert.equal(settings.status, 200)
  assert.equal(settings.body.image.image_path, null)
  assert.equal(settings.body.image.display_title, 'Đua kho báu')
  assert.equal(settings.body.image.display_note, 'Ghi chú mẫu')
  assert.equal(settings.body.image.overlay_content, 'Nội dung phủ ảnh')
  assert.equal(settings.body.image.text_color, '#F4D35E')
  const invalidColor = await call(endpoint, { method: 'PATCH', token: ADMIN_TOKEN, json: { display_title: 'Tên', display_note: '', text_color: 'red' } })
  assert.equal(invalidColor.status, 400)
  const longOverlay = await call(endpoint, { method: 'PATCH', token: ADMIN_TOKEN, json: { display_title: 'Tên', display_note: '', overlay_content: 'x'.repeat(301), text_color: '#FFFFFF' } })
  assert.equal(longOverlay.status, 400)

  const firstUpload = await call(endpoint, { method: 'PUT', token: ADMIN_TOKEN, bytes: validPng() })
  assert.equal(firstUpload.status, 200)
  assert.match(firstUpload.body.image.image_url, /storage\/v1\/object\/public\/game-images\/treasure-race\//)
  const firstPath = firstUpload.body.image.image_path
  assert.equal(storedObjects.has(firstPath), true)
  assert.equal(imageRows.get('treasure-race').image_path, firstPath)
  assert.equal(firstUpload.body.image.display_title, 'Đua kho báu')
  assert.equal(firstUpload.body.image.overlay_content, 'Nội dung phủ ảnh')
  assert.equal(firstUpload.body.image.text_color, '#F4D35E')

  const invalidImage = await call(endpoint, { method: 'PUT', token: ADMIN_TOKEN, bytes: Buffer.from('not an image') })
  assert.equal(invalidImage.status, 415)
  assert.equal(uploadCalls, 1)

  const replacement = await call(endpoint, { method: 'PUT', token: ADMIN_TOKEN, bytes: validPng() })
  assert.equal(replacement.status, 200)
  assert.notEqual(replacement.body.image.image_path, firstPath)
  assert.equal(storedObjects.has(firstPath), false)

  const deleted = await call(endpoint, { method: 'DELETE', token: ADMIN_TOKEN })
  assert.equal(deleted.status, 200)
  assert.equal(deleted.body.deleted, true)
  assert.equal(imageRows.get('treasure-race').image_path, null)
  assert.equal(imageRows.get('treasure-race').display_note, 'Ghi chú mẫu')
  assert.equal(imageRows.get('treasure-race').overlay_content, 'Nội dung phủ ảnh')
  assert.equal(storedObjects.size, 0)
})

test('upload rejects unauthenticated requests and unsafe Game Mode keys', async () => {
  assert.equal((await call(endpoint, { method: 'PUT', bytes: validPng() })).status, 401)
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1)
  oversized.set(validPng())
  const tooLarge = await call(endpoint, { method: 'PUT', token: ADMIN_TOKEN, bytes: oversized })
  assert.equal(tooLarge.status, 413)
  assert.equal((await call('/api/admin/game-mode-images/../private', { method: 'PUT', token: ADMIN_TOKEN, bytes: validPng() })).status >= 400, true)
})
