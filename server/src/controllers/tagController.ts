import { Request, Response } from 'express'
import pool from '../config/db'

// GET /api/tags — 所有标签（含每标签已发布文章数）
export const getTags = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.slug, t.created_at,
              COUNT(pt.post_id)::int as post_count
       FROM tags t
       LEFT JOIN post_tags pt ON t.id = pt.tag_id
       LEFT JOIN posts p ON pt.post_id = p.id AND p.status = 'published'
       GROUP BY t.id, t.name, t.slug, t.created_at
       ORDER BY post_count DESC, t.name ASC`
    )
    res.json({ tags: result.rows })
  } catch (err) {
    console.error('Get tags error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// GET /api/tags/:slug — 标签详情（含该标签下已发布文章列表）
export const getTagBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const tagResult = await pool.query(
      'SELECT * FROM tags WHERE slug = $1',
      [slug]
    )

    if (tagResult.rows.length === 0) {
      res.status(404).json({ error: '标签不存在' })
      return
    }

    const tag = tagResult.rows[0]

    const postsResult = await pool.query(
      `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.view_count, p.published_at
       FROM posts p
       JOIN post_tags pt ON p.id = pt.post_id
       WHERE pt.tag_id = $1 AND p.status = 'published'
       ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC`,
      [tag.id]
    )

    res.json({ tag, posts: postsResult.rows })
  } catch (err) {
    console.error('Get tag error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
