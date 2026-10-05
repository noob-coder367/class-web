import { env } from '../../config/env.js'
import { supabaseAdmin } from '../../config/supabaseClient.js'

const BUCKET = 'classroom-data'
const VALID_STATUSES = new Set(['pending', 'processing', 'completed', 'failed', 'rate_limited', 'needs_review'])

function safeError(error) {
  return String(error?.message || error || 'unknown error').replace(/(?:Bearer\s+|api[_-]?key[=:]\s*)[^\s,;]+/gi, '[redacted]').slice(0, 500)
}
function isRateLimited(error) { return error?.status === 429 || /\b429\b|rate.?limit|quota/i.test(String(error?.message || error)) }
function cleanJson(value) { return String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() }
export function validateGradeResult(value, maxScore = null) {
  const result = typeof value === 'string' ? JSON.parse(cleanJson(value)) : value
  const score = Number(result?.score); const maximum = Number(result?.max_score ?? maxScore)
  if (!Number.isFinite(score) || !Number.isFinite(maximum) || maximum <= 0 || score < 0 || score > maximum) throw new Error('Invalid grading JSON score')
  if (!Array.isArray(result.questions)) throw new Error('Invalid grading JSON questions')
  return { score, max_score: maximum, questions: result.questions.map((q) => ({ question: String(q?.question || '').slice(0, 200), score: Number(q?.score), max_score: Number(q?.max_score), comment: String(q?.comment || '').slice(0, 2000), confidence: Number(q?.confidence) })).filter((q) => Number.isFinite(q.score) && Number.isFinite(q.max_score) && q.score >= 0 && q.score <= q.max_score), overall_comment: String(result?.overall_comment || '').slice(0, 4000), confidence: Number(result?.confidence) }
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
  const payload = await response.json(); return JSON.parse(cleanJson(payload?.candidates?.[0]?.content?.parts?.[0]?.text))
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
async function callGrader({ vision, ocr, job }) {
  if (!env.GROQ_API_KEY) throw new Error('Groq is not configured')
  const prompt = { submission: vision, ocr_fallback: ocr, max_score: job.max_score || 10, instruction: 'Grade only from supplied evidence. Return strict JSON: {score,max_score,questions:[{question,score,max_score,comment,confidence}],overall_comment,confidence}.' }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.GROQ_MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: JSON.stringify(prompt) }] }) })
  if (!response.ok) { const error = new Error(`Groq grading request failed (${response.status})`); error.status = response.status; throw error }
  const payload = await response.json(); return validateGradeResult(payload?.choices?.[0]?.message?.content, job.max_score || 10)
}
async function processJob(job) {
  let vision
  try { vision = await callGemini(env.GEMINI_PRIMARY_MODEL, job.files || []); job.model_used = env.GEMINI_PRIMARY_MODEL }
  catch (error) { if (!isRateLimited(error)) throw error; try { vision = await callGemini(env.GEMINI_SECONDARY_MODEL, job.files || []); job.model_used = env.GEMINI_SECONDARY_MODEL } catch (secondary) { if (isRateLimited(secondary)) return { status: 'rate_limited', error: 'Gemini providers are rate limited' }; throw secondary } }
  let ocr = null; const confidence = Number(vision?.confidence)
  if (!Number.isFinite(confidence) || confidence < env.AI_GRADING_OCR_CONFIDENCE_THRESHOLD) { try { ocr = await callOcr((job.files || [])[0]) } catch (error) { console.warn('[ai-grading] OCR fallback failed', { message: safeError(error) }) } }
  const grade = await callGrader({ vision, ocr, job }); const finalConfidence = Math.min(Number(vision?.confidence) || 0, Number(grade.confidence) || 0)
  return { status: finalConfidence < env.AI_GRADING_REVIEW_CONFIDENCE_THRESHOLD || vision?.missing_or_unreadable ? 'needs_review' : 'completed', model: job.model_used, result: { ...grade, vision, ocr_used: Boolean(ocr), confidence: finalConfidence } }
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
