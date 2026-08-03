import { Request, Response } from 'express'
import pool from '../config/db'
import type { TagRow } from '../types'

// 获取多篇文章的标签（批量查询，避免 N+1）
async function getTagsForPosts(postIds: number[]): Promise<Record<number, TagRow[]>> {
  if (postIds.length === 0) return {}
  const result = await pool.query(
    `SELECT t.*, pt.post_id
     FROM tags t
     JOIN post_tags pt ON t.id = pt.tag_id
     WHERE pt.post_id = ANY($1::int[])
     ORDER BY t.name`,
    [postIds]
  )
  const map: Record<number, TagRow[]> = {}
  for (const row of result.rows) {
    const pid = row.post_id
    const { post_id, ...tag } = row
    if (!map[pid]) map[pid] = []
    map[pid].push(tag as TagRow)
  }
  return map
}

// GET /api/posts — 文章列表（分页，仅 published，可选 ?tag=slug 筛选）
export const getPosts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 10))
    const offset = (page - 1) * pageSize
    const tagSlug = req.query.tag as string | undefined

    let postsQuery: string
    let countQuery: string
    let params: (string | number)[]

    if (tagSlug) {
      // 按标签筛选
      postsQuery = `
        SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.view_count, p.published_at
        FROM posts p
        JOIN post_tags pt ON p.id = pt.post_id
        JOIN tags t ON pt.tag_id = t.id
        WHERE p.status = 'published' AND t.slug = $3
        ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
        LIMIT $1 OFFSET $2`
      countQuery = `
        SELECT COUNT(*)::int as count
        FROM posts p
        JOIN post_tags pt ON p.id = pt.post_id
        JOIN tags t ON pt.tag_id = t.id
        WHERE p.status = 'published' AND t.slug = $1`
      params = [pageSize, offset, tagSlug]
    } else {
      postsQuery = `
        SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.view_count, p.published_at
        FROM posts p
        WHERE p.status = 'published'
        ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
        LIMIT $1 OFFSET $2`
      countQuery = `
        SELECT COUNT(*)::int as count
        FROM posts p
        WHERE p.status = 'published'`
      params = [pageSize, offset]
    }

    const [postsResult, countResult] = await Promise.all([
      pool.query(postsQuery, params),
      pool.query(countQuery, tagSlug ? [tagSlug] : []),
    ])

    const total = countResult.rows[0].count
    const posts = postsResult.rows

    // 批量获取标签
    const postIds = posts.map((p: any) => p.id)
    const tagsMap = await getTagsForPosts(postIds)
    posts.forEach((p: any) => {
      p.tags = tagsMap[p.id] || []
    })

    res.json({
      posts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('Get posts error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// GET /api/posts/:slug — 文章详情（+1 阅读量，附带标签）
export const getPostBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const result = await pool.query(
      `SELECT * FROM posts WHERE slug = $1 AND status = 'published'`,
      [slug]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: '文章不存在' })
      return
    }

    const post = result.rows[0]

    // 阅读量 +1（不阻塞响应）
    pool.query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [post.id]).catch(() => {})

    // 获取标签
    const tagsResult = await pool.query(
      `SELECT t.* FROM tags t
       JOIN post_tags pt ON t.id = pt.tag_id
       WHERE pt.post_id = $1
       ORDER BY t.name`,
      [post.id]
    )
    post.tags = tagsResult.rows

    res.json({ post })
  } catch (err) {
    console.error('Get post error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
