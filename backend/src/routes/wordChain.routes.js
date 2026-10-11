import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.middleware.js'
import * as controller from '../controllers/wordChain.controller.js'

const router = Router()
router.use(requireAuth)
router.post('/rooms', controller.create)
router.get('/rooms/:code', controller.get)
router.post('/rooms/:code/join', controller.join)
router.post('/rooms/:code/start', controller.start)
router.post('/rooms/:code/answer', controller.answer)
router.post('/rooms/:code/skip', controller.skip)
export default router
