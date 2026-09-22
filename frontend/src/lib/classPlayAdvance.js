/**
 * Trạng thái một câu trắc nghiệm khi đang làm bài.
 *
 * allowMultiTry = false
 *   → question complete ngay khi đã chọn 1 đáp án (đúng hoặc sai).
 * allowMultiTry = true
 *   → question complete khi trả lời ĐÚNG, hoặc đã hết đáp án để thử.
 *
 * "Hết đáp án để thử" = đã chọn hết mọi đáp án SAI, nên hiện đáp án đúng.
 * Tuyệt đối không complete chỉ vì lần SAI đầu tiên khi vẫn còn đáp án chưa thử
 * (kể cả câu chỉ có 2 đáp án: sai 1 lần vẫn được chọn tiếp).
 *
 * Auto-advance CHỈ được gọi khi questionCompleted && autoAdvance.
 * Không được gọi goNext() chỉ vì người chơi vừa chọn sai một đáp án.
 */

function uniqueIds(ids) {
  const seen = new Set()
  const next = []
  for (const id of ids || []) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}

export function getQuizQuestionProgress(question, { chosenId, triedIds, allowMultiTry } = {}) {
  const answers = Array.isArray(question?.answers) ? question.answers : []
  const hasKey = answers.some((a) => a.isCorrect)
  const fromTried = uniqueIds(triedIds)
  const tried = allowMultiTry
    ? fromTried.length
      ? fromTried
      : chosenId
        ? [chosenId]
        : []
    : chosenId
      ? [chosenId]
      : []
  const triedSet = new Set(tried)

  const pickedCorrect = hasKey && answers.some((a) => a.isCorrect && triedSet.has(a.id))
  const untried = answers.filter((a) => !triedSet.has(a.id))
  const untriedWrong = untried.filter((a) => !a.isCorrect)
  const wrongCount = tried.filter((id) => {
    const answer = answers.find((item) => item.id === id)
    return answer && !answer.isCorrect
  }).length
  const wrongTotal = answers.filter((a) => !a.isCorrect).length
  const allWrongsTried = untriedWrong.length === 0 && wrongTotal > 0 && wrongCount >= wrongTotal

  // Còn đáp án chưa thử (kể cả đáp án đúng còn lại sau 1 lần sai) → chưa exhausted.
  // Exhausted khi: không còn ô nào chưa chọn, hoặc đã SAI hết mọi đáp án sai
  // và không phải lần sai đầu tiên của câu 2 đáp án.
  const exhausted =
    allowMultiTry === true &&
    hasKey &&
    answers.length > 0 &&
    tried.length > 0 &&
    !pickedCorrect &&
    (untried.length === 0 || (allWrongsTried && (wrongCount >= 2 || untried.length === 0)))

  const questionCompleted = allowMultiTry === true ? pickedCorrect || exhausted : tried.length > 0

  return {
    answers,
    hasKey,
    tried,
    pickedCorrect,
    exhausted,
    wrongCount,
    untriedCount: untried.length,
    questionCompleted,
    revealed: hasKey && questionCompleted,
    locked: allowMultiTry === true ? pickedCorrect || exhausted : tried.length > 0,
  }
}

export function shouldAutoAdvanceQuestion({ autoAdvance, questionCompleted } = {}) {
  return autoAdvance === true && questionCompleted === true
}
