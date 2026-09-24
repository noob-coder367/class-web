import * as aiService from '../services/ai.service.js'

export async function chat(req, res, next) {
  try {
    const result = await aiService.chat({
      message: req.body?.message,
      conversation: req.body?.conversation,
    })
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.json(result)
  } catch (err) {
    next(err)
  }
}
