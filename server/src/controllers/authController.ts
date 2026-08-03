import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db'
import type { LoginBody, SafeUser, UserRow } from '../types'

function toSafeUser(user: UserRow): SafeUser {
  const { password_hash, ...safe } = user
  return safe
}

function generateToken(userId: number): string {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )
}

// POST /api/auth/login — 登录获取 JWT
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginBody = req.body

    if (!email || !password) {
      res.status(400).json({ error: '邮箱和密码为必填项' })
      return
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: '邮箱或密码错误' })
      return
    }

    const user = result.rows[0] as UserRow

    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      res.status(401).json({ error: '邮箱或密码错误' })
      return
    }

    const token = generateToken(user.id)
    res.json({ token, user: toSafeUser(user) })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// GET /api/auth/me — 获取当前登录用户（需鉴权）
export const getMe = async (req: Request, res: Response) => {
  try {
    const authReq = req as any
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [authReq.userId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: '用户不存在' })
      return
    }

    res.json({ user: toSafeUser(result.rows[0] as UserRow) })
  } catch (err) {
    console.error('GetMe error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
