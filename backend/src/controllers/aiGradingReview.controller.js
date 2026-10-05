import * as reviewService from '../services/ai-grading/review.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}
async function handleGet(type, req, res, next) {
  try { noStore(res); res.json(await reviewService.getReview(type, req.params.submissionId, req.profile)) } catch (error) { next(error) }
}
async function handleSave(type, req, res, next) {
  try { noStore(res); res.json(await reviewService.saveReview(type, req.params.submissionId, req.body, req.profile)) } catch (error) { next(error) }
}
export function getHomeworkReview(req, res, next) { return handleGet('homework', req, res, next) }
export function saveHomeworkReview(req, res, next) { return handleSave('homework', req, res, next) }
export function getExamReview(req, res, next) { return handleGet('exam', req, res, next) }
export function saveExamReview(req, res, next) { return handleSave('exam', req, res, next) }
