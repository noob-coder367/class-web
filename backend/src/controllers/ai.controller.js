import * as aiService from '../services/ai.service.js'

export async function chat(req, res, next) {
  try {
    const result = await aiService.chat({
      userId: req.user.id,
      message: req.body?.message,
      conversation: req.body?.conversation,
      conversationId: req.body?.conversationId,
    })
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.json(result)
  } catch (err) {
    next(err)
  }
}
