import { supabaseAdmin } from '../../config/supabaseClient.js'
import { AppError } from '../auth.service.js'
import { validateAnswerKey, validateGradeResult } from './index.js'

const REVIEW_ROLES = new Set(['admin', 'vp_academic'])
const BUCKET = 'classroom-data'
const MAX_COMMENT = 4000

function text(value, max = MAX_COMMENT) { return String(value ?? '').trim().slice(0, max) }
function numberOrNull(value) { return value === null || value === undefined || value === '' ? null : Number(value) }
function assertReviewRole(profile) {
  if (!REVIEW_ROLES.has(profile?.role)) throw new AppError('Chỉ Admin hoặc Lớp phó học tập được duyệt điểm AI.', 403)
}
function tableOf(type) {
  if (type === 'homework') return { submission: 'homework_submissions', parent: 'homework_assignments', parentColumn: 'assignment_id' }
  if (type === 'exam') return { submission: 'class_exam_submissions', parent: 'class_exams', parentColumn: 'exam_id' }
  throw new AppError('Loại bài nộp không hợp lệ.', 400)
}
async function getJob(type, submissionId) {
  const { submission, parent, parentColumn } = tableOf(type)
  const { data: sub, error: subError } = await supabaseAdmin.from(submission).select(`id, ${parentColumn}, user_id, submitted_at, files`).eq('id', submissionId).maybeSingle()
  if (subError) throw subError
  if (!sub) throw new AppError('Không tìm thấy bài nộp.', 404)
  const { data: parentRow, error: parentError } = await supabaseAdmin.from(parent).select('id').eq('id', sub[parentColumn]).maybeSingle()
  if (parentError) throw parentError
  if (!parentRow) throw new AppError('Không tìm thấy bài tập/đề kiểm tra.', 404)
  const { data: job, error: jobError } = await supabaseAdmin.from('ai_grading_jobs').select('*').eq('submission_type', type).eq('submission_id', submissionId).maybeSingle()
  if (jobError) throw jobError
  if (!job) throw new AppError('Bài nộp chưa có kết quả chấm AI.', 404)
  return { job, sub }
}
async function answerKeyFor(job) {
  if (!job.exam_id) {
    return (Array.isArray(job.result?.questions) ? job.result.questions : []).map((question, index) => ({
      question_id: String(question.question_id || `question-${question.question_number || index + 1}`),
      question_number: Number(question.question_number || index + 1),
      question_text: text(question.question_text, 6000),
      max_score: Number(question.max_score) || 0,
      expected_answer: '',
      rubric: Array.isArray(question.rubric_items) ? question.rubric_items.map((item) => ({ criterion: text(item.criterion, 500), description: text(item.comment, 2000), max_score: Number(item.max_score) || 0 })) : [],
    }))
  }
  const { data, error } = await supabaseAdmin.from('class_exam_questions').select('id, question_number, question_text, max_score, expected_answer, rubric').eq('exam_id', job.exam_id).order('question_number').limit(200)
  if (error) throw error
  return validateAnswerKey((data || []).map((row) => ({ question_id: row.id, ...row })))
}
async function signedFiles(files) {
  return Promise.all((Array.isArray(files) ? files : []).map(async (file) => {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(file.path, 3600)
    if (error) throw new AppError('Không tạo được liên kết file bằng chứng.', 502)
    return { name: file.name, mime: file.mime, size: file.size, is_image: String(file.mime || '').startsWith('image/'), url: data?.signedUrl || null }
  }))
}
function normalizedQuestion(raw, key, existing) {
  const aiScore = numberOrNull(raw?.score)
  return {
    question_id: key.question_id,
    question_number: key.question_number,
    question_text: key.question_text,
    expected_answer: key.expected_answer,
    rubric: key.rubric,
    ai_score: aiScore,
    ai_max_score: key.max_score,
    ai_comment: text(raw?.comment),
    ai_confidence: numberOrNull(raw?.confidence),
    ai_status: raw?.status === 'graded' ? 'graded' : 'needs_review',
    teacher_score: existing ? Number(existing.teacher_score) : aiScore === null ? 0 : aiScore,
    final_score: existing ? Number(existing.teacher_score) : null,
    teacher_comment: existing?.teacher_comment || '',
    reviewed: Boolean(existing),
    reviewed_by: existing?.reviewed_by || null,
    reviewed_at: existing?.reviewed_at || null,
  }
}

export async function getReview(type, submissionId, profile) {
  assertReviewRole(profile)
  const { job, sub } = await getJob(type, submissionId)
  const answerKey = await answerKeyFor(job)
  const grade = job.result && typeof job.result === 'object' ? job.result : { questions: [] }
  const valid = job.exam_id && answerKey.length && Array.isArray(grade.questions) && grade.questions.length ? validateGradeResult(grade, answerKey) : { questions: Array.isArray(grade.questions) ? grade.questions : [] }
  const { data: reviews, error: reviewError } = await supabaseAdmin.from('ai_grading_reviews').select('*').eq('grading_job_id', job.id).order('question_number')
  if (reviewError) throw reviewError
  const reviewByQuestion = new Map((reviews || []).map((row) => [row.question_id, row]))
  const keyByNumber = new Map(answerKey.map((key) => [key.question_number, key]))
  const questions = valid.questions.length ? valid.questions.map((raw) => {
    const key = keyByNumber.get(raw.question_number) || answerKey.find((item) => item.question_id === raw.question_id)
    return normalizedQuestion(raw, key || { question_id: raw.question_id, question_number: raw.question_number, question_text: raw.question_text || '', expected_answer: '', max_score: raw.max_score, rubric: raw.rubric_items || [] }, reviewByQuestion.get(raw.question_id))
  }) : answerKey.map((key) => normalizedQuestion(null, key, reviewByQuestion.get(key.question_id)))
  const hasReview = questions.length > 0 && questions.every((question) => question.reviewed)
  const finalScore = hasReview ? questions.reduce((sum, question) => sum + Number(question.teacher_score || 0), 0) : null
  const finalMaxScore = questions.reduce((sum, question) => sum + Number(question.ai_max_score || 0), 0)
  return {
    job_id: job.id,
    submission_id: sub.id,
    submission_type: type,
    submission_user_id: sub.user_id,
    status: job.status,
    grading_status: job.result?.grading_status || job.status,
    evidence_files: await signedFiles(sub.files),
    questions,
    final_score: finalScore,
    final_max_score: finalMaxScore,
    final_score_complete: hasReview,
    can_review: REVIEW_ROLES.has(profile?.role),
  }
}

export async function saveReview(type, submissionId, payload, profile) {
  assertReviewRole(profile)
  const { job, sub } = await getJob(type, submissionId)
  if (!['needs_review', 'completed'].includes(job.status) && job.result?.grading_status !== 'needs_review') throw new AppError('Bài nộp chưa có kết quả AI để duyệt.', 409)
  const answerKey = await answerKeyFor(job)
  if (!answerKey.length) throw new AppError('Chưa có answer key/rubric để duyệt bài.', 409)
  const grade = job.result && typeof job.result === 'object' && Array.isArray(job.result.questions) && job.result.questions.length
    ? (job.exam_id ? validateGradeResult(job.result, answerKey) : job.result)
    : { questions: [] }
  const rawItems = Array.isArray(payload?.questions) ? payload.questions : []
  const byId = new Map(grade.questions.map((question) => [question.question_id, question]))
  const keyByNumber = new Map(answerKey.map((key) => [key.question_number, key]))
  if (rawItems.length !== answerKey.length) throw new AppError('Phải xác nhận điểm cho tất cả câu hỏi.', 400)
  const rows = rawItems.map((item) => {
    const key = item?.question_id ? answerKey.find((question) => question.question_id === item.question_id) : keyByNumber.get(Number(item?.question_number))
    if (!key) throw new AppError('Câu hỏi review không thuộc answer key.', 400)
    const ai = byId.get(key.question_id)
    const teacherScore = Number(item.teacher_score)
    if (!Number.isFinite(teacherScore) || teacherScore < 0 || teacherScore > key.max_score) throw new AppError(`Điểm giáo viên câu ${key.question_number} không hợp lệ.`, 400)
    return { grading_job_id: job.id, submission_id: sub.id, submission_type: type, question_id: key.question_id, question_number: key.question_number, ai_score: ai?.score ?? null, ai_max_score: key.max_score, ai_comment: text(ai?.comment), ai_confidence: numberOrNull(ai?.confidence), ai_status: ai?.status === 'graded' ? 'graded' : 'needs_review', teacher_score: teacherScore, teacher_comment: text(item?.teacher_comment), reviewed_by: profile.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  })
  const { data: saved, error } = await supabaseAdmin.from('ai_grading_reviews').upsert(rows, { onConflict: 'grading_job_id,question_id' }).select('*')
  if (error) throw error
  const finalScore = rows.reduce((sum, row) => sum + row.teacher_score, 0)
  const finalMaxScore = rows.reduce((sum, row) => sum + row.ai_max_score, 0)
  const nextResult = { ...job.result, final_score: finalScore, final_max_score: finalMaxScore, final_score_complete: true, grading_status: 'graded_after_review', reviewed_at: new Date().toISOString(), reviewed_by: profile.id }
  const { error: jobError } = await supabaseAdmin.from('ai_grading_jobs').update({ result: nextResult, status: 'completed', updated_at: new Date().toISOString(), completed_at: job.completed_at || new Date().toISOString() }).eq('id', job.id)
  if (jobError) throw jobError
  return { job_id: job.id, submission_id: sub.id, submission_type: type, reviews: saved || rows, final_score: finalScore, final_max_score: finalMaxScore, final_score_complete: true }
}
