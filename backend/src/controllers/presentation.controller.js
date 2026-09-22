import * as presentationService from '../services/presentation.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

function readPassword(req) {
  return req.body?.password || req.query?.password || ''
}

export async function list(req, res, next) {
  try {
    noStore(res)
    res.json({ items: await presentationService.listPresentations(req.profile) })
  } catch (err) {
    next(err)
  }
}

export async function get(req, res, next) {
  try {
    noStore(res)
    const item = await presentationService.getPresentation(req.params.id, req.profile, readPassword(req))
    res.json({ item })
  } catch (err) {
    next(err)
  }
}

export async function unlock(req, res, next) {
  try {
    noStore(res)
    const item = await presentationService.getPresentation(req.params.id, req.profile, req.body?.password || '')
    res.json({ item })
  } catch (err) {
    next(err)
  }
}

export async function create(req, res, next) {
  try {
    noStore(res)
    res.status(201).json({ item: await presentationService.createPresentation(req.body || {}, req.profile) })
  } catch (err) {
    next(err)
  }
}

export async function update(req, res, next) {
  try {
    noStore(res)
    res.json({ item: await presentationService.updatePresentation(req.params.id, req.body || {}, req.profile) })
  } catch (err) {
    next(err)
  }
}

export async function remove(req, res, next) {
  try {
    noStore(res)
    res.json(await presentationService.deletePresentation(req.params.id, req.profile))
  } catch (err) {
    next(err)
  }
}

export async function uploadImage(req, res, next) {
  try {
    noStore(res)
    const result = await presentationService.uploadPresentationImage(req.body || {})
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}
