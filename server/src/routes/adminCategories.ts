import { Router } from 'express'
import { adminGetCategories, createCategory, updateCategory, deleteCategory } from '../controllers/adminCategoryController'

const router = Router()

// GET /api/admin/categories — 分类列表
router.get('/', adminGetCategories)

// POST /api/admin/categories — 新建
router.post('/', createCategory)

// PUT /api/admin/categories/:id — 更新
router.put('/:id', updateCategory)

// DELETE /api/admin/categories/:id — 删除
router.delete('/:id', deleteCategory)

export default router
