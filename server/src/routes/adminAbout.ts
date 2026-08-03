import { Router } from 'express'
import { adminGetAbout, updateAbout } from '../controllers/adminAboutController'

const router = Router()

// GET /api/admin/about — 获取关于页
router.get('/', adminGetAbout)

// PUT /api/admin/about — 更新关于页
router.put('/', updateAbout)

export default router
