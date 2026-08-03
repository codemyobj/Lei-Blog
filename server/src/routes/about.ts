import { Router } from 'express'
import { getAbout } from '../controllers/aboutController'

const router = Router()

// GET /api/about — 关于页内容
router.get('/', getAbout)

export default router
