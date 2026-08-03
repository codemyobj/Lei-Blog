import { Request, Response } from 'express'
import pool from '../config/db'
import type { UpdateAboutBody } from '../types'

// GET /api/admin/about — 获取关于页内容
export const adminGetAbout = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, content, updated_at FROM about WHERE id = 1'
    )
    if (result.rows.length === 0) {
      res.json({ about: { id: 1, content: '', updated_at: null } })
      return
    }
    res.json({ about: result.rows[0] })
  } catch (err) {
    console.error('Admin get about error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// PUT /api/admin/about — 更新关于页内容
export const updateAbout = async (req: Request, res: Response) => {
  try {
    const { content }: UpdateAboutBody = req.body

    if (content === undefined) {
      res.status(400).json({ error: '内容为必填项' })
      return
    }

    const result = await pool.query(
      `INSERT INTO about (id, content, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE
       SET content = $1, updated_at = NOW()
       RETURNING *`,
      [content]
    )
    res.json({ about: result.rows[0] })
  } catch (err) {
    console.error('Update about error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
