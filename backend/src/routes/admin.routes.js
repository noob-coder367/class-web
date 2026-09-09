import { Router } from 'express'
import * as adminController from '../controllers/admin.controller.js'
import * as imagesController from '../controllers/images.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireAdmin } from '../middlewares/admin.middleware.js'

const router = Router()

// Mọi route trong file này đều yêu cầu: đã đăng nhập + role === 'admin'
router.use(requireAuth, requireAdmin)

router.get('/users', adminController.getUsers)
router.patch('/users/:id/member', adminController.patchMember)
router.patch('/users/:id/role', adminController.patchRole)
router.delete('/users/:id', adminController.removeUser)

router.get('/images', imagesController.getAdminImages)
router.post('/images', imagesController.postAdminImage)
router.delete('/images', imagesController.deleteAdminImage)

export default router
