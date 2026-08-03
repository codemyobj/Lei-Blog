import { Request, Response } from 'express'
import pool from '../config/db'

// GET /api/about — 关于页内容
export const getAbout = async (_req: Request, res: Response) => {
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
    console.error('Get about error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
