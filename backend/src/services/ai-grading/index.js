import { env } from '../../config/env.js'
import { supabaseAdmin } from '../../config/supabaseClient.js'
import { AppError } from '../auth.service.js'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

const BUCKET = 'classroom-data'
const VALID_STATUSES = new Set(['pending', 'processing', 'completed', 'failed', 'rate_limited', 'needs_review'])
// `graded` remains accepted for results written by Steps 1–8. New statuses are
// descriptive only; the server still calculates totals from bounded scores.
const GRADE_STATUSES = new Set(['graded', 'correct', 'partially_correct', 'wrong', 'unreadable', 'needs_review'])

function safeError(error) {
  return String(error?.message || error || 'unknown error').replace(/(?:Bearer\s+|api[_-]?key[=:]\s*)[^\s,;]+/gi, '[redacted]').slice(0, 500)
}
function isRateLimited(error) { return error?.status === 429 || /\b429\b|rate.?limit|quota/i.test(String(error?.message || error)) }
function isRetryable(error) { return isRateLimited(error) || error?.code === 'AI_TIMEOUT' || error?.code === 'AI_NETWORK' || error?.status >= 500 }
function retryAfterMs(error, config = env) { return Math.max(config.AI_GRADING_RETRY_BASE_MS, Number(error?.retryAfterMs) || 0) }
export function getFailureOutcome(error, attemptCount, config = env) {
  const attempts = Number(attemptCount || 1)
  const retryable = isRetryable(error) && error?.code !== 'INVALID_GRADING_OUTPUT'
  const rateLimited = isRateLimited(error)
  const status = rateLimited ? 'rate_limited' : retryable && attempts < config.AI_GRADING_MAX_ATTEMPTS ? 'pending' : 'failed'
  const delay = rateLimited
    ? Math.max(15 * 60_000, retryAfterMs(error, config))
    : Math.min(config.AI_GRADING_RETRY_MAX_MS, config.AI_GRADING_RETRY_BASE_MS * (2 ** Math.max(0, attempts - 1)))
  const errorCode = error?.code || (error?.status === 429 ? 'AI_RATE_LIMITED' : error?.status >= 500 ? 'AI_PROVIDER_5XX' : 'AI_JOB_FAILED')
  return { status, delayMs: delay, errorCode }
}

export async function runGradingBatch({ concurrency, runOne }) {
  const limit = Math.max(1, Number(concurrency) || 1)
  const results = []
  for (let offset = 0; offset < limit; offset += 1) {
    results.push(Promise.resolve().then(runOne))
  }
  return Promise.all(results)
}
function withTimeout(task, timeoutMs, label) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return Promise.resolve().then(() => task(controller.signal)).catch((error) => {
    if (error?.name === 'AbortError') { const timeout = new Error(`${label} timeout`); timeout.code = 'AI_TIMEOUT'; throw timeout }
    throw error
  }).finally(() => clearTimeout(timer))
}
async function fetchProvider(url, options, timeoutMs, label) {
  return withTimeout(async (signal) => {
    let response
    try { response = await fetch(url, { ...options, signal }) } catch (error) { if (error?.name === 'AbortError') throw error; error.code = 'AI_NETWORK'; throw error }
    if (!response.ok) {
      const error = new Error(`${label} request failed (${response.status})`)
      error.status = response.status
      error.code = response.status === 429 ? 'AI_RATE_LIMITED' : response.status >= 500 ? 'AI_PROVIDER_5XX' : 'AI_PROVIDER_ERROR'
      const retryAfter = Number(response.headers.get('retry-after'))
      if (Number.isFinite(retryAfter)) error.retryAfterMs = retryAfter * 1000
      throw error
    }
    return response
  }, timeoutMs, label)
}
function cleanJson(value) { return String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() }
function text(value, max = 4000) { return String(value ?? '').trim().slice(0, max) }

function normalizeStep(value, index) {
  const stepNumber = Number(value?.step_number ?? index + 1)
  if (!Number.isInteger(stepNumber) || stepNumber < 1) throw invalid(`Invalid solution step at index ${index}`)
  const content = text(value?.content, 4000)
  const mathExpression = text(value?.math_expression ?? value?.expression, 2000)
  const intermediateResult = text(value?.intermediate_result ?? value?.result, 2000)
  const confidence = Number(value?.confidence)
  if (!content && !mathExpression && !intermediateResult) throw invalid(`Empty solution step at index ${index}`)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw invalid(`Invalid solution step confidence at index ${index}`)
  return { step_number: stepNumber, content, math_expression: mathExpression, intermediate_result: intermediateResult, confidence }
}

function normalizeReadability(value) {
  const readability = text(value, 20)
  return ['clear', 'partial', 'unreadable'].includes(readability) ? readability : 'clear'
}

function validateJobFiles(files) {
  const list = Array.isArray(files) ? files : []
  const images = list.filter((file) => String(file?.mime || '').startsWith('image/'))
  const total = list.reduce((sum, file) => sum + (Number(file?.size) || 0), 0)
  if (!list.length || images.length > env.AI_GRADING_MAX_IMAGES || total > env.AI_GRADING_MAX_TOTAL_BYTES) {
    const error = new Error('Submission vượt giới hạn file AI.')
    error.code = 'INVALID_FILE_LIMIT'
    throw error
  }
  for (const file of list) {
    const mime = String(file?.mime || '')
    if (!(mime.startsWith('image/') || mime === 'application/pdf')) { const error = new Error('Loại file không được AI hỗ trợ.'); error.code = 'INVALID_FILE_TYPE'; throw error }
    if (mime.startsWith('image/') && Number(file.size) > env.AI_GRADING_MAX_IMAGE_BYTES) { const error = new Error('Ảnh vượt giới hạn AI.'); error.code = 'INVALID_FILE_LIMIT'; throw error }
    if (mime === 'application/pdf' && Number(file.pages) > env.AI_GRADING_MAX_PDF_PAGES) { const error = new Error('PDF vượt số trang cho phép.'); error.code = 'INVALID_FILE_PAGES'; throw error }
  }
}

export { validateJobFiles, isRetryable, retryAfterMs }

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
    const score = raw?.score === null && ['needs_review', 'unreadable'].includes(status) ? null : Number(raw?.score)
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
      const itemScore = item?.score === null && ['needs_review', 'unreadable'].includes(status) ? null : Number(item?.score)
      if (!Number.isFinite(itemMax) || itemMax !== expected.max_score || (itemScore !== null && (!Number.isFinite(itemScore) || itemScore < 0 || itemScore > expected.max_score))) throw invalid(`Rubric score out of bounds for question ${question.question_number}`)
      return { criterion, score: itemScore, max_score: expected.max_score, comment: text(item?.comment, 2000) }
    })
    if (rubricSeen.size !== question.rubric.length) throw invalid(`Missing rubric criterion for question ${question.question_number}`)
    const rubricScore = rubricItems.reduce((sum, item) => sum + (item.score === null ? 0 : item.score), 0)
    if (rubricScore > question.max_score + 1e-9) throw invalid(`Rubric total exceeds max_score for question ${question.question_number}`)
    const rawSteps = raw?.steps == null ? [] : raw.steps
    if (!Array.isArray(rawSteps)) throw invalid(`Invalid solution steps for question ${question.question_number}`)
    const steps = rawSteps.map(normalizeStep).sort((a, b) => a.step_number - b.step_number)
    const readability = normalizeReadability(raw?.readability)
    if (status === 'unreadable' || readability === 'unreadable') {
      if (score !== null || rubricItems.some((item) => item.score !== null)) throw invalid(`Unreadable question has unsupported score ${question.question_number}`)
    }
    return {
      question_id: question.question_id,
      question_number: question.question_number,
      question_text: question.question_text,
      student_solution: text(raw?.student_solution, 12000),
      steps,
      final_answer: text(raw?.final_answer, 2000),
      readability,
      score,
      max_score: question.max_score,
      confidence,
      status,
      comment: text(raw?.comment, 2000),
      rubric_items: rubricItems,
    }
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
  const complete = questions.length === key.length && questions.every((question) => ['graded', 'correct', 'partially_correct', 'wrong'].includes(question.status) && question.score !== null)
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
  let reviewByQuestion = new Map()
  if (job?.id) {
    const { data: reviews, error: reviewError } = await supabaseAdmin.from('ai_grading_reviews').select('question_id, teacher_score, teacher_comment').eq('grading_job_id', job.id)
    if (reviewError && reviewError.code !== '42P01') throw reviewError
    reviewByQuestion = new Map((reviews || []).map((review) => [String(review.question_id), review]))
  }
  return {
    submission_id: submission.id,
    submission_type: type,
    [parentColumn]: submission[parentColumn],
    submitted_at: submission.submitted_at,
    job_id: job?.id || null,
    status: job?.status || 'not_queued',
    grading_status: result?.grading_status || (job?.status === 'completed' ? 'graded' : job?.status === 'needs_review' ? 'needs_review' : job?.status || 'not_queued'),
    questions: Array.isArray(result?.questions) ? result.questions.map((question) => ({ ...question, final_score: numericOrNull(reviewByQuestion.get(String(question.question_id))?.teacher_score), final_comment: reviewByQuestion.get(String(question.question_id))?.teacher_comment || null })) : [],
    total_score: numericOrNull(result?.total_score),
    total_max_score: numericOrNull(result?.total_max_score),
    total_score_complete: result?.total_score_complete === true,
    final_score: numericOrNull(result?.final_score),
    final_max_score: numericOrNull(result?.final_max_score),
    final_score_complete: result?.final_score_complete === true,
    error_message: job?.error_message || null,
    created_at: job?.created_at || null,
    updated_at: job?.updated_at || null,
    completed_at: job?.completed_at || null,
  }
}

async function callGemini(model, files) {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini is not configured')
  const parts = [{ text: `You are the vision extraction stage for a handwritten Mathematics/Physics submission. Inspect every supplied page as one continuous submission and preserve page/question continuity. Return JSON only in this shape:
{"normalized_text":"...","student_solution":"...","questions":[{"question_number":1,"student_solution":"...","steps":[{"step_number":1,"content":"what is visibly written","math_expression":"LaTeX or faithful notation","intermediate_result":"...","confidence":0.0}],"final_answer":"...","readability":"clear|partial|unreadable","confidence":0.0}],"confidence":0.0,"missing_or_unreadable":false,"observations":[]}
Rules: do not infer missing handwriting, do not invent unseen solution steps, and do not silently correct ambiguous symbols. Preserve fractions, roots, superscripts, subscripts, vectors, signs, units, derivatives, integrals and equations. Treat x², x^2 and x2 as distinct observations when the image does not disambiguate. Prefer mathematical structure over plain OCR. If a key expression or answer is unreadable, mark the relevant question partial/unreadable and use a low confidence rather than guessing. ` }]
  validateJobFiles(files)
  for (const [index, file] of files.slice(0, env.AI_GRADING_MAX_IMAGES).entries()) {
    if (!String(file.mime || '').match(/^(image\/|application\/pdf$)/)) continue
    parts.push({ text: `Submission page/file ${index + 1} of ${files.length}. This page may continue a question from another page; do not restart numbering without visible evidence.` })
    const bytes = await withTimeout(async () => {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(file.path)
      if (error) throw error
      let buffer = Buffer.from(await data.arrayBuffer())
      if (file.mime === 'application/pdf') {
        try {
          const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true })
          if (pdf.getPageCount() > env.AI_GRADING_MAX_PDF_PAGES) { const error = new Error('PDF vượt số trang cho phép.'); error.code = 'INVALID_FILE_PAGES'; throw error }
        } catch (error) {
          if (error?.code === 'INVALID_FILE_PAGES') throw error
          const unreadable = new Error('PDF không đọc được.')
          unreadable.code = 'UNREADABLE_FILE'
          throw unreadable
        }
      }
      if (String(file.mime).startsWith('image/') && file.mime !== 'image/heic' && file.mime !== 'image/heif') {
        buffer = await sharp(buffer).resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
      }
      return buffer
    }, env.AI_GRADING_STORAGE_TIMEOUT_MS, 'Storage download')
    parts.push({ inline_data: { mime_type: String(file.mime).startsWith('image/') ? 'image/jpeg' : file.mime, data: bytes.toString('base64') } })
  }
  const response = await fetchProvider(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }) }, env.AI_GRADING_GEMINI_TIMEOUT_MS, 'Gemini')
  const payload = await response.json(); return parseJson(payload?.candidates?.[0]?.content?.parts?.[0]?.text)
}

async function callOcr(file) {
  if (!env.OCR_SPACE_API_KEY || !file || Number(file.size) > 1024 * 1024 || !String(file.mime || '').startsWith('image/')) return null
  const bytes = await withTimeout(async () => { const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(file.path); if (error) throw error; return Buffer.from(await data.arrayBuffer()) }, env.AI_GRADING_STORAGE_TIMEOUT_MS, 'Storage download')
  const body = new URLSearchParams({ apikey: env.OCR_SPACE_API_KEY, base64Image: `data:${file.mime};base64,${bytes.toString('base64')}`, language: 'eng', isOverlayRequired: 'false' })
  const response = await fetchProvider(env.OCR_SPACE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, env.AI_GRADING_OCR_TIMEOUT_MS, 'OCR.space')
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
    submission_evidence: { vision, ocr_fallback: ocr, ocr_is_supporting_evidence_only: true },
    instruction: `Grade each supplied question independently from the visible normalized solution, using only the expected_answer and rubric. Never create, omit, duplicate or rename a question. Do not infer missing handwriting or invent unseen solution steps. OCR is fallback/support only, never ground truth; if vision and OCR conflict on a score-relevant symbol, use needs_review with null score. Preserve and evaluate every visible step, intermediate result, final answer and confidence.
For Mathematics, accept mathematically equivalent expressions and valid alternative methods (factoring/expansion, equivalent fractions, roots, logarithms, trigonometry, vectors, geometry, derivatives, antiderivatives and integrals); never use string equality. For Physics, check formula, substitution, algebra, signs, vectors, arithmetic, dimensions and units; convert equivalent units (for example 10 m/s = 36 km/h), but do not ignore wrong units. A correct final answer with invalid reasoning is not automatically full credit; a wrong final answer with a valid method receives rubric-based partial credit; a later step that consistently follows an earlier arithmetic error may receive partial credit. Do not award points for unsupported claims.
Enforce the supplied rubric exactly: scores and rubric item scores must not exceed their max_score; do not invent criteria or totals. If evidence is insufficient for a rubric item, use needs_review and null for that item/question rather than zero. Return JSON only in this exact shape: {"questions":[{"question_id":"...","question_number":1,"question_text":"...","student_solution":"...","steps":[{"step_number":1,"content":"...","math_expression":"...","intermediate_result":"...","confidence":0.0}],"final_answer":"...","readability":"clear|partial|unreadable","score":1.5,"max_score":2,"confidence":0.94,"status":"correct|partially_correct|wrong|unreadable|needs_review","comment":"...","rubric_items":[{"criterion":"...","score":0.5,"max_score":0.5,"comment":"..."}]}]}. Do not return total_score, total_max_score or overall_comment.`,
  }
  const response = await fetchProvider('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.GROQ_MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: JSON.stringify(prompt) }] }) }, env.AI_GRADING_GROQ_TIMEOUT_MS, 'Groq')
  const payload = await response.json(); return validateGradeResult(payload?.choices?.[0]?.message?.content, answerKey)
}

async function processJob(job) {
  validateJobFiles(job.files || [])
  const answerKey = await loadAnswerKey(job)
  if (!answerKey) return { status: 'needs_review', result: { questions: [], reason: 'missing_answer_key_or_rubric' } }
  if (answerKey.invalid) return { status: 'needs_review', result: { questions: [], reason: 'invalid_answer_key_or_rubric', detail: text(answerKey.reason, 500) } }
  let vision
  try { vision = await callGemini(env.GEMINI_PRIMARY_MODEL, job.files || []); job.model_used = env.GEMINI_PRIMARY_MODEL }
  catch (error) { if (error?.code === 'UNREADABLE_FILE') { const grade = buildNeedsReviewResult(answerKey, 'Không đọc được file bài làm; cần giáo viên kiểm tra.'); return { status: 'needs_review', model: job.model_used, result: { ...grade, ...calculateGradeTotals(grade, answerKey), grading_status: 'needs_review' } } } if (!isRateLimited(error)) throw error; try { vision = await callGemini(env.GEMINI_SECONDARY_MODEL, job.files || []); job.model_used = env.GEMINI_SECONDARY_MODEL } catch (secondary) { if (secondary?.code === 'UNREADABLE_FILE') { const grade = buildNeedsReviewResult(answerKey, 'Không đọc được file bài làm; cần giáo viên kiểm tra.'); return { status: 'needs_review', model: job.model_used, result: { ...grade, ...calculateGradeTotals(grade, answerKey), grading_status: 'needs_review' } } } if (isRateLimited(secondary)) return { status: 'rate_limited', error: 'Gemini providers are rate limited', retryAfterMs: secondary.retryAfterMs }; throw secondary } }
  let ocr = null; const confidence = Number(vision?.confidence)
  if (!Number.isFinite(confidence) || confidence < env.AI_GRADING_OCR_CONFIDENCE_THRESHOLD) { try { ocr = await callOcr((job.files || [])[0]) } catch (error) { console.warn('[ai-grading] OCR fallback failed', { message: safeError(error) }) } }
  const visionQuestions = Array.isArray(vision?.questions) ? vision.questions : []
  const readableEvidence = !vision?.missing_or_unreadable && (text(vision?.normalized_text) || text(vision?.student_solution) || visionQuestions.some((question) => text(question?.student_solution) || Array.isArray(question?.steps) && question.steps.length) || text(ocr))
  if (!readableEvidence) {
    const grade = buildNeedsReviewResult(answerKey, 'Không đọc rõ bài làm; cần giáo viên kiểm tra.')
    return { status: 'needs_review', model: job.model_used, result: { ...grade, ...calculateGradeTotals(grade, answerKey), grading_status: 'needs_review' } }
  }
  const grade = await callGrader({ vision, ocr, job, answerKey })
  const totals = calculateGradeTotals(grade, answerKey)
  const finalConfidence = Math.min(Number(vision?.confidence) || 0, ...grade.questions.map((question) => Number(question.confidence) || 0))
  const hasUnreadableQuestion = grade.questions.some((question) => ['unreadable', 'needs_review'].includes(question.status) || question.readability === 'unreadable')
  const status = finalConfidence < env.AI_GRADING_REVIEW_CONFIDENCE_THRESHOLD || vision?.missing_or_unreadable || hasUnreadableQuestion || totals.grading_status === 'needs_review' ? 'needs_review' : 'completed'
  return { status, model: job.model_used, result: { ...grade, ...totals, grading_status: status === 'completed' ? 'graded' : 'needs_review', vision, ocr_used: Boolean(ocr), evidence_confidence: finalConfidence } }
}

export async function runOneGradingJob(workerId = 'ai-worker') {
  const { data, error } = await supabaseAdmin.rpc('claim_ai_grading_job', { p_max_attempts: env.AI_GRADING_MAX_ATTEMPTS })
  if (error) throw error
  const job = Array.isArray(data) ? data[0] : data; if (!job) return false
  const startedAt = Date.now()
  await supabaseAdmin.from('ai_grading_jobs').update({ locked_by: workerId, started_at: new Date(startedAt).toISOString() }).eq('id', job.id)
  try {
    const outcome = await withTimeout(() => processJob(job), env.AI_GRADING_JOB_TIMEOUT_MS, 'AI grading job')
    const completedAt = new Date().toISOString()
    const result = outcome.result || null
    const { error: saveError } = await supabaseAdmin.from('ai_grading_jobs').update({ status: outcome.status, provider: outcome.provider || 'gemini+ocr+groq', model_used: outcome.model || null, result, error_message: outcome.error || null, error_code: outcome.error_code || null, evidence_confidence: Number.isFinite(Number(result?.evidence_confidence)) ? Number(result.evidence_confidence) : null, usage: result?.usage || null, completed_at: ['completed', 'needs_review'].includes(outcome.status) ? completedAt : null, duration_ms: Date.now() - startedAt, locked_at: null, locked_by: null, next_attempt_at: outcome.status === 'rate_limited' ? new Date(Date.now() + Math.max(15 * 60_000, retryAfterMs(outcome))).toISOString() : null, updated_at: completedAt }).eq('id', job.id)
    if (saveError) throw saveError
    console.info('[ai-grading] job finished', { job_id: job.id, submission_id: job.submission_id, status: outcome.status, provider: outcome.provider || 'gemini+ocr+groq', model: outcome.model || job.model_used || null, attempt: job.attempt_count, duration_ms: Date.now() - startedAt })
  } catch (error) {
    const outcome = getFailureOutcome(error, job.attempt_count, env)
    await supabaseAdmin.from('ai_grading_jobs').update({ status: outcome.status, provider: 'gemini+ocr+groq', model_used: job.model_used || env.GEMINI_PRIMARY_MODEL, error_message: safeError(error), error_code: outcome.errorCode, locked_at: null, locked_by: null, duration_ms: Date.now() - startedAt, next_attempt_at: outcome.status === 'pending' || outcome.status === 'rate_limited' ? new Date(Date.now() + outcome.delayMs).toISOString() : null, updated_at: new Date().toISOString() }).eq('id', job.id)
    console.warn('[ai-grading] job failed', { job_id: job.id, submission_id: job.submission_id, status: outcome.status, provider: 'gemini+ocr+groq', model: job.model_used || env.GEMINI_PRIMARY_MODEL, attempt: job.attempt_count, duration_ms: Date.now() - startedAt, error_code: outcome.errorCode, error_message: safeError(error) })
  }
  return true
}

export function startAiGradingWorker({ workerId = 'ai-worker' } = {}) { if (!env.AI_GRADING_ENABLED) return () => {}; let running = false; const tick = async () => { if (running) return; running = true; try { await supabaseAdmin.rpc('recover_stuck_ai_grading_jobs', { p_stuck_after_seconds: Math.round(env.AI_GRADING_STUCK_AFTER_MS / 1000) }); await runGradingBatch({ concurrency: env.AI_GRADING_CONCURRENCY, runOne: () => runOneGradingJob(workerId) }) } catch (error) { console.error('[ai-grading] worker poll failed', { message: safeError(error) }) } finally { running = false } }; void tick(); const timer = setInterval(tick, env.AI_GRADING_POLL_MS); return () => clearInterval(timer) }
export { VALID_STATUSES }
