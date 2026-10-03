import express, { Router } from 'express'
import * as controller from '../controllers/resource.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireResourceAccess } from '../middlewares/resource.middleware.js'
const router = Router()
router.use(requireAuth, requireResourceAccess)
router.use(express.json({ limit: '1100mb' }))
router.get('/categories', controller.categories)
router.post('/categories', controller.createCategory)
router.patch('/categories/:id', controller.updateCategory)
router.delete('/categories/:id', controller.deleteCategory)
router.get('/', controller.list)
router.post('/', controller.create)
router.get('/:id', controller.get)
router.patch('/:id', controller.update)
router.delete('/:id', controller.remove)
router.post('/:id/files', controller.files)
router.delete('/files/:id', controller.deleteFile)
export default router
