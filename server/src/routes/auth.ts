import { Router } from 'express'
import { login, getMe } from '../controllers/authController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// POST /api/auth/login — 登录
router.post('/login', login)

// GET /api/auth/me — 获取当前用户（需鉴权）
router.get('/me', authMiddleware, getMe)

export default router
