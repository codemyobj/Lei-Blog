// ============================================================
// Blog Server — 本地开发启动入口
// 启动 Express 服务器，Vercel 生产环境不使用（见 /api/index.ts）
// ============================================================

import app from './app'

const PORT = process.env.PORT || 8080

console.log('Starting Blog server...')
console.log('PORT:', PORT)

const server = app.listen(PORT, () => {
  console.log(`🚀 Blog server running on http://localhost:${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason)
})
