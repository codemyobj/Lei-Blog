import { Request, Response } from 'express'
import pool from '../config/db'
import type { AuthRequest } from '../middleware/auth'
import type { CreatePostBody, UpdatePostBody } from '../types'
import { generateSlug, ensureUniqueSlug } from '../utils/slug'

// 获取单篇文章的标签 ID 列表
async function getTagIdsForPost(postId: number): Promise<number[]> {
  const result = await pool.query(
    'SELECT tag_id FROM post_tags WHERE post_id = $1',
    [postId]
  )
  return result.rows.map((r: any) => r.tag_id)
}

// 在事务中同步文章的标签关联（先删后插）
async function syncPostTags(postId: number, tagIds: number[], client: any) {
  await client.query('DELETE FROM post_tags WHERE post_id = $1', [postId])
  if (tagIds.length > 0) {
    // 批量插入
    const values = tagIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await client.query(
      `INSERT INTO post_tags (post_id, tag_id) VALUES ${values}`,
      [postId, ...tagIds]
    )
  }
}

// GET /api/admin/posts — 后台文章列表（含草稿，分页，支持状态筛选）
export const adminGetPosts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const offset = (page - 1) * pageSize
    const status = req.query.status as string | undefined

    let statusCondition = ''
    let statusParam: (string)[] = []
    if (status && ['draft', 'published'].includes(status)) {
      statusCondition = 'WHERE p.status = $3'
      statusParam = [status]
    }

    const postsParams = statusParam.length > 0 ? [pageSize, offset, status] : [pageSize, offset]

    const postsQuery = `
      SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.status, p.view_count,
             p.published_at, p.created_at, p.updated_at
      FROM posts p
      ${statusCondition}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2`

    // count 查询独立使用 $1 占位符（无 LIMIT/OFFSET）
    const countQuery = statusParam.length > 0
      ? `SELECT COUNT(*)::int as count FROM posts p WHERE p.status = $1`
      : `SELECT COUNT(*)::int as count FROM posts p`

    const [postsResult, countResult] = await Promise.all([
      pool.query(postsQuery, postsParams),
      pool.query(countQuery, statusParam),
    ])

    const total = countResult.rows[0].count
    const posts = postsResult.rows

    // 批量获取标签
    const postIds = posts.map((p: any) => p.id)
    if (postIds.length > 0) {
      const tagsResult = await pool.query(
        `SELECT t.*, pt.post_id FROM tags t
         JOIN post_tags pt ON t.id = pt.tag_id
         WHERE pt.post_id = ANY($1::int[])
         ORDER BY t.name`,
        [postIds]
      )
      const tagsMap: Record<number, any[]> = {}
      for (const row of tagsResult.rows) {
        const pid = row.post_id
        const { post_id, ...tag } = row
        if (!tagsMap[pid]) tagsMap[pid] = []
        tagsMap[pid].push(tag)
      }
      posts.forEach((p: any) => {
        p.tags = tagsMap[p.id] || []
      })
    }

    res.json({
      posts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('Admin get posts error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// GET /api/admin/posts/:id — 获取单篇文章（含 content 和 tag_ids）
export const adminGetPost = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的文章 ID' })
      return
    }

    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: '文章不存在' })
      return
    }

    const post = result.rows[0]
    post.tag_ids = await getTagIdsForPost(id)

    res.json({ post })
  } catch (err) {
    console.error('Admin get post error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// POST /api/admin/posts — 新建文章
export const createPost = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest
    const { title, slug, excerpt, content, cover_image, status, published_at, tag_ids }: CreatePostBody = req.body

    if (!title || !content) {
      res.status(400).json({ error: '标题和内容为必填项' })
      return
    }

    const baseSlug = slug || generateSlug(title)
    const finalSlug = await ensureUniqueSlug(pool, baseSlug, undefined, 'posts')

    const finalStatus = status || 'draft'
    const finalPublishedAt = finalStatus === 'published' ? (published_at || new Date().toISOString()) : (published_at || null)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO posts (title, slug, excerpt, content, cover_image, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [title, finalSlug, excerpt || null, content, cover_image || null, finalStatus, finalPublishedAt]
      )
      const post = result.rows[0]

      if (tag_ids && tag_ids.length > 0) {
        await syncPostTags(post.id, tag_ids, client)
      }

      await client.query('COMMIT')
      post.tag_ids = tag_ids || []
      res.status(201).json({ post })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Create post error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// PUT /api/admin/posts/:id — 更新文章
export const updatePost = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的文章 ID' })
      return
    }

    const { title, slug, excerpt, content, cover_image, status, published_at, tag_ids }: UpdatePostBody = req.body

    // 检查文章是否存在
    const existing = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      res.status(404).json({ error: '文章不存在' })
      return
    }

    const oldPost = existing.rows[0]
    const finalTitle = title ?? oldPost.title
    const finalContent = content ?? oldPost.content
    const finalExcerpt = excerpt !== undefined ? excerpt : oldPost.excerpt
    const finalCover = cover_image !== undefined ? cover_image : oldPost.cover_image
    const finalStatus = status ?? oldPost.status

    // slug 处理：若提供新 slug 则确保唯一（排除自身）
    let finalSlug = oldPost.slug
    if (slug !== undefined && slug !== oldPost.slug) {
      finalSlug = await ensureUniqueSlug(pool, slug || generateSlug(finalTitle), id, 'posts')
    }

    // 发布时间处理：若状态从 draft 变为 published 且无 published_at，设为当前时间
    let finalPublishedAt = oldPost.published_at
    if (finalStatus === 'published' && !finalPublishedAt) {
      finalPublishedAt = published_at ? new Date(published_at) : new Date()
    } else if (finalStatus === 'draft') {
      finalPublishedAt = published_at ? new Date(published_at) : finalPublishedAt
    } else if (published_at !== undefined) {
      finalPublishedAt = new Date(published_at)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE posts
         SET title = $1, slug = $2, excerpt = $3, content = $4, cover_image = $5,
             status = $6, published_at = $7, updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [finalTitle, finalSlug, finalExcerpt, finalContent, finalCover, finalStatus, finalPublishedAt, id]
      )
      const post = result.rows[0]

      if (tag_ids !== undefined) {
        await syncPostTags(id, tag_ids, client)
      }

      await client.query('COMMIT')
      post.tag_ids = tag_ids !== undefined ? tag_ids : await getTagIdsForPost(id)
      res.json({ post })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Update post error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// DELETE /api/admin/posts/:id — 删除文章（post_tags 因 ON DELETE CASCADE 自动删除）
export const deletePost = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的文章 ID' })
      return
    }

    const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: '文章不存在' })
      return
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Delete post error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
