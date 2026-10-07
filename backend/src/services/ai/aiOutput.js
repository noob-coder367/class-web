import { HttpError } from '../../lib/httpError.js'
import { normalizeQuestion } from '../quiz/questionSchema.js'

/** Lấy JSON object từ output của model (chịu được ```json fence hoặc lời dẫn thừa). */
export function extractJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('empty')
  let textValue = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(textValue)
  } catch {
    const start = textValue.indexOf('{')
    const end = textValue.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('no json')
    textValue = textValue.slice(start, end + 1)
    return JSON.parse(textValue)
  }
}

function toIndex(value) {
  if (Number.isInteger(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d+$/.test(trimmed)) return Number(trimmed)
    if (/^[A-Ha-h]$/.test(trimmed)) return trimmed.toUpperCase().charCodeAt(0) - 65
  }
  return null
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

/** Schema AI -> schema nội bộ (cột DB). Không tin bất kỳ field nào của AI. */
function fromAiItem(item) {
  if (!item || typeof item !== 'object') return null
  const common = { type: item.type, content: item.content, explanation: item.explanation }
  if (item.type === 'multiple_choice') {
    return { ...common, options: item.options, correct_option: toIndex(item.correct_answer ?? item.correct_option) }
  }
  if (item.type === 'true_false') {
    return { ...common, correct_boolean: toBoolean(item.correct_answer ?? item.correct_boolean) }
  }
  if (item.type === 'essay') {
    return { ...common, reference_answer: item.answer ?? item.reference_answer }
  }
  return null
}

const fingerprint = (value) => String(value).toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Parse + validate output AI. Câu sai schema bị loại (không làm hỏng cả lô);
 * nếu không còn câu hợp lệ nào thì báo lỗi rõ ràng.
 */
export function parseAiQuestions(raw, { count, types }) {
  let parsed
  try {
    parsed = extractJson(raw)
  } catch {
    throw new HttpError('AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.', 502, 'invalid_ai_output')
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.questions
  if (!Array.isArray(list)) {
    throw new HttpError('AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.', 502, 'invalid_ai_output')
  }
  if (list.length === 0) {
    throw new HttpError('Không đủ nội dung để tạo câu hỏi. Hãy cung cấp thêm nội dung.', 422, 'insufficient_content')
  }

  const allowed = types && types.length ? new Set(types) : null
  const seen = new Set()
  const questions = []
  let dropped = 0
  for (const item of list) {
    const candidate = fromAiItem(item)
    if (!candidate || (allowed && !allowed.has(candidate.type))) { dropped += 1; continue }
    let question
    try {
      question = normalizeQuestion(candidate, questions.length)
    } catch {
      dropped += 1
      continue
    }
    const key = fingerprint(question.content)
    if (seen.has(key)) { dropped += 1; continue }
    seen.add(key)
    questions.push(question)
    if (questions.length >= count) break
  }

  if (questions.length === 0) {
    throw new HttpError('AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.', 502, 'invalid_ai_output')
  }
  return { questions, dropped }
}
