import { Router } from 'express'
import * as controller from '../controllers/classMoney.controller.js'

const router = Router()

router.get('/overview', controller.overview)
router.get('/members', controller.members)
router.get('/books', controller.books)
router.post('/books', controller.createBook)
router.get('/collections', controller.collections)
router.post('/collections', controller.createCollection)
router.get('/collections/:id', controller.getCollection)
router.patch('/collection-members/:id', controller.patchCollectionMember)
router.post('/collection-members/:id/photo/upload-url', controller.uploadCollectionMemberPhotoUrl)
router.post('/collection-members/:id/photo', controller.uploadCollectionMemberPhoto)
router.get('/expenses', controller.expenses)
router.post('/expenses', controller.createExpense)
router.patch('/expenses/:id', controller.patchExpense)
router.delete('/expenses/:id', controller.deleteExpense)
router.get('/transactions', controller.transactions)
router.get('/audit-logs', controller.auditLogs)

export default router
