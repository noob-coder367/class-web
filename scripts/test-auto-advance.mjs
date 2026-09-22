import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getQuizQuestionProgress, shouldAutoAdvanceQuestion } from '../frontend/src/lib/classPlayAdvance.js'

const q4 = {
  answers: [
    { id: 'A', isCorrect: false },
    { id: 'B', isCorrect: false },
    { id: 'C', isCorrect: true },
    { id: 'D', isCorrect: false },
  ],
}

function progress(opts) {
  return getQuizQuestionProgress(q4, opts)
}

// --- Test 1: Multi Try OFF + Auto OFF ---
{
  const wrong = progress({ chosenId: 'A', allowMultiTry: false })
  assert.equal(wrong.questionCompleted, true)
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: false, questionCompleted: wrong.questionCompleted }), false)

  const right = progress({ chosenId: 'C', allowMultiTry: false })
  assert.equal(right.questionCompleted, true)
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: false, questionCompleted: right.questionCompleted }), false)
}

// --- Test 2: Multi Try OFF + Auto ON ---
{
  const wrong = progress({ chosenId: 'A', allowMultiTry: false })
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: wrong.questionCompleted }), true)
  const right = progress({ chosenId: 'C', allowMultiTry: false })
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: right.questionCompleted }), true)
}

// --- Test 3: Multi Try ON + Auto OFF ---
{
  const afterA = progress({ chosenId: 'A', triedIds: ['A'], allowMultiTry: true })
  assert.equal(afterA.pickedCorrect, false)
  assert.equal(afterA.exhausted, false)
  assert.equal(afterA.questionCompleted, false)
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: false, questionCompleted: afterA.questionCompleted }), false)

  const afterAB = progress({ chosenId: 'B', triedIds: ['A', 'B'], allowMultiTry: true })
  assert.equal(afterAB.questionCompleted, false)
  assert.equal(afterAB.untriedCount, 2)

  const afterCorrect = progress({ chosenId: 'C', triedIds: ['A', 'C'], allowMultiTry: true })
  assert.equal(afterCorrect.pickedCorrect, true)
  assert.equal(afterCorrect.questionCompleted, true)
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: false, questionCompleted: afterCorrect.questionCompleted }), false)

  const exhausted = progress({ chosenId: 'D', triedIds: ['A', 'B', 'D'], allowMultiTry: true })
  assert.equal(exhausted.exhausted, true)
  assert.equal(exhausted.pickedCorrect, false)
  assert.equal(exhausted.questionCompleted, true)
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: false, questionCompleted: exhausted.questionCompleted }), false)
}

// --- Test 4: Multi Try ON + Auto ON ---
{
  const afterA = progress({ chosenId: 'A', triedIds: ['A'], allowMultiTry: true })
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: afterA.questionCompleted }), false)

  const afterB = progress({ chosenId: 'B', triedIds: ['A', 'B'], allowMultiTry: true })
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: afterB.questionCompleted }), false)

  const afterCorrect = progress({ chosenId: 'C', triedIds: ['A', 'C'], allowMultiTry: true })
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: afterCorrect.questionCompleted }), true)

  const exhausted = progress({ chosenId: 'D', triedIds: ['A', 'B', 'D'], allowMultiTry: true })
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: exhausted.questionCompleted }), true)
}

// Câu 2 đáp án: sai lần đầu KHÔNG complete — vẫn còn đáp án chưa thử.
{
  const q2 = { answers: [{ id: 'A', isCorrect: false }, { id: 'B', isCorrect: true }] }
  const firstWrong = getQuizQuestionProgress(q2, { chosenId: 'A', triedIds: ['A'], allowMultiTry: true })
  assert.equal(firstWrong.exhausted, false)
  assert.equal(firstWrong.questionCompleted, false)
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: firstWrong.questionCompleted }), false)

  const thenCorrect = getQuizQuestionProgress(q2, { chosenId: 'B', triedIds: ['A', 'B'], allowMultiTry: true })
  assert.equal(thenCorrect.pickedCorrect, true)
  assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: thenCorrect.questionCompleted }), true)
}

// Anti-pattern guard: autoAdvance một mình không đủ để chuyển câu.
assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: true, questionCompleted: false }), false)
assert.equal(shouldAutoAdvanceQuestion({ autoAdvance: false, questionCompleted: true }), false)

const play = await readFile(new URL('../frontend/src/components/ClassPlayView.jsx', import.meta.url), 'utf8')
assert.match(play, /shouldAutoAdvanceQuestion/)
assert.match(play, /getQuizQuestionProgress/)
assert.match(play, /clearAutoAdvanceTimer/)
assert.equal(play.includes('if (allowMultiTry) {\n      if (!autoAdvanceMultiTry) return'), false)
assert.match(play, /i >= total - 1/)

const createPage = await readFile(new URL('../frontend/src/components/CreateClassPage.jsx', import.meta.url), 'utf8')
assert.equal(createPage.includes('disabled={!allowMultiTry}'), false)

const duckJs = await readFile(new URL('../frontend/src/components/UtilityToolsPanel.jsx', import.meta.url), 'utf8')
const duckCss = await readFile(new URL('../frontend/src/components/UtilityToolsPanel.css', import.meta.url), 'utf8')
assert.match(duckJs, /translate3d/)
assert.match(duckJs, /utility-duck-track/)
assert.match(duckCss, /utility-duck-track/)
assert.equal(duckCss.includes('transition: left'), false)
assert.match(duckCss, /utility-duck-visual/)

console.log('auto-advance: PASS — 4 combo multi-try/auto-skip + không skip khi còn đáp án')
