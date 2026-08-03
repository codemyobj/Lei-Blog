import { Router } from 'express'
import { adminGetTags, createTag, updateTag, deleteTag } from '../controllers/adminTagController'

const router = Router()

// GET /api/admin/tags — 标签列表
router.get('/', adminGetTags)

// POST /api/admin/tags — 新建
router.post('/', createTag)

// PUT /api/admin/tags/:id — 更新
router.put('/:id', updateTag)

// DELETE /api/admin/tags/:id — 删除
router.delete('/:id', deleteTag)

export default router
