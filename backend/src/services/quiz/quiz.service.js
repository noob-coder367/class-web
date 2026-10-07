import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../config/supabaseClient.js'
import { HttpError } from '../../lib/httpError.js'
import { normalizeQuizPayload } from './questionSchema.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value)

const QUIZ_COLUMNS = 'id, title, description, status, created_at, updated_at'
const QUESTION_COLUMNS = 'id, order_index, type, content, options, correct_option, correct_boolean, reference_answer, explanation'

function mapDbError(error) {
  const code = error?.code
  if (code === '42501') return new HttpError('Bạn không có quyền với phòng này.', 403, 'forbidden')
  if (['22023', '22P02', '23514', '23502', '23505'].includes(code)) {
    return new HttpError('Dữ liệu phòng không hợp lệ.', 400, 'validation_error')
  }
  console.error('[quiz] database error', code || 'unknown')
  return new HttpError('Không thể xử lý dữ liệu lúc này. Vui lòng thử lại.', 503, 'db_unavailable')
}

/**
 * Lưu phòng + toàn bộ câu hỏi trong 1 transaction (hàm Postgres save_quiz_with_questions).
 * ownerId luôn lấy từ session đã xác minh, KHÔNG lấy từ body. Idempotent theo quizId
 * nên bấm lưu 2 lần không tạo bản sao.
 */
export async function saveQuiz(ownerId, quizId, body) {
  if (!isUuid(quizId)) throw new HttpError('Mã phòng không hợp lệ.', 400, 'validation_error')
  const payload = normalizeQuizPayload(body)
  const { error } = await supabaseAdmin.rpc('save_quiz_with_questions', {
    p_quiz_id: quizId,
    p_owner_id: ownerId,
    p_title: payload.title,
    p_description: payload.description,
    p_questions: payload.questions,
  })
  if (error) throw mapDbError(error)
  return getQuiz(ownerId, quizId)
}

export const createQuiz = (ownerId, body) => saveQuiz(ownerId, randomUUID(), body)

export async function getQuiz(ownerId, quizId) {
  if (!isUuid(quizId)) throw new HttpError('Không tìm thấy phòng.', 404, 'not_found')
  const { data: quiz, error } = await supabaseAdmin
    .from('quizzes')
    .select(QUIZ_COLUMNS)
    .eq('id', quizId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw mapDbError(error)
  if (!quiz) throw new HttpError('Không tìm thấy phòng.', 404, 'not_found')

  const { data: questions, error: questionsError } = await supabaseAdmin
    .from('questions')
    .select(QUESTION_COLUMNS)
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })
  if (questionsError) throw mapDbError(questionsError)
  return { ...quiz, questions: questions || [] }
}

export async function listQuizzes(ownerId) {
  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .select(QUIZ_COLUMNS)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) throw mapDbError(error)
  return data || []
}

export async function deleteQuiz(ownerId, quizId) {
  if (!isUuid(quizId)) throw new HttpError('Không tìm thấy phòng.', 404, 'not_found')
  const { data, error } = await supabaseAdmin
    .from('quizzes')
    .delete()
    .eq('id', quizId)
    .eq('owner_id', ownerId)
    .select('id')
  if (error) throw mapDbError(error)
  if (!data || data.length === 0) throw new HttpError('Không tìm thấy phòng.', 404, 'not_found')
}
