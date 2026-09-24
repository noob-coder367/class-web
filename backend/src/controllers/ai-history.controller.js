import * as aiHistoryService from '../services/ai-history.service.js'

function userId(req) {
  return req.user?.id
}

export async function quota(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.json(await aiHistoryService.getQuota(userId(req)))
  } catch (err) {
    next(err)
  }
}

export async function listConversations(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.json({ conversations: await aiHistoryService.listConversations(userId(req)) })
  } catch (err) {
    next(err)
  }
}

export async function createConversation(req, res, next) {
  try {
    res.status(201).json({ conversation: await aiHistoryService.createConversation(userId(req), req.body?.title) })
  } catch (err) {
    next(err)
  }
}

export async function getConversation(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.json(await aiHistoryService.getConversation(userId(req), req.params.id))
  } catch (err) {
    next(err)
  }
}

export async function deleteConversation(req, res, next) {
  try {
    res.json(await aiHistoryService.deleteConversation(userId(req), req.params.id))
  } catch (err) {
    next(err)
  }
}
