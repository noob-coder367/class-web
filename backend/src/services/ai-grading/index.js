import { env } from '../../config/env.js'
import { supabaseAdmin } from '../../config/supabaseClient.js'
import { AppError } from '../auth.service.js'

const BUCKET = 'classroom-data'
const VALID_STATUSES = new Set(['pending', 'processing', 'completed', 'failed', 'rate_limited', 'needs_review'])
const GRADE_STATUSES = new Set(['graded', 'needs_review'])

function safeError(error) {
  return String(error?.message || error || 'unknown error').replace(/(?:Bearer\s+|api[_-]?key[=:]\s*)[^\s,;]+/gi, '[redacted]').slice(0, 500)
}
function isRateLimited(error) { return error?.status === 429 || /\b429\b|rate.?limit|quota/i.test(String(error?.message || error)) }
function cleanJson(value) { return String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() }
function text(value, max = 4000) { return String(value ?? '').trim().slice(0, max) }

function invalid(message) {
  const error = new Error(message)
  error.code = 'INVALID_GRADING_OUTPUT'
  return error
}

function normalizeRubricItem(item, index) {
  const criterion = text(item?.criterion, 500)
  const description = text(item?.description ?? item?.conditions ?? item?.condition, 2000)
  const maxScore = Number(item?.max_score)
  if (!criterion || !description || !Number.isFinite(maxScore) || maxScore <= 0) {
    throw invalid(`Invalid rubric item at index ${index}`)
  }
  return { criterion, max_score: maxScore, description }
}

export function validateAnswerKey(value) {
  if (!Array.isArray(value) || value.length === 0) throw invalid('Answer key is required')
  const seenIds = new Set(); const seenNumbers = new Set()
  const questions = value.map((item, index) => {
    const questionId = text(item?.question_id ?? item?.id, 100)
    const questionNumber = Number(item?.question_number)
    const questionText = text(item?.question_text, 6000)
    const maxScore = Number(item?.max_score)
    const expectedAnswer = text(item?.expected_answer, 10000)
    const rubric = Array.isArray(item?.rubric) ? item.rubric.map(normalizeRubricItem) : []
    if (!questionId || !Number.isInteger(questionNumber) || questionNumber < 1 || !questionText || !expectedAnswer || !Number.isFinite(maxScore) || maxScore <= 0 || !rubric.length) {
      throw invalid(`Incomplete answer key at index ${index}`)
    }
    if (seenIds.has(questionId) || seenNumbers.has(questionNumber)) throw invalid('Duplicate question in answer key')
    seenIds.add(questionId); seenNumbers.add(questionNumber)
    const rubricTotal = rubric.reduce((sum, item) => sum + item.max_score, 0)
    if (rubricTotal > maxScore + 1e-9) throw invalid(`Rubric exceeds max_score for question ${questionNumber}`)
    return { question_id: questionId, question_number: questionNumber, question_text: questionText, max_score: maxScore, expected_answer: expectedAnswer, rubric }
  })
  return questions.sort((a, b) => a.question_number - b.question_number)
}

function parseJson(value) {
  try { return typeof value === 'string' ? JSON.parse(cleanJson(value)) : value } catch { throw invalid('Malformed grading JSON') }
}

function reviewQuestion(key, comment) {
  return {
    question_id: key.question_id,
    question_number: key.question_number,
    question_text: key.question_text,
    score: null,
    max_score: key.max_score,
    confidence: 0,
    status: 'needs_review',
    comment: text(comment, 2000),
    rubric_items: key.rubric.map((item) => ({ criterion: item.criterion, score: null, max_score: item.max_score, comment: 'Chưa đủ bằng chứng để chấm.' })),
  }
}

export function buildNeedsReviewResult(answerKey, comment) {
  const key = validateAnswerKey(answerKey)
  return { questions: key.map((question) => reviewQuestion(question, comment)) }
}

export function validateGradeResult(value, answerKey) {
  const key = validateAnswerKey(answerKey)
  const result = parseJson(value)
  if (!result || typeof result !== 'object' || Array.isArray(result) || !Array.isArray(result.questions)) throw invalid('Invalid grading JSON questions')
  const { total_score: _ignoredTotalScore, total_max_score: _ignoredTotalMaxScore, overall_comment: _ignoredOverallComment, ...perQuestionResult } = result
  if ('score' in perQuestionResult || 'max_score' in perQuestionResult) throw invalid('Top-level score fields are not allowed')
  if (perQuestionResult.questions.length !== key.length) throw invalid('Question count does not match answer key')

  const byId = new Map(key.map((question) => [question.question_id, question]))
  const byNumber = new Map(key.map((question) => [question.question_number, question]))
  const seen = new Set()
  const questions = perQuestionResult.questions.map((raw) => {
    const questionId = text(raw?.question_id, 100)
    const questionNumber = Number(raw?.question_number)
    const question = questionId ? byId.get(questionId) : byNumber.get(questionNumber)
    if (!question) throw invalid('Question is not present in answer key')
    if (questionId && Number.isFinite(questionNumber) && questionNumber !== question.question_number) throw invalid('Question id and number do not match answer key')
    if (seen.has(question.question_id)) throw invalid('Duplicate question in grading output')
    seen.add(question.question_id)
    const status = text(raw?.status, 40)
    if (!GRADE_STATUSES.has(status)) throw invalid(`Invalid question status for question ${question.question_number}`)
    const score = raw?.score === null && status === 'needs_review' ? null : Number(raw?.score)
    const maxScore = Number(raw?.max_score)
    const confidence = Number(raw?.confidence)
    if (!Number.isFinite(maxScore) || maxScore !== question.max_score || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw invalid(`Invalid score metadata for question ${question.question_number}`)
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > question.max_score)) throw invalid(`Score out of bounds for question ${question.question_number}`)
    const rawRubric = raw?.rubric_items
    if (!Array.isArray(rawRubric) || rawRubric.length !== question.rubric.length) throw invalid(`Rubric count does not match question ${question.question_number}`)
    const rubricByName = new Map(question.rubric.map((item) => [item.criterion, item]))
    const rubricSeen = new Set()
    const rubricItems = rawRubric.map((item) => {
      const criterion = text(item?.criterion, 500)
      const expected = rubricByName.get(criterion)
      if (!expected || rubricSeen.has(criterion)) throw invalid(`Unknown or duplicate rubric criterion for question ${question.question_number}`)
      rubricSeen.add(criterion)
      const itemMax = Number(item?.max_score)
      const itemScore = item?.score === null && status === 'needs_review' ? null : Number(item?.score)
      if (!Number.isFinite(itemMax) || itemMax !== expected.max_score || (itemScore !== null && (!Number.isFinite(itemScore) || itemScore < 0 || itemScore > expected.max_score))) throw invalid(`Rubric score out of bounds for question ${question.question_number}`)
      return { criterion, score: itemScore, max_score: expected.max_score, comment: text(item?.comment, 2000) }
    })
    if (rubricSeen.size !== question.rubric.length) throw invalid(`Missing rubric criterion for question ${question.question_number}`)
    const rubricScore = rubricItems.reduce((sum, item) => sum + (item.score === null ? 0 : item.score), 0)
    if (rubricScore > question.max_score + 1e-9) throw invalid(`Rubric total exceeds max_score for question ${question.question_number}`)
    return { question_id: question.question_id, question_number: question.question_number, question_text: question.question_text, score, max_score: question.max_score, confidence, status, comment: text(raw?.comment, 2000), rubric_items: rubricItems }
  })
  if (seen.size !== key.length) throw invalid('Missing question in grading output')
  return { questions: questions.sort((a, b) => a.question_number - b.question_number) }
}

export function calculateGradeTotals(grade, answerKey) {
  const key = validateAnswerKey(answerKey)
  const questions = validateGradeResult(grade, key).questions
  const totalMaxScore = key.reduce((sum, question) => sum + question.max_score, 0)
  const scoredQuestions = questions.filter((question) => question.score !== null)
  const totalScore = scoredQuestions.length ? scoredQuestions.reduce((sum, question) => sum + question.score, 0) : null
  const complete = questions.length === key.length && questions.every((question) => question.status === 'graded' && question.score !== null)
  return {
    total_score: totalScore,
    total_max_score: totalMaxScore,
    grading_status: complete ? 'graded' : 'needs_review',
    total_score_complete: complete,
  }
}

export async function enqueueGradingJob({ submissionType, submissionId, userId, assignmentId = null, examId = null, files = [] }) {
  if (!env.AI_GRADING_ENABLED || !submissionId) return null
  const { data: existing, error: lookupError } = await supabaseAdmin.from('ai_grading_jobs').select('id,status').eq('submission_type', submissionType).eq('submission_id', submissionId).maybeSingle()
  if (lookupError) throw lookupError
  if (existing) return existing
  const { data, error } = await supabaseAdmin.from('ai_grading_jobs').insert({ submission_type: submissionType, submission_id: submissionId, user_id: userId, assignment_id: assignmentId, exam_id: examId, files }).select('id,status').single()
  if (error && error.code === '23505') return (await supabaseAdmin.from('ai_grading_jobs').select('id,status').eq('submission_type', submissionType).eq('submission_id', submissionId).single()).data
  if (error) throw error
  return data
}

export async function getGradingResult(submissionType, submissionId, profile, { isManager = false } = {}) {
  const type = text(submissionType, 20)
  const id = text(submissionId, 100)
  if (!['homework', 'exam'].includes(type) || !id) throw new AppError('Submission grading không hợp lệ.', 400)
  const table = type === 'exam' ? 'class_exam_submissions' : 'homework_submissions'
  const parentTable = type === 'exam' ? 'class_exams' : 'homework_assignments'
  const parentColumn = type === 'exam' ? 'exam_id' : 'assignment_id'
  const { data: submission, error: submissionError } = await supabaseAdmin.from(table)
    .select(`id, ${parentColumn}, user_id, submitted_at`).eq('id', id).maybeSingle()
  if (submissionError) throw submissionError
  if (!submission) throw new AppError('Không tìm thấy bài nộp.', 404)
  if (!isManager && submission.user_id !== profile?.id) throw new AppError('Bạn không có quyền xem kết quả này.', 403)
  const { data: parent, error: parentError } = await supabaseAdmin.from(parentTable)
    .select('id').eq('id', submission[parentColumn]).maybeSingle()
  if (parentError) throw parentError
  if (!parent) throw new AppError('Không tìm thấy bài kiểm tra/bài tập.', 404)
  const { data: job, error: jobError } = await supabaseAdmin.from('ai_grading_jobs')
    .select('id, submission_type, submission_id, assignment_id, exam_id, status, result, error_message, created_at, updated_at, completed_at')
    .eq('submission_type', type).eq('submission_id', id).maybeSingle()
  if (jobError) throw jobError
  const result = job?.result && typeof job.result === 'object' ? job.result : null
  const numericOrNull = (value) => value === null || value === undefined ? null : Number.isFinite(Number(value)) ? Number(value) : null
  return {
    submission_id: submission.id,
    submission_type: type,
    [parentColumn]: submission[parentColumn],
    submitted_at: submission.submitted_at,
    job_id: job?.id || null,
    status: job?.status || 'not_queued',
    grading_status: result?.grading_status || (job?.status === 'completed' ? 'graded' : job?.status === 'needs_review' ? 'needs_review' : job?.status || 'not_queued'),
    questions: Array.isArray(result?.questions) ? result.questions : [],
    total_score: numericOrNull(result?.total_score),
    total_max_score: numericOrNull(result?.total_max_score),
    total_score_complete: result?.total_score_complete === true,
    error_message: job?.error_message || null,
    created_at: job?.created_at || null,
    updated_at: job?.updated_at || null,
    completed_at: job?.completed_at || null,
  }
}

async function callGemini(model, files) {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini is not configured')
  const parts = [{ text: 'Read this student submission. Return JSON only: {"normalized_text":"...","confidence":0..1,"missing_or_unreadable":false,"observations":["..."]}. Do not invent unreadable text.' }]
  for (const file of files.slice(0, 10)) {
    if (!String(file.mime || '').match(/^(image\/|application\/pdf$)/)) continue
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(file.path)
    if (error) throw error
    const bytes = Buffer.from(await data.arrayBuffer())
    parts.push({ inline_data: { mime_type: file.mime, data: bytes.toString('base64') } })
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }) })
  if (!response.ok) { const error = new Error(`Gemini request failed (${response.status})`); error.status = response.status; throw error }
  const payload = await response.json(); return parseJson(payload?.candidates?.[0]?.content?.parts?.[0]?.text)
}

async function callOcr(file) {
  if (!env.OCR_SPACE_API_KEY || !file || Number(file.size) > 1024 * 1024 || !String(file.mime || '').startsWith('image/')) return null
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(file.path); if (error) throw error
  const bytes = Buffer.from(await data.arrayBuffer())
  const body = new URLSearchParams({ apikey: env.OCR_SPACE_API_KEY, base64Image: `data:${file.mime};base64,${bytes.toString('base64')}`, language: 'eng', isOverlayRequired: 'false' })
  const response = await fetch(env.OCR_SPACE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!response.ok) throw new Error(`OCR.space request failed (${response.status})`)
  const payload = await response.json(); return (payload?.ParsedResults || []).map((x) => x.ParsedText || '').join('\n').trim() || null
}

async function loadAnswerKey(job) {
  if (!job.exam_id) return null
  const { data, error } = await supabaseAdmin.from('class_exam_questions').select('id, question_number, question_text, max_score, expected_answer, rubric').eq('exam_id', job.exam_id).order('question_number').limit(200)
  if (error) throw error
  if (!data?.length) return null
  try {
    return validateAnswerKey(data.map((row) => ({ question_id: row.id, ...row })))
  } catch (validationError) {
    return { invalid: true, reason: validationError.message }
  }
}

async function callGrader({ vision, ocr, job, answerKey }) {
  if (!env.GROQ_API_KEY) throw new Error('Groq is not configured')
  const prompt = {
    question_set: answerKey,
    submission_evidence: { vision, ocr_fallback: ocr },
    instruction: 'Grade each supplied question independently using only its expected_answer, rubric, and submission evidence. Never create, omit, duplicate, or rename a question. If evidence is insufficient, use status needs_review and score null; do not guess. Return JSON only in the exact shape {"questions":[{"question_id":"...","question_number":1,"question_text":"...","score":1.5,"max_score":2,"confidence":0.94,"status":"graded","comment":"...","rubric_items":[{"criterion":"...","score":0.5,"max_score":0.5,"comment":"..."}]}]}. Do not return total_score, score totals, or overall_comment.',
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.GROQ_MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: JSON.stringify(prompt) }] }) })
  if (!response.ok) { const error = new Error(`Groq grading request failed (${response.status})`); error.status = response.status; throw error }
  const payload = await response.json(); return validateGradeResult(payload?.choices?.[0]?.message?.content, answerKey)
}

async function processJob(job) {
  const answerKey = await loadAnswerKey(job)
  if (!answerKey) return { status: 'needs_review', result: { questions: [], reason: 'missing_answer_key_or_rubric' } }
  if (answerKey.invalid) return { status: 'needs_review', result: { questions: [], reason: 'invalid_answer_key_or_rubric', detail: text(answerKey.reason, 500) } }
  let vision
  try { vision = await callGemini(env.GEMINI_PRIMARY_MODEL, job.files || []); job.model_used = env.GEMINI_PRIMARY_MODEL }
  catch (error) { if (!isRateLimited(error)) throw error; try { vision = await callGemini(env.GEMINI_SECONDARY_MODEL, job.files || []); job.model_used = env.GEMINI_SECONDARY_MODEL } catch (secondary) { if (isRateLimited(secondary)) return { status: 'rate_limited', error: 'Gemini providers are rate limited' }; throw secondary } }
  let ocr = null; const confidence = Number(vision?.confidence)
  if (!Number.isFinite(confidence) || confidence < env.AI_GRADING_OCR_CONFIDENCE_THRESHOLD) { try { ocr = await callOcr((job.files || [])[0]) } catch (error) { console.warn('[ai-grading] OCR fallback failed', { message: safeError(error) }) } }
  const readableEvidence = !vision?.missing_or_unreadable && (text(vision?.normalized_text) || text(ocr))
  if (!readableEvidence) {
    const grade = buildNeedsReviewResult(answerKey, 'Không đọc rõ bài làm; cần giáo viên kiểm tra.')
    return { status: 'needs_review', model: job.model_used, result: { ...grade, ...calculateGradeTotals(grade, answerKey), grading_status: 'needs_review' } }
  }
  const grade = await callGrader({ vision, ocr, job, answerKey })
  const totals = calculateGradeTotals(grade, answerKey)
  const finalConfidence = Math.min(Number(vision?.confidence) || 0, ...grade.questions.map((question) => Number(question.confidence) || 0))
  const status = finalConfidence < env.AI_GRADING_REVIEW_CONFIDENCE_THRESHOLD || vision?.missing_or_unreadable || totals.grading_status === 'needs_review' ? 'needs_review' : 'completed'
  return { status, model: job.model_used, result: { ...grade, ...totals, grading_status: status === 'completed' ? 'graded' : 'needs_review', vision, ocr_used: Boolean(ocr), evidence_confidence: finalConfidence } }
}

export async function runOneGradingJob() {
  const { data, error } = await supabaseAdmin.rpc('claim_ai_grading_job', { p_max_attempts: env.AI_GRADING_MAX_ATTEMPTS })
  if (error) throw error
  const job = Array.isArray(data) ? data[0] : data; if (!job) return false
  try { const outcome = await processJob(job); const { error: saveError } = await supabaseAdmin.from('ai_grading_jobs').update({ status: outcome.status, model_used: outcome.model || null, result: outcome.result || null, error_message: outcome.error || null, completed_at: ['completed', 'needs_review'].includes(outcome.status) ? new Date().toISOString() : null, locked_at: null, locked_by: null, next_attempt_at: outcome.status === 'rate_limited' ? new Date(Date.now() + 15 * 60_000).toISOString() : null }).eq('id', job.id); if (saveError) throw saveError } catch (error) { const attempts = Number(job.attempt_count || 1); const status = isRateLimited(error) ? 'rate_limited' : attempts >= env.AI_GRADING_MAX_ATTEMPTS ? 'failed' : 'pending'; await supabaseAdmin.from('ai_grading_jobs').update({ status, error_message: safeError(error), locked_at: null, locked_by: null, next_attempt_at: status === 'pending' ? new Date(Date.now() + attempts * 60_000).toISOString() : null }).eq('id', job.id) }
  return true
}

export function startAiGradingWorker() { if (!env.AI_GRADING_ENABLED) return () => {}; let running = false; const tick = async () => { if (running) return; running = true; try { await Promise.all(Array.from({ length: env.AI_GRADING_CONCURRENCY }, () => runOneGradingJob())) } catch (error) { console.error('[ai-grading] worker poll failed', { message: safeError(error) }) } finally { running = false } }; void tick(); const timer = setInterval(tick, env.AI_GRADING_POLL_MS); return () => clearInterval(timer) }
export { VALID_STATUSES }
