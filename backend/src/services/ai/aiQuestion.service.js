import { HttpError } from '../../lib/httpError.js'
import { QUESTION_TYPES } from '../quiz/questionSchema.js'
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.js'
import { parseAiQuestions } from './aiOutput.js'

export const AI_LIMITS = Object.freeze({
  MIN_SOURCE_CHARS: 40,
  MAX_SOURCE_CHARS: 30000,
  MIN_COUNT: 1,
  MAX_COUNT: 30,
  DEFAULT_COUNT: 10,
  TIMEOUT_MS: 45000,
})

export const DIFFICULTIES = Object.freeze(['auto', 'easy', 'medium', 'hard'])

function bad(message, code = 'validation_error') {
  return new HttpError(message, 400, code)
}

/** Kiểm tra + kẹp các tuỳ chọn người dùng gửi lên. */
export function normalizeGenerateOptions(input = {}) {
  let count = AI_LIMITS.DEFAULT_COUNT
  if (input.count !== undefined && input.count !== null && input.count !== '') {
    count = Number(input.count)
    if (!Number.isInteger(count) || count < AI_LIMITS.MIN_COUNT || count > AI_LIMITS.MAX_COUNT) {
      throw bad(`Số câu hỏi phải từ ${AI_LIMITS.MIN_COUNT} đến ${AI_LIMITS.MAX_COUNT}.`, 'too_many_questions')
    }
  }

  let types = null
  if (input.types !== undefined && input.types !== null && input.types !== '') {
    const list = Array.isArray(input.types) ? input.types : String(input.types).split(',')
    types = [...new Set(list.map((type) => String(type).trim()).filter(Boolean))]
    if (types.length === 0 || types.some((type) => !QUESTION_TYPES.includes(type))) {
      throw bad('Loại câu hỏi không hợp lệ.')
    }
  }

  const difficulty = input.difficulty ? String(input.difficulty) : 'auto'
  if (!DIFFICULTIES.includes(difficulty)) throw bad('Độ khó không hợp lệ.')

  return { count, types, difficulty }
}

/** Làm sạch nội dung nguồn. text người dùng nhập: quá dài -> lỗi; text từ file: cắt bớt. */
export function prepareSource(rawText, { truncate = false } = {}) {
  const source = String(rawText ?? '').replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (source.length < AI_LIMITS.MIN_SOURCE_CHARS) {
    throw new HttpError('Không đủ nội dung để tạo câu hỏi. Hãy cung cấp thêm nội dung.', 422, 'insufficient_content')
  }
  if (source.length > AI_LIMITS.MAX_SOURCE_CHARS) {
    if (!truncate) {
      throw new HttpError(`Nội dung quá dài (tối đa ${AI_LIMITS.MAX_SOURCE_CHARS.toLocaleString('en-US')} ký tự).`, 413, 'source_too_long')
    }
    return { source: source.slice(0, AI_LIMITS.MAX_SOURCE_CHARS), truncated: true }
  }
  return { source, truncated: false }
}

/**
 * Điều phối: chuẩn hóa -> prompt -> provider -> validate output.
 * KHÔNG ghi DB. Provider được inject nên đổi model/nhà cung cấp không đụng route.
 */
export async function generateQuestions({ sourceText, options, provider, truncate = false }) {
  const normalized = normalizeGenerateOptions(options)
  const { source, truncated } = prepareSource(sourceText, { truncate })

  const raw = await provider.generateQuestions({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt({ source, ...normalized }),
    timeoutMs: AI_LIMITS.TIMEOUT_MS,
  })

  const { questions, dropped } = parseAiQuestions(raw, normalized)
  return {
    questions,
    meta: {
      requested: normalized.count,
      returned: questions.length,
      dropped,
      truncated,
      provider: provider.name,
    },
  }
}
