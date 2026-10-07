import { HttpError } from '../../lib/httpError.js'

export const QUESTION_TYPES = Object.freeze(['multiple_choice', 'essay', 'true_false'])

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

function fail(message) {
  throw new HttpError(message, 400, 'validation_error')
}

function text(value, { max, label, required = false }) {
  if (value === undefined || value === null) value = ''
  if (typeof value !== 'string') fail(`${label}: dữ liệu không hợp lệ.`)
  const cleaned = value.replace(/\r\n/g, '\n').trim()
  if (required && !cleaned) fail(`${label}: không được để trống.`)
  if (cleaned.length > max) fail(`${label}: tối đa ${max} ký tự.`)
  return cleaned
}

/**
 * Chuẩn hóa + kiểm tra 1 câu hỏi theo từng loại. Trả về object "phẳng" khớp cột DB.
 * Luôn tạo object mới (không tin các field thừa từ client).
 */
export function normalizeQuestion(raw, index = 0) {
  const label = `Câu ${index + 1}`
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${label}: dữ liệu không hợp lệ.`)
  if (!QUESTION_TYPES.includes(raw.type)) fail(`${label}: loại câu hỏi không hợp lệ.`)

  const content = text(raw.content, { max: LIMITS.CONTENT_MAX, label: `${label}: nội dung`, required: true })
  const explanation = text(raw.explanation, { max: LIMITS.EXPLANATION_MAX, label: `${label}: giải thích` })
  const base = {
    type: raw.type,
    content,
    options: null,
    correct_option: null,
    correct_boolean: null,
    reference_answer: null,
    explanation: explanation || null,
  }

  if (raw.type === 'multiple_choice') {
    if (!Array.isArray(raw.options)) fail(`${label}: thiếu danh sách đáp án.`)
    if (raw.options.length < LIMITS.OPTIONS_MIN || raw.options.length > LIMITS.OPTIONS_MAX) {
      fail(`${label}: cần từ ${LIMITS.OPTIONS_MIN} đến ${LIMITS.OPTIONS_MAX} đáp án.`)
    }
    const options = raw.options.map((option, i) =>
      text(option, { max: LIMITS.OPTION_MAX, label: `${label}: đáp án ${String.fromCharCode(65 + i)}`, required: true }))
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
      fail(`${label}: các đáp án không được trùng nhau.`)
    }
    const correct = raw.correct_option
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      fail(`${label}: hãy chọn đúng 1 đáp án đúng.`)
    }
    return { ...base, options, correct_option: correct }
  }

  if (raw.type === 'true_false') {
    if (typeof raw.correct_boolean !== 'boolean') fail(`${label}: hãy chọn Đúng hoặc Sai.`)
    return { ...base, correct_boolean: raw.correct_boolean }
  }

  const reference = text(raw.reference_answer, { max: LIMITS.ANSWER_MAX, label: `${label}: đáp án tham khảo` })
  return { ...base, reference_answer: reference || null }
}

export function normalizeQuizPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Dữ liệu phòng không hợp lệ.')
  const title = text(body.title, { max: LIMITS.TITLE_MAX, label: 'Tên phòng', required: true })
  const description = text(body.description, { max: LIMITS.DESCRIPTION_MAX, label: 'Mô tả' })
  if (!Array.isArray(body.questions) || body.questions.length === 0) fail('Phòng cần có ít nhất 1 câu hỏi.')
  if (body.questions.length > LIMITS.QUESTIONS_MAX) fail(`Mỗi phòng tối đa ${LIMITS.QUESTIONS_MAX} câu hỏi.`)
  const questions = body.questions.map((question, index) => normalizeQuestion(question, index))
  return { title, description: description || null, questions }
}
