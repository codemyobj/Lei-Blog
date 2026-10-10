import { Router } from 'express'
import { search } from '../controllers/searchController'

const router = Router()

// GET /api/search?q=关键词&page=1&pageSize=10 — 全文搜索
router.get('/', search)

export default router
