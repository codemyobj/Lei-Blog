import { Router } from 'express'
import { getPosts, getPostBySlug, getArchive } from '../controllers/postController'

const router = Router()

// GET /api/posts/archive — 归档列表
// ⚠️ 固定路径必须注册在 /:slug **之前**，否则会被下面的 slug 路由吃掉
router.get('/archive', getArchive)

// GET /api/posts — 文章列表（分页，可选 ?tag=slug / ?category=slug）
router.get('/', getPosts)

// GET /api/posts/:slug — 文章详情
router.get('/:slug', getPostBySlug)

export default router
