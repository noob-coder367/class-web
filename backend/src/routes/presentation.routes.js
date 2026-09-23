import { Router } from 'express'
import * as controller from '../controllers/presentation.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireMember } from '../middlewares/member.middleware.js'

const router = Router()
router.use(requireAuth, requireMember)
router.get('/', controller.list)
router.post('/:id/unlock', controller.unlock)
router.get('/:id', controller.get)
router.post('/', controller.create)
router.put('/:id', controller.update)
router.delete('/:id', controller.remove)

export default router
