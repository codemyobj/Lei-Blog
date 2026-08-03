import { Router } from 'express'
import { getPosts, getPostBySlug } from '../controllers/postController'

const router = Router()

// GET /api/posts — 文章列表（分页，可选 ?tag=slug）
router.get('/', getPosts)

// GET /api/posts/:slug — 文章详情
router.get('/:slug', getPostBySlug)

export default router
