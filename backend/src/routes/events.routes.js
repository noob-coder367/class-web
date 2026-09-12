import { Router } from 'express'
import * as eventsController from '../controllers/events.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { requireCapability } from '../middlewares/admin.middleware.js'

const router = Router()

// Đọc công khai (trang chủ). Ghi bắt buộc: đăng nhập + capability events
// (admin hoặc lớp phó sự kiện). Role lấy từ token, không tin body client.
router.get('/', eventsController.listEvents)
router.post('/', requireAuth, requireCapability('events'), eventsController.createEvent)
router.delete('/:id', requireAuth, requireCapability('events'), eventsController.deleteEvent)
router.patch(
  '/:id/expiry',
  requireAuth,
  requireCapability('events'),
  eventsController.updateEventExpiry
)

export default router
