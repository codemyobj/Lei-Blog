// ============================================================
// Blog Server — 常驻进程启动入口（PM2 / systemd / 本地开发通用）
// 监听 HTTP 端口，并在收到 SIGTERM / SIGINT 时优雅关闭。
// ============================================================

import app from './app'
import pool from './config/db'

const PORT = process.env.PORT || 8080

// 优雅关闭的兜底超时（毫秒）：超过则强制退出，避免 PM2 restart 时进程挂起
const SHUTDOWN_TIMEOUT_MS = 10_000

console.log('Starting Blog server...')
console.log('PORT:', PORT)
console.log('CWD:', process.cwd())

const server = app.listen(PORT, () => {
  console.log(`🚀 Blog server running on http://localhost:${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
})

/**
 * 优雅关闭：停止接收新连接 → 等待存量请求结束 → 释放数据库连接池 → 退出。
 *
 * PM2 restart / Docker stop / systemd stop 都会先发 SIGTERM。若不做处理，
 * 进程被硬杀会导致 PostgreSQL 连接池残留连接，频繁发布会耗尽 max_connections。
 */
let isShuttingDown = false

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`)

  // 兜底：无论如何都要退出，防止 keep-alive 长连接导致进程挂起
  const forceExitTimer = setTimeout(() => {
    console.error('[shutdown] Timeout exceeded, forcing exit.')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  // 不阻止事件循环退出
  forceExitTimer.unref()

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
    console.log('[shutdown] HTTP server closed.')
  } catch (err) {
    console.error('[shutdown] Error closing HTTP server:', err)
  }

  try {
    await pool.end()
    console.log('[shutdown] PostgreSQL pool closed.')
  } catch (err) {
    console.error('[shutdown] Error closing database pool:', err)
  }

  console.log('[shutdown] Bye.')
  process.exit(0)
}

// PM2 restart / systemd stop / Docker stop 默认信号
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM') })
// Ctrl+C / 前台运行时的中断信号
process.on('SIGINT', () => { void gracefulShutdown('SIGINT') })

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, _promise) => {
  console.error('Unhandled rejection:', reason)
})
