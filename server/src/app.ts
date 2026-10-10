// ============================================================
// Blog Server — Express App（本地开发与常驻部署共用）
//
// 此文件只配置 Express app，**不启动监听**。
// 启动与优雅关闭见 server/src/index.ts（PM2 / 本地 `npm run dev`）。
// ============================================================

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import postsRoutes from './routes/posts'
import tagsRoutes from './routes/tags'
import categoriesRoutes from './routes/categories'
import searchRoutes from './routes/search'
import aboutRoutes from './routes/about'
import { authMiddleware } from './middleware/auth'
import adminPostRoutes from './routes/adminPosts'
import adminTagRoutes from './routes/adminTags'
import adminCategoryRoutes from './routes/adminCategories'
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
app.use('/api/categories', categoriesRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/about', aboutRoutes)

// --- 鉴权路由（后台管理） ---
app.use('/api/admin/posts', authMiddleware, adminPostRoutes)
app.use('/api/admin/tags', authMiddleware, adminTagRoutes)
app.use('/api/admin/categories', authMiddleware, adminCategoryRoutes)
app.use('/api/admin/about', authMiddleware, adminAboutRoutes)

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
