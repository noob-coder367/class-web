import { Router } from 'express'
import multer from 'multer'
import * as controller from '../controllers/resource.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireResourceAccess } from '../middlewares/resource.middleware.js'

const router = Router()
const uploadResourceFile = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, Boolean(file?.originalname)),
})

router.use(requireAuth, requireResourceAccess)
router.get('/categories', controller.categories)
router.post('/categories', controller.createCategory)
router.patch('/categories/:id', controller.updateCategory)
router.delete('/categories/:id', controller.deleteCategory)
router.get('/', controller.list)
router.post('/', controller.create)
router.get('/:id', controller.get)
router.patch('/:id', controller.update)
router.delete('/:id', controller.remove)
router.post('/:id/files', uploadResourceFile.single('file'), controller.file)
router.delete('/files/:id', controller.deleteFile)
export default router
