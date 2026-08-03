// ============================================================
// Blog — Vercel Serverless Function 入口
// 将 Express app 导出供 Vercel @vercel/node 运行时调用
// 所有 /api/* 请求由 vercel.json 重写路由到此
// ============================================================

import app from '../server/src/app'

export default app
