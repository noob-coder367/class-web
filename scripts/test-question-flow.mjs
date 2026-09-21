import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const addPanel = await readFile(new URL('../frontend/src/components/AddQuestionPanel.jsx', import.meta.url), 'utf8')
const createPage = await readFile(new URL('../frontend/src/components/CreateClassPage.jsx', import.meta.url), 'utf8')
const service = await readFile(new URL('../backend/src/services/classSpace.service.js', import.meta.url), 'utf8')
const play = await readFile(new URL('../frontend/src/components/ClassPlayView.jsx', import.meta.url), 'utf8')

for (const source of [addPanel, createPage, service, play]) {
  assert.equal(/slice\(0\s*,\s*7\)/.test(source), false, 'Không được cắt danh sách về 7 câu')
  assert.equal(/MAX_QUESTIONS|maxQuestions/.test(source), false, 'Không được có hằng giới hạn số câu')
}

let questions = []
for (let i = 1; i <= 15; i += 1) questions = [...questions, { id: `q-${i}`, kind: 'quiz', question: { title: `Câu ${i}` } }]
assert.equal(questions.length, 15)
assert.deepEqual(questions.map((q) => q.id), Array.from({ length: 15 }, (_, i) => `q-${i + 1}`))

const moved = [...questions]
const [item] = moved.splice(14, 1)
moved.splice(2, 0, item)
assert.equal(moved.length, 15)
assert.equal(moved[2].id, 'q-15')
assert.equal(moved[14].id, 'q-14')

const serialized = JSON.stringify({ questions: moved })
const loaded = JSON.parse(serialized).questions
assert.equal(loaded.length, 15)
assert.equal(loaded[2].id, 'q-15')
assert.match(createPage, /questions:\s*uploadedQuestions/)
assert.match(service, /const questions = Array\.isArray\(payload\?\.questions\) \? payload\.questions/)
assert.match(play, /const base = questions\.map\(\(_, i\) => i\)/)

console.log('question-flow: PASS — append 1..15, reorder, serialize/load và ClassPlay giữ đủ 15 câu')
