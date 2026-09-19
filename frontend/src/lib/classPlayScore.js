export function normalizeAnswer(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function essayKeys(question) {
  const answers = question?.answers || []
  const marked = answers.filter((a) => a.isCorrect && String(a.content || '').trim())
  const pool = marked.length ? marked : answers.filter((a) => String(a.content || '').trim())
  return pool.map((a) => normalizeAnswer(a.content)).filter(Boolean)
}

/**
 * Điểm phòng:
 * - 1 câu trắc nghiệm đúng = 1 điểm
 * - 1 ý đúng/sai đúng = 1 điểm
 * - 1 câu tự luận đúng = 1 điểm
 * Tổng mẫu số = số câu trắc nghiệm + số ý đúng/sai + số câu tự luận.
 */
export function gradeClassPlay(
  questions,
  { selections = {}, quizTried = {}, essayDrafts = {}, tfSelections = {}, allowMultiTry = false } = {}
) {
  let correct = 0
  let total = 0

  for (const entry of questions || []) {
    if (entry.kind === 'quiz') {
      total += 1
      const answers = entry.question?.answers || []
      const ok = allowMultiTry
        ? answers.some((a) => a.isCorrect && (quizTried[entry.id] || []).includes(a.id))
        : !!(selections[entry.id] && answers.find((a) => a.id === selections[entry.id])?.isCorrect)
      if (ok) correct += 1
    } else if (entry.kind === 'truefalse') {
      const statements = (entry.question?.statements || []).filter((s) => String(s.content || '').trim())
      const chosen = tfSelections[entry.id] || {}
      for (const statement of statements) {
        total += 1
        if (chosen[statement.id] === statement.isTrue) correct += 1
      }
    } else if (entry.kind === 'essay') {
      total += 1
      const keys = essayKeys(entry.question)
      if (keys.length && keys.includes(normalizeAnswer(essayDrafts[entry.id]))) correct += 1
    }
  }

  return { correct, total }
}

export function isRoomCompletedLocked(cls) {
  return cls?.allowRetry === false && !!cls?.myResult
}
