import { Request, Response } from 'express'
import pool from '../config/db'
import type { CreateTagBody, UpdateTagBody } from '../types'
import { generateSlug, ensureUniqueSlug } from '../utils/slug'

// GET /api/admin/tags — 标签列表（含文章总数，含所有状态）
export const adminGetTags = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.slug, t.created_at,
              COUNT(pt.post_id)::int as post_count
       FROM tags t
       LEFT JOIN post_tags pt ON t.id = pt.tag_id
       GROUP BY t.id, t.name, t.slug, t.created_at
       ORDER BY t.created_at DESC`
    )
    res.json({ tags: result.rows })
  } catch (err) {
    console.error('Admin get tags error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// POST /api/admin/tags — 新建标签
export const createTag = async (req: Request, res: Response) => {
  try {
    const { name, slug }: CreateTagBody = req.body

    if (!name) {
      res.status(400).json({ error: '标签名为必填项' })
      return
    }

    // 检查名称是否已存在
    const nameCheck = await pool.query('SELECT id FROM tags WHERE name = $1', [name])
    if (nameCheck.rows.length > 0) {
      res.status(409).json({ error: '标签名已存在' })
      return
    }

    const baseSlug = slug || generateSlug(name)
    const finalSlug = await ensureUniqueSlug(pool, baseSlug, undefined, 'tags')

    const result = await pool.query(
      'INSERT INTO tags (name, slug) VALUES ($1, $2) RETURNING *',
      [name, finalSlug]
    )
    res.status(201).json({ tag: result.rows[0] })
  } catch (err) {
    console.error('Create tag error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// PUT /api/admin/tags/:id — 更新标签
export const updateTag = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的标签 ID' })
      return
    }

    const { name, slug }: UpdateTagBody = req.body

    const existing = await pool.query('SELECT * FROM tags WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      res.status(404).json({ error: '标签不存在' })
      return
    }

    const oldTag = existing.rows[0]
    const finalName = name ?? oldTag.name

    // 名称唯一性检查
    if (name && name !== oldTag.name) {
      const nameCheck = await pool.query('SELECT id FROM tags WHERE name = $1 AND id != $2', [name, id])
      if (nameCheck.rows.length > 0) {
        res.status(409).json({ error: '标签名已存在' })
        return
      }
    }

    let finalSlug = oldTag.slug
    if (slug !== undefined && slug !== oldTag.slug) {
      finalSlug = await ensureUniqueSlug(pool, slug || generateSlug(finalName), id, 'tags')
    }

    const result = await pool.query(
      'UPDATE tags SET name = $1, slug = $2 WHERE id = $3 RETURNING *',
      [finalName, finalSlug, id]
    )
    res.json({ tag: result.rows[0] })
  } catch (err) {
    console.error('Update tag error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// DELETE /api/admin/tags/:id — 删除标签（post_tags 因 ON DELETE CASCADE 自动清理）
export const deleteTag = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的标签 ID' })
      return
    }

    const result = await pool.query('DELETE FROM tags WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: '标签不存在' })
      return
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Delete tag error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
