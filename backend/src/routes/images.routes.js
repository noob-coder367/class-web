import { Router } from 'express'
import * as imagesController from '../controllers/images.controller.js'

const router = Router()

// Công khai — trang chủ cần đọc ảnh giáo viên / ảnh lớp.
router.get('/', imagesController.getPublicImages)

export default router
