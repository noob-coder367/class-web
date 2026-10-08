import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.middleware.js'
import * as controller from '../controllers/gameRoom.controller.js'
const router = Router()
router.use(requireAuth)
router.post('/', controller.create)
router.get('/:code', controller.get)
router.post('/:code/join', controller.join)
router.post('/:code/start', controller.start)
router.post('/:code/answer', controller.answer)
router.post('/:code/dice-complete', controller.diceComplete)
router.post('/:code/move', controller.move)
router.post('/:code/move-batch', controller.moveBatch)
router.post('/:code/switch-turn', controller.switchTurn)
export default router
