import * as service from '../services/exam.service.js'
import { hasCapability } from '../lib/roles.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}
const wrap = (fn) => async (req, res, next) => {
  try { noStore(res); await fn(req, res) } catch (err) { next(err) }
}

export const listExams = wrap(async (req, res) => res.json(await service.listExams(req.profile)))
export const getExam = wrap(async (req, res) =>
  res.json(await service.getExam(req.params.id, req.profile, { isManager: hasCapability(req.profile?.role, 'homework') })))
export const startExam = wrap(async (req, res) => res.status(201).json(await service.startExam(req.params.id, req.profile)))
export const startSubmissionUpload = wrap(async (req, res) =>
  res.status(201).json(await service.createSubmissionUploadIntent(req.params.id, req.body?.files, req.profile)))
export const completeSubmissionUpload = wrap(async (req, res) =>
  res.status(201).json({ message: 'Đã nộp bài.', ...(await service.completeSubmissionUpload(req.params.id, req.body?.intent_id, req.profile)) }))
export const cancelSubmissionUpload = wrap(async (req, res) =>
  res.json(await service.cancelSubmissionUpload(req.params.intentId, req.profile)))
export const getExamStatus = wrap(async (req, res) => res.json(await service.getExamStatus(req.params.id)))
export const getExamGradingStatus = wrap(async (req, res) => res.json(await service.getExamGradingStatus(req.params.id)))
export const startExamGrading = wrap(async (req, res) => res.status(202).json(await service.startExamGrading(req.params.id, req.profile)))
export const getSubmissionDetail = wrap(async (req, res) =>
  res.json(await service.getSubmissionDetail(req.params.id, req.params.userId)))
export const createImageUploadUrls = wrap(async (req, res) => res.json(await service.createExamImageUploadUrls(req.body?.files)))
export const createExam = wrap(async (req, res) =>
  res.status(201).json({ message: 'Đã tạo bài kiểm tra.', item: await service.createExam(req.body || {}, req.profile) }))
export const deleteExam = wrap(async (req, res) => res.json(await service.deleteExam(req.params.id)))
