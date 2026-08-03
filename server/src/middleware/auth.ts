// ============================================================
// JWT 鉴权中间件
//
// 工作流程：
// 1. 从 Authorization 头提取 "Bearer <token>"
// 2. 用 JWT_SECRET 验证 token
// 3. 有效 → 将 userId 挂载到 req 对象 → 调用 next()
// 4. 无效 → 返回 401
// ============================================================

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// 扩展 Express Request 类型，包含已认证用户的 ID
export interface AuthRequest extends Request {
  userId?: number
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' })
    return
  }

  const token = header.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number
    }
    req.userId = decoded.userId
    next()
  } catch {
    res.status(401).json({ error: '令牌无效或已过期' })
    return
  }
}
