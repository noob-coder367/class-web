import { Router } from 'express'
import * as controller from '../controllers/adminAccount.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireAdmin } from '../middlewares/admin.middleware.js'

const router = Router()
router.use(requireAuth, requireAdmin)
router.get('/', controller.list)
router.patch('/:id/display-name', controller.renameGhost)
router.delete('/:id', controller.removeGhost)
export default router
