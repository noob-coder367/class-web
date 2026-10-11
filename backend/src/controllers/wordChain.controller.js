import * as service from '../services/game/wordChain.service.js'
const wrap = (fn) => async (req, res, next) => { try { await fn(req, res) } catch (error) { next(error) } }
const requestId = (req) => req.get('Idempotency-Key') || null
export const create = wrap(async (req, res) => res.status(201).json({ room: await service.createRoom(req.user.id, req.body, requestId(req)) }))
export const get = wrap(async (req, res) => res.json({ room: await service.getRoomState(req.params.code, req.user.id) }))
export const join = wrap(async (req, res) => res.json({ room: await service.joinRoom(req.params.code, req.user.id) }))
export const start = wrap(async (req, res) => res.json({ room: await service.startRoom(req.params.code, req.user.id) }))
export const answer = wrap(async (req, res) => res.json({ room: await service.submitAnswer(req.params.code, req.user.id, req.body, requestId(req)) }))
export const skip = wrap(async (req, res) => res.json({ room: await service.skipTurn(req.params.code, req.user.id, requestId(req)) }))
