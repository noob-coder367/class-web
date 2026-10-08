import * as gameRoomService from '../services/game/gameRoom.service.js'
const wrap = (fn) => async (req, res, next) => { try { await fn(req, res) } catch (error) { next(error) } }
export const create = wrap(async (req, res) => res.status(201).json({ room: await gameRoomService.createRoom(req.user.id, req.body) }))
export const get = wrap(async (req, res) => res.json({ room: await gameRoomService.getRoomState(req.params.code, req.user.id) }))
export const join = wrap(async (req, res) => res.json({ room: await gameRoomService.joinRoom(req.params.code, req.user.id, req.body) }))
export const start = wrap(async (req, res) => res.json({ room: await gameRoomService.startRoom(req.params.code, req.user.id) }))
export const answer = wrap(async (req, res) => res.json({ room: await gameRoomService.answerRoom(req.params.code, req.user.id, req.body) }))
export const diceComplete = wrap(async (req, res) => res.json({ room: await gameRoomService.completeDiceRoll(req.params.code, req.user.id) }))
export const move = wrap(async (req, res) => res.json({ room: await gameRoomService.moveRoom(req.params.code, req.user.id, req.body.direction) }))
export const switchTurn = wrap(async (req, res) => res.json({ room: await gameRoomService.switchRoomTurn(req.params.code, req.user.id, req.body.team_id) }))
