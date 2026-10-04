import * as classMoneyService from '../services/classMoney.service.js'

function actorId(req) {
  return req.profile?.id || req.user?.id
}

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
}

export async function overview(req, res, next) {
  try { noStore(res); res.json(await classMoneyService.getOverview(req.query?.bookId)) } catch (err) { next(err) }
}
export async function members(req, res, next) {
  try { noStore(res); res.json(await classMoneyService.getMembers()) } catch (err) { next(err) }
}
export async function books(req, res, next) {
  try { noStore(res); res.json({ books: await classMoneyService.listBooks() }) } catch (err) { next(err) }
}
export async function createBook(req, res, next) {
  try { noStore(res); res.status(201).json({ book: await classMoneyService.createBook(req.body, actorId(req)) }) } catch (err) { next(err) }
}
export async function collections(req, res, next) {
  try { noStore(res); res.json({ collections: await classMoneyService.listCollections(req.query?.bookId) }) } catch (err) { next(err) }
}
export async function createCollection(req, res, next) {
  try { noStore(res); res.status(201).json(await classMoneyService.createCollection(req.body, actorId(req))) } catch (err) { next(err) }
}
export async function getCollection(req, res, next) {
  try { noStore(res); res.json(await classMoneyService.getCollection(req.params.id)) } catch (err) { next(err) }
}
export async function patchCollectionMember(req, res, next) {
  try { noStore(res); res.json({ member: await classMoneyService.updateCollectionMember(req.params.id, req.body, actorId(req)) }) } catch (err) { next(err) }
}
export async function uploadCollectionMemberPhotoUrl(req, res, next) {
  try { noStore(res); res.json(await classMoneyService.createMoneyPhotoUploadUrl(req.params.id, req.body || {})) } catch (err) { next(err) }
}
export async function uploadCollectionMemberPhoto(req, res, next) {
  try { noStore(res); res.json({ member: await classMoneyService.uploadCollectionMemberPhoto(req.params.id, req.body, actorId(req)) }) } catch (err) { next(err) }
}
export async function expenses(req, res, next) {
  try { noStore(res); res.json(await classMoneyService.listExpenses(req.query?.bookId, req.query)) } catch (err) { next(err) }
}
export async function createExpense(req, res, next) {
  try { noStore(res); res.status(201).json({ expense: await classMoneyService.createExpense(req.body, actorId(req)) }) } catch (err) { next(err) }
}
export async function patchExpense(req, res, next) {
  try { noStore(res); res.json({ expense: await classMoneyService.updateExpense(req.params.id, req.body, actorId(req)) }) } catch (err) { next(err) }
}
export async function deleteExpense(req, res, next) {
  try { noStore(res); res.json(await classMoneyService.deleteExpense(req.params.id, actorId(req))) } catch (err) { next(err) }
}
export async function transactions(req, res, next) {
  try { noStore(res); res.json(await classMoneyService.listTransactions(req.query?.bookId, req.query)) } catch (err) { next(err) }
}
export async function auditLogs(req, res, next) {
  try { noStore(res); res.json(await classMoneyService.listAuditLogs(req.query?.bookId, req.query)) } catch (err) { next(err) }
}
