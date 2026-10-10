import { Request, Response } from 'express'
import pool from '../config/db'

// GET /api/categories — 全部分类（含已发布文章数），按排序权重/名称升序归一
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description, c.sort_order,
              COUNT(CASE WHEN p.status = 'published' THEN p.id END)::int AS post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id
       GROUP BY c.id, c.name, c.slug, c.description, c.sort_order
       ORDER BY c.sort_order DESC, c.name`
    )
    res.json({ categories: result.rows })
  } catch (err) {
    console.error('Get categories error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// GET /api/categories/:slug — 单个分类详情
export const getCategoryBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const result = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description, c.sort_order,
              COUNT(CASE WHEN p.status = 'published' THEN p.id END)::int AS post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id
       WHERE c.slug = $1
       GROUP BY c.id, c.name, c.slug, c.description, c.sort_order`,
      [slug]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: '分类不存在' })
      return
    }

    res.json({ category: result.rows[0] })
  } catch (err) {
    console.error('Get category error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
