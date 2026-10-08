import * as service from '../services/adminContent.service.js'
const wrap = (fn) => async (req, res, next) => { try { res.json(await fn(req)) } catch (error) { next(error) } }
export const rooms = wrap(async () => ({ rooms: await service.listRooms() }))
export const updateRoom = wrap(async (req) => ({ room: await service.updateRoom(req.params.id, req.body) }))
export const deleteRoom = wrap(async (req) => ({ deleted: await service.deleteRoom(req.params.id) }))
export const quizzes = wrap(async () => ({ quizzes: await service.listQuizzes() }))
export const questions = wrap(async (req) => ({ questions: await service.listQuestions(req.params.id) }))
export const updateQuestion = wrap(async (req) => ({ question: await service.updateQuestion(req.params.id, req.body) }))
export const deleteQuestion = wrap(async (req) => ({ deleted: await service.deleteQuestion(req.params.id) }))
