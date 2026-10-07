import test from 'node:test'
import assert from 'node:assert/strict'

// env.js đọc process.env lúc import -> đặt key giả TRƯỚC khi import app (dynamic import).
process.env.GROQ_API_KEY = 'test-key-not-real'
const { createApp } = await import('../src/app.js')
const { supabaseAdmin } = await import('../src/config/supabaseClient.js')

const jwt = (amr) => `h.${Buffer.from(JSON.stringify({ amr })).toString('base64url')}.s`
const GOOGLE_A = { token: jwt([{ method: 'oauth' }]), user: { id: '11111111-1111-4111-8111-111111111111', identities: [{ provider: 'google' }] } }
const GOOGLE_B = { token: jwt([{ method: 'oauth', timestamp: 2 }]), user: { id: '22222222-2222-4222-8222-222222222222', identities: [{ provider: 'google' }] } }
const EMAIL = { token: jwt([{ method: 'password' }]), user: { id: '33333333-3333-4333-8333-333333333333', identities: [{ provider: 'email' }], user_metadata: { provider: 'google' } } }
const accounts = new Map([GOOGLE_A, GOOGLE_B, EMAIL].map((account) => [account.token, account.user]))

// ---- Mock Supabase (không gọi mạng) ----
const db = { quizzes: new Map(), questions: new Map(), rpcCalls: 0 }
supabaseAdmin.auth.getUser = async (token) => (
  accounts.has(token) ? { data: { user: accounts.get(token) }, error: null } : { data: { user: null }, error: { message: 'invalid' } }
)
supabaseAdmin.rpc = async (name, args) => {
  db.rpcCalls += 1
  assert.equal(name, 'save_quiz_with_questions')
  const existing = db.quizzes.get(args.p_quiz_id)
  if (existing && existing.owner_id !== args.p_owner_id) return { data: null, error: { code: '42501' } }
  db.quizzes.set(args.p_quiz_id, { id: args.p_quiz_id, owner_id: args.p_owner_id, title: args.p_title, description: args.p_description, status: 'draft' })
  db.questions.set(args.p_quiz_id, args.p_questions.map((question, index) => ({ id: `q${index}`, order_index: index, ...question })))
  return { data: args.p_quiz_id, error: null }
}
supabaseAdmin.from = (table) => {
  const filters = {}
  let op = 'select'
  const rows = () => {
    if (table === 'profiles') return [{ id: filters.id, email: 'user@test.dev', role: 'user', full_name: 'Test' }]
    if (table === 'quizzes') {
      const all = [...db.quizzes.values()].filter((row) => Object.entries(filters).every(([column, value]) => row[column] === value))
      if (op === 'delete') all.forEach((row) => db.quizzes.delete(row.id))
      return all
    }
    if (table === 'questions') return db.questions.get(filters.quiz_id) || []
    return []
  }
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    delete: () => { op = 'delete'; return builder },
    eq: (column, value) => { filters[column] = value; return builder },
    maybeSingle: async () => ({ data: rows()[0] || null, error: null }),
    then: (resolve, reject) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
  }
  return builder
}

// ---- Mock Groq (chỉ chặn request tới groq.com) ----
const realFetch = globalThis.fetch
let groqReply = () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '' } }] }) })
globalThis.fetch = (url, init) => (String(url).includes('api.groq.com') ? Promise.resolve(groqReply(init)) : realFetch(url, init))
const aiContent = (content) => () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) })
const GOOD_AI = { questions: [{ type: 'true_false', content: 'Gia tốc của CĐTBĐ không đổi.', correct_answer: true, explanation: 'Đúng.' }] }
const SOURCE = 'Chuyển động thẳng biến đổi đều là chuyển động có gia tốc không đổi theo thời gian.'

const server = createApp().listen(0)
const baseUrl = await new Promise((resolve) => server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)))
test.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))))

async function call(path, { token, method = 'GET', json, raw, headers = {} } = {}) {
  const response = await realFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(raw !== undefined ? { 'Content-Type': 'application/octet-stream' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : raw,
  })
  let body = null
  try { body = await response.json() } catch { /* no body */ }
  return { status: response.status, body }
}

const QUIZ_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const validQuiz = () => ({
  title: 'Vật lý 10',
  description: '',
  owner_id: 'attacker-controlled',
  questions: [
    { type: 'multiple_choice', content: '1+1?', options: ['1', '2', '3', '4'], correct_option: 1 },
    { type: 'true_false', content: 'Trái đất tròn', correct_boolean: true },
    { type: 'essay', content: 'Giải thích?', reference_answer: 'Vì...' },
  ],
})

test('chưa đăng nhập hoặc token sai bị từ chối', async () => {
  for (const [method, path] of [['GET', '/api/quizzes'], ['PUT', `/api/quizzes/${QUIZ_ID}`], ['POST', '/api/ai/generate-questions'], ['GET', '/api/quizzes/access']]) {
    assert.equal((await call(path, { method })).status, 401, `${method} ${path}`)
    assert.equal((await call(path, { method, token: 'fake.token.value' })).status, 401, `${method} ${path} (bad token)`)
  }
  assert.equal(db.rpcCalls, 0)
})

test('tài khoản email/password KHÔNG được tạo/sửa/xem phòng hay dùng AI (dù user_metadata ghi google)', async () => {
  const access = await call('/api/quizzes/access', { token: EMAIL.token })
  assert.equal(access.status, 200)
  assert.equal(access.body.can_create_quiz, false)
  assert.equal(access.body.provider, 'email')

  const attempts = [
    ['GET', '/api/quizzes'],
    ['POST', '/api/quizzes', validQuiz()],
    ['PUT', `/api/quizzes/${QUIZ_ID}`, validQuiz()],
    ['DELETE', `/api/quizzes/${QUIZ_ID}`],
    ['POST', '/api/ai/generate-questions', { text: SOURCE }],
  ]
  for (const [method, path, json] of attempts) {
    const result = await call(path, { method, token: EMAIL.token, json })
    assert.equal(result.status, 403, `${method} ${path}`)
    assert.equal(result.body.code, 'google_required')
  }
  assert.equal(db.rpcCalls, 0)
})

test('Google user được tạo phòng; owner lấy từ session, bỏ qua owner_id trong body', async () => {
  const access = await call('/api/quizzes/access', { token: GOOGLE_A.token })
  assert.deepEqual([access.body.can_create_quiz, access.body.provider], [true, 'google'])

  const saved = await call(`/api/quizzes/${QUIZ_ID}`, { method: 'PUT', token: GOOGLE_A.token, json: validQuiz() })
  assert.equal(saved.status, 200)
  assert.equal(db.quizzes.get(QUIZ_ID).owner_id, GOOGLE_A.user.id)
  assert.deepEqual(saved.body.quiz.questions.map((q) => q.order_index), [0, 1, 2])
  assert.equal(saved.body.quiz.questions[0].correct_option, 1)

  const created = await call('/api/quizzes', { method: 'POST', token: GOOGLE_A.token, json: validQuiz() })
  assert.equal(created.status, 201)
  assert.notEqual(created.body.quiz.id, QUIZ_ID)
})

test('lưu 2 lần cùng id (double click) không tạo bản sao', async () => {
  const before = db.quizzes.size
  const [one, two] = await Promise.all([
    call(`/api/quizzes/${QUIZ_ID}`, { method: 'PUT', token: GOOGLE_A.token, json: validQuiz() }),
    call(`/api/quizzes/${QUIZ_ID}`, { method: 'PUT', token: GOOGLE_A.token, json: validQuiz() }),
  ])
  assert.deepEqual([one.status, two.status], [200, 200])
  assert.equal(db.quizzes.size, before)
  assert.equal(db.questions.get(QUIZ_ID).length, 3)
})

test('dữ liệu sai không chạm DB: thiếu đáp án đúng, true/false thiếu đáp án, không câu hỏi, id sai', async () => {
  const calls = db.rpcCalls
  const mutate = (change) => { const quiz = validQuiz(); change(quiz); return quiz }
  const bodies = [
    mutate((q) => { q.questions[0].correct_option = null }),
    mutate((q) => { delete q.questions[1].correct_boolean }),
    mutate((q) => { q.questions = [] }),
    mutate((q) => { q.title = '   ' }),
  ]
  for (const json of bodies) {
    const result = await call(`/api/quizzes/${QUIZ_ID}`, { method: 'PUT', token: GOOGLE_A.token, json })
    assert.equal(result.status, 400)
  }
  assert.equal((await call('/api/quizzes/not-a-uuid', { method: 'PUT', token: GOOGLE_A.token, json: validQuiz() })).status, 400)
  assert.equal(db.rpcCalls, calls)
})

test('ownership: user khác không sửa/xem/xoá được phòng của chủ', async () => {
  const edit = await call(`/api/quizzes/${QUIZ_ID}`, { method: 'PUT', token: GOOGLE_B.token, json: { ...validQuiz(), title: 'hijack' } })
  assert.equal(edit.status, 403)
  assert.equal(db.quizzes.get(QUIZ_ID).title, 'Vật lý 10')
  assert.equal((await call(`/api/quizzes/${QUIZ_ID}`, { token: GOOGLE_B.token })).status, 404)
  assert.equal((await call(`/api/quizzes/${QUIZ_ID}`, { method: 'DELETE', token: GOOGLE_B.token })).status, 404)
  assert.equal(db.quizzes.has(QUIZ_ID), true)
  assert.equal((await call(`/api/quizzes/${QUIZ_ID}`, { token: GOOGLE_A.token })).status, 200)
  assert.equal((await call(`/api/quizzes/${QUIZ_ID}`, { method: 'DELETE', token: GOOGLE_A.token })).status, 204)
  assert.equal(db.quizzes.has(QUIZ_ID), false)
})

test('AI: text hợp lệ trả preview và KHÔNG ghi DB', async () => {
  const writes = db.rpcCalls
  groqReply = aiContent(GOOD_AI)
  const result = await call('/api/ai/generate-questions', { method: 'POST', token: GOOGLE_A.token, json: { text: SOURCE, count: 5, types: ['true_false'] } })
  assert.equal(result.status, 200)
  assert.equal(result.body.questions[0].correct_boolean, true)
  assert.equal(result.body.source.kind, 'text')
  assert.equal(db.rpcCalls, writes)
})

test('AI: lỗi được map rõ ràng (output hỏng, nguồn rỗng, quá nhiều câu, provider lỗi)', async () => {
  groqReply = aiContent({ nonsense: true })
  let result = await call('/api/ai/generate-questions', { method: 'POST', token: GOOGLE_A.token, json: { text: SOURCE } })
  assert.deepEqual([result.status, result.body.code], [502, 'invalid_ai_output'])

  result = await call('/api/ai/generate-questions', { method: 'POST', token: GOOGLE_A.token, json: { text: '   ' } })
  assert.deepEqual([result.status, result.body.code], [422, 'insufficient_content'])

  result = await call('/api/ai/generate-questions', { method: 'POST', token: GOOGLE_A.token, json: { text: SOURCE, count: 500 } })
  assert.deepEqual([result.status, result.body.code], [400, 'too_many_questions'])

  groqReply = () => ({ ok: false, status: 500, json: async () => ({}) })
  result = await call('/api/ai/generate-questions', { method: 'POST', token: GOOGLE_A.token, json: { text: SOURCE } })
  assert.deepEqual([result.status, result.body.code], [503, 'ai_unavailable'])
  assert.doesNotMatch(JSON.stringify(result.body), /test-key-not-real/)
})

test('AI: upload file TXT hợp lệ; file sai loại / quá lớn bị từ chối', async () => {
  groqReply = aiContent(GOOD_AI)
  const headers = { 'X-File-Name': encodeURIComponent('bai-hoc.txt') }
  const ok = await call('/api/ai/generate-questions?count=3', { method: 'POST', token: GOOGLE_A.token, raw: Buffer.from(SOURCE), headers })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.source.kind, 'txt')

  const exe = await call('/api/ai/generate-questions', { method: 'POST', token: GOOGLE_A.token, raw: Buffer.from('MZ binary'), headers: { 'X-File-Name': 'virus.exe' } })
  assert.deepEqual([exe.status, exe.body.code], [415, 'unsupported_file'])

  const fakePdf = await call('/api/ai/generate-questions', { method: 'POST', token: GOOGLE_A.token, raw: Buffer.from('this is not a pdf'), headers: { 'X-File-Name': 'a.pdf' } })
  assert.equal(fakePdf.status, 415)

  const big = await call('/api/ai/generate-questions', { method: 'POST', token: GOOGLE_A.token, raw: Buffer.alloc(9 * 1024 * 1024, 65), headers })
  assert.equal(big.status, 413)
})
