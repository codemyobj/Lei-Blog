import { Router } from 'express'
import { getCategories, getCategoryBySlug } from '../controllers/categoryController'

const router = Router()

// GET /api/categories — 所有分类（含文章数）
router.get('/', getCategories)

// GET /api/categories/:slug — 分类详情
router.get('/:slug', getCategoryBySlug)

export default router
