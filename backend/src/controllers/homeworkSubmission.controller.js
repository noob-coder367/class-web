import * as service from '../services/homeworkSubmission.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

export async function listAssignments(req, res, next) {
  try {
    noStore(res)
    res.json({ items: await service.listAssignments(req.profile) })
  } catch (err) { next(err) }
}

export async function createAssignment(req, res, next) {
  try {
    noStore(res)
    const item = await service.createAssignment(req.body || {}, req.profile)
    res.status(201).json({ message: 'Đã tạo bài tập.', item })
  } catch (err) { next(err) }
}

export async function deleteAssignment(req, res, next) {
  try {
    noStore(res)
    res.json(await service.deleteAssignment(req.params.id))
  } catch (err) { next(err) }
}

export async function submitAssignment(req, res, next) {
  try {
    noStore(res)
    const result = await service.submitAssignment(req.params.id, req.body?.files, req.profile)
    res.status(201).json({ message: 'Đã nộp bài.', ...result })
  } catch (err) { next(err) }
}

export async function getAssignmentStatus(req, res, next) {
  try {
    noStore(res)
    res.json(await service.getAssignmentStatus(req.params.id))
  } catch (err) { next(err) }
}

export async function getSubmissionDetail(req, res, next) {
  try {
    noStore(res)
    res.json(await service.getSubmissionDetail(req.params.id, req.params.userId))
  } catch (err) { next(err) }
}
