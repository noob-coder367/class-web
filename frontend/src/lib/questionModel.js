/**
 * Mô hình câu hỏi phía frontend (thuần JS, không phụ thuộc React để dễ test).
 *
 * Mỗi câu hỏi trong state luôn mang đủ các trường của cả 3 loại; `type` quyết định trường nào
 * được dùng/hiển thị/gửi lên. Nhờ vậy đổi loại không làm mất dữ liệu: đổi lại là khôi phục.
 */
export const QUESTION_TYPES = Object.freeze(['multiple_choice', 'essay', 'true_false'])

export const TYPE_LABELS = Object.freeze({
  multiple_choice: 'Trắc nghiệm',
  essay: 'Tự luận',
  true_false: 'Đúng / Sai',
})

export const LIMITS = Object.freeze({
  TITLE_MAX: 120,
  DESCRIPTION_MAX: 500,
  QUESTIONS_MAX: 100,
  CONTENT_MAX: 1000,
  OPTION_MAX: 300,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 8,
  ANSWER_MAX: 2000,
  EXPLANATION_MAX: 1000,
})

let counter = 0
export function newKey() {
  const id = globalThis.crypto?.randomUUID?.()
  if (id) return id
  counter += 1
  return `k-${Date.now().toString(36)}-${counter.toString(36)}`
}

export const optionLetter = (index) => String.fromCharCode(65 + index)

const blankOptions = () => ['', '', '', '']

/** Tạo câu hỏi trong state từ type + dữ liệu có sẵn (AI / server / rỗng). */
export function createQuestion(type = 'multiple_choice', seed = {}) {
  const options = Array.isArray(seed.options) && seed.options.length >= LIMITS.OPTIONS_MIN
    ? seed.options.map((option) => String(option ?? ''))
    : blankOptions()
  return {
    key: seed.key || newKey(),
    type: QUESTION_TYPES.includes(type) ? type : 'multiple_choice',
    content: String(seed.content ?? ''),
    explanation: String(seed.explanation ?? ''),
    options,
    correct_option: Number.isInteger(seed.correct_option) ? seed.correct_option : null,
    correct_boolean: typeof seed.correct_boolean === 'boolean' ? seed.correct_boolean : null,
    reference_answer: String(seed.reference_answer ?? ''),
  }
}

export const questionFromApi = (question) => createQuestion(question.type, question)

/** Trả về cảnh báo nếu đổi loại làm dữ liệu hiện tại không còn được dùng; null nếu an toàn. */
export function describeTypeChange(question, nextType) {
  if (question.type === nextType) return null
  if (question.type === 'multiple_choice') {
    if (question.options.some((option) => option.trim()) || question.correct_option !== null) {
      return 'Các đáp án và đáp án đúng của câu trắc nghiệm sẽ không được dùng cho loại mới.'
    }
  } else if (question.type === 'true_false') {
    if (question.correct_boolean !== null) return 'Đáp án Đúng/Sai hiện tại sẽ không được dùng cho loại mới.'
  } else if (question.reference_answer.trim()) {
    return 'Đáp án tham khảo của câu tự luận sẽ không được dùng cho loại mới.'
  }
  return null
}

export function changeQuestionType(question, nextType) {
  if (!QUESTION_TYPES.includes(nextType) || question.type === nextType) return question
  const next = { ...question, type: nextType }
  if (nextType === 'multiple_choice' && next.options.length < LIMITS.OPTIONS_MIN) next.options = blankOptions()
  return next
}

/** Dữ liệu gửi lên API: chỉ các trường đúng với loại câu hỏi. */
export function toPayloadQuestion(question) {
  const base = { type: question.type, content: question.content.trim(), explanation: question.explanation.trim() }
  if (question.type === 'multiple_choice') {
    return { ...base, options: question.options.map((option) => option.trim()), correct_option: question.correct_option }
  }
  if (question.type === 'true_false') return { ...base, correct_boolean: question.correct_boolean }
  return { ...base, reference_answer: question.reference_answer.trim() }
}

export function toPayload(draft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    questions: draft.questions.map(toPayloadQuestion),
  }
}

/** Kiểm tra 1 câu hỏi (khớp luật server). Trả về thông báo lỗi hoặc null. */
export function validateQuestion(question) {
  const content = question.content.trim()
  if (!content) return 'Hãy nhập nội dung câu hỏi.'
  if (content.length > LIMITS.CONTENT_MAX) return `Nội dung tối đa ${LIMITS.CONTENT_MAX} ký tự.`
  if (question.explanation.trim().length > LIMITS.EXPLANATION_MAX) return `Giải thích tối đa ${LIMITS.EXPLANATION_MAX} ký tự.`

  if (question.type === 'multiple_choice') {
    const options = question.options.map((option) => option.trim())
    const emptyAt = options.findIndex((option) => !option)
    if (emptyAt >= 0) return `Đáp án ${optionLetter(emptyAt)} đang trống.`
    if (options.some((option) => option.length > LIMITS.OPTION_MAX)) return `Mỗi đáp án tối đa ${LIMITS.OPTION_MAX} ký tự.`
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return 'Các đáp án không được trùng nhau.'
    if (!Number.isInteger(question.correct_option) || question.correct_option < 0 || question.correct_option >= options.length) {
      return 'Hãy chọn đáp án đúng.'
    }
  } else if (question.type === 'true_false') {
    if (typeof question.correct_boolean !== 'boolean') return 'Hãy chọn Đúng hoặc Sai.'
  } else if (question.reference_answer.trim().length > LIMITS.ANSWER_MAX) {
    return `Đáp án tham khảo tối đa ${LIMITS.ANSWER_MAX} ký tự.`
  }
  return null
}

/** Kiểm tra cả phòng. `questions` map key -> lỗi; `summary` là lỗi chung. */
export function validateDraft(draft) {
  const errors = { questions: {} }
  const title = draft.title.trim()
  if (!title) errors.title = 'Hãy đặt tên cho phòng.'
  else if (title.length > LIMITS.TITLE_MAX) errors.title = `Tên phòng tối đa ${LIMITS.TITLE_MAX} ký tự.`
  if (draft.description.trim().length > LIMITS.DESCRIPTION_MAX) errors.description = `Mô tả tối đa ${LIMITS.DESCRIPTION_MAX} ký tự.`

  if (draft.questions.length === 0) errors.summary = 'Phòng cần có ít nhất 1 câu hỏi.'
  else if (draft.questions.length > LIMITS.QUESTIONS_MAX) errors.summary = `Mỗi phòng tối đa ${LIMITS.QUESTIONS_MAX} câu hỏi.`

  for (const question of draft.questions) {
    const message = validateQuestion(question)
    if (message) errors.questions[question.key] = message
  }
  return errors
}

export const hasErrors = (errors) =>
  Boolean(errors.title || errors.description || errors.summary || Object.keys(errors.questions).length)
