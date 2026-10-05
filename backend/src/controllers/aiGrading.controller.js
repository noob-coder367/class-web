import { hasCapability } from '../lib/roles.js'
import { getGradingResult } from '../services/ai-grading/index.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

async function handle(type, req, res, next) {
  try {
    noStore(res)
    const isManager = hasCapability(req.profile?.role, 'homework')
    res.json(await getGradingResult(type, req.params.submissionId, req.profile, { isManager }))
  } catch (error) {
    next(error)
  }
}

export function getHomeworkResult(req, res, next) {
  return handle('homework', req, res, next)
}

export function getExamResult(req, res, next) {
  return handle('exam', req, res, next)
}
