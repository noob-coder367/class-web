import { Router } from 'express'
import { requireRoomIdentity } from '../middlewares/auth.middleware.js'
import * as controller from '../controllers/gameRoom.controller.js'
const router = Router()
router.get('/open', controller.open)
router.use(requireRoomIdentity)
router.post('/', controller.create)
// Phòng đang mở (sảnh) của một game. Đặt trước '/:code'.
router.get('/open/:gameKey', controller.listOpen)
router.get('/:code', controller.get)
router.post('/:code/join', controller.join)
router.post('/:code/start', controller.start)
router.post('/:code/answer', controller.answer)
router.post('/:code/dice-complete', controller.diceComplete)
router.post('/:code/move', controller.move)
router.post('/:code/move-batch', controller.moveBatch)
router.post('/:code/switch-turn', controller.switchTurn)
router.patch('/:code/visibility', controller.updateVisibility)
router.post('/:code/leave', controller.leave)
export default router
