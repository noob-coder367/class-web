import * as feedbackService from '../services/feedback.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

export async function listFeedback(req, res, next) {
  try { noStore(res); res.json({ items: await feedbackService.listFeedback(req.profile) }) } catch (err) { next(err) }
}
export async function createFeedback(req, res, next) {
  try { noStore(res); res.status(201).json({ item: await feedbackService.createFeedback(req.body || {}, req.profile) }) } catch (err) { next(err) }
}
export async function toggleFeedbackLike(req, res, next) {
  try { noStore(res); res.json(await feedbackService.toggleFeedbackLike(req.params.id, req.profile)) } catch (err) { next(err) }
}
export async function deleteFeedback(req, res, next) {
  try { noStore(res); res.json(await feedbackService.deleteFeedback(req.params.id, req.profile)) } catch (err) { next(err) }
}
