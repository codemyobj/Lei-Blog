import { Router } from 'express'
import { adminGetPosts, adminGetPost, createPost, updatePost, deletePost } from '../controllers/adminPostController'

const router = Router()

// GET /api/admin/posts — 后台文章列表（含草稿）
router.get('/', adminGetPosts)

// GET /api/admin/posts/:id — 获取单篇
router.get('/:id', adminGetPost)

// POST /api/admin/posts — 新建
router.post('/', createPost)

// PUT /api/admin/posts/:id — 更新
router.put('/:id', updatePost)

// DELETE /api/admin/posts/:id — 删除
router.delete('/:id', deletePost)

export default router
