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

/**
 * 把扁平的分类列（category_id / category_name / category_slug）折叠成嵌套对象。
 *
 * 无分类时统一返回 null，保证 API 形状稳定。
 */
function attachCategories(rows: Record<string, any>[]): void {
  for (const row of rows) {
    const hasCategory = row.category_id !== null && row.category_id !== undefined
    row.category = hasCategory
      ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
      : null
    delete row.category_name
    delete row.category_slug
  }
}

// 列表查询统一选取的字段（左连接分类，附带扁平分类列）
const LIST_SELECT = `
  p.id, p.title, p.slug, p.excerpt, p.cover_image, p.view_count, p.published_at,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug`

// GET /api/posts — 文章列表（分页，仅 published，可选 ?tag=slug / ?category=slug 筛选）
export const getPosts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 10))
    const offset = (page - 1) * pageSize
    const tagSlug = req.query.tag as string | undefined
    const categorySlug = req.query.category as string | undefined

    let postsQuery: string
    let countQuery: string
    let postsParams: (string | number)[]
    let countParams: (string | number)[]

    if (tagSlug) {
      // 按标签筛选
      postsQuery = `
        SELECT ${LIST_SELECT}
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
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
      postsParams = [pageSize, offset, tagSlug]
      countParams = [tagSlug]
    } else if (categorySlug) {
      // 按分类筛选
      postsQuery = `
        SELECT ${LIST_SELECT}
        FROM posts p
        JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'published' AND c.slug = $3
        ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
        LIMIT $1 OFFSET $2`
      countQuery = `
        SELECT COUNT(*)::int as count
        FROM posts p
        JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'published' AND c.slug = $1`
      postsParams = [pageSize, offset, categorySlug]
      countParams = [categorySlug]
    } else {
      postsQuery = `
        SELECT ${LIST_SELECT}
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'published'
        ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
        LIMIT $1 OFFSET $2`
      countQuery = `
        SELECT COUNT(*)::int as count
        FROM posts p
        WHERE p.status = 'published'`
      postsParams = [pageSize, offset]
      countParams = []
    }

    const [postsResult, countResult] = await Promise.all([
      pool.query(postsQuery, postsParams),
      pool.query(countQuery, countParams),
    ])

    const total = countResult.rows[0].count
    const posts = postsResult.rows
    attachCategories(posts)

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

// GET /api/posts/archive — 归档（仅已发布文章，按发布时间倒序）
// ⚠️ 路由必须挂在 /:slug 之前，否则 'archive' 会被当作 slug 查询。
export const getArchive = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, title, slug, published_at
       FROM posts
       WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST, created_at DESC`
    )

    res.json({ posts: result.rows, total: result.rows.length })
  } catch (err) {
    console.error('Get archive error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// GET /api/posts/:slug — 文章详情（+1 阅读量，附带标签与分类）
export const getPostBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const result = await pool.query(
      `SELECT p.*, c.id AS category_id_ref, c.name AS category_name, c.slug AS category_slug
       FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1 AND p.status = 'published'`,
      [slug]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: '文章不存在' })
      return
    }

    const row = result.rows[0]
    const post: Record<string, any> = { ...row }
    post.category = row.category_id_ref
      ? { id: row.category_id_ref, name: row.category_name, slug: row.category_slug }
      : null
    delete post.category_id_ref
    delete post.category_name
    delete post.category_slug
    // search_document 属于服务端内部列，不下发给前端
    delete post.search_document

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
