// ============================================================
// Blog Server — Express App（本地开发与 Vercel 共用）
// 此文件配置 Express app 但不启动服务器，
// 供 index.ts（本地）和 api/（Vercel）导入
// ============================================================

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import postsRoutes from './routes/posts'
import tagsRoutes from './routes/tags'
import aboutRoutes from './routes/about'
import { authMiddleware } from './middleware/auth'
import adminPostRoutes from './routes/adminPosts'
import adminTagRoutes from './routes/adminTags'
import adminAboutRoutes from './routes/adminAbout'

dotenv.config()

const app = express()

// --- CORS ---
const corsOrigin = process.env.ALLOWED_ORIGINS?.split(',') ?? [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}))

app.use(express.json())

// --- 公开路由 ---
app.use('/api/auth', authRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/tags', tagsRoutes)
app.use('/api/about', aboutRoutes)

// --- 鉴权路由（后台管理） ---
app.use('/api/admin/posts', authMiddleware, adminPostRoutes)
app.use('/api/admin/tags', authMiddleware, adminTagRoutes)
app.use('/api/admin/about', authMiddleware, adminAboutRoutes)

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
