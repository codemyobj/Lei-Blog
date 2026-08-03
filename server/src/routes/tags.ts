import { Router } from 'express'
import { getTags, getTagBySlug } from '../controllers/tagController'

const router = Router()

// GET /api/tags — 所有标签
router.get('/', getTags)

// GET /api/tags/:slug — 标签详情
router.get('/:slug', getTagBySlug)

export default router
