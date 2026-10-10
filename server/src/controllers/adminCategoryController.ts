import { Request, Response } from 'express'
import pool from '../config/db'
import type { CreateCategoryBody, UpdateCategoryBody } from '../types'
import { generateSlug, ensureUniqueSlug } from '../utils/slug'

// GET /api/admin/categories — 分类列表（含已发布文章数，含所有分类）
export const adminGetCategories = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description, c.sort_order, c.created_at,
              COUNT(CASE WHEN p.status = 'published' THEN p.id END)::int AS post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id
       GROUP BY c.id, c.name, c.slug, c.description, c.sort_order, c.created_at
       ORDER BY c.sort_order DESC, c.name`
    )
    res.json({ categories: result.rows })
  } catch (err) {
    console.error('Admin get categories error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// POST /api/admin/categories — 新建分类
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, slug, description, sort_order }: CreateCategoryBody = req.body

    if (!name) {
      res.status(400).json({ error: '分类名为必填项' })
      return
    }

    const nameCheck = await pool.query('SELECT id FROM categories WHERE name = $1', [name])
    if (nameCheck.rows.length > 0) {
      res.status(409).json({ error: '分类名已存在' })
      return
    }

    const baseSlug = slug || generateSlug(name)
    const finalSlug = await ensureUniqueSlug(pool, baseSlug, undefined, 'categories')

    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, finalSlug, description ?? null, sort_order ?? 0]
    )
    res.status(201).json({ category: result.rows[0] })
  } catch (err) {
    console.error('Create category error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// PUT /api/admin/categories/:id — 更新分类
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的分类 ID' })
      return
    }

    const { name, slug, description, sort_order }: UpdateCategoryBody = req.body

    const existing = await pool.query('SELECT * FROM categories WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      res.status(404).json({ error: '分类不存在' })
      return
    }

    const old = existing.rows[0]
    const finalName = name ?? old.name

    if (name && name !== old.name) {
      const nameCheck = await pool.query(
        'SELECT id FROM categories WHERE name = $1 AND id != $2',
        [name, id]
      )
      if (nameCheck.rows.length > 0) {
        res.status(409).json({ error: '分类名已存在' })
        return
      }
    }

    let finalSlug = old.slug
    if (slug !== undefined && slug !== old.slug) {
      finalSlug = await ensureUniqueSlug(pool, slug || generateSlug(finalName), id, 'categories')
    }

    const finalDescription = description !== undefined ? description : old.description
    const finalSortOrder = sort_order !== undefined ? sort_order : old.sort_order

    const result = await pool.query(
      `UPDATE categories
       SET name = $1, slug = $2, description = $3, sort_order = $4
       WHERE id = $5
       RETURNING *`,
      [finalName, finalSlug, finalDescription, finalSortOrder, id]
    )
    res.json({ category: result.rows[0] })
  } catch (err) {
    console.error('Update category error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}

// DELETE /api/admin/categories/:id — 删除分类（文章侧 ON DELETE SET NULL，不删文章）
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的分类 ID' })
      return
    }

    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: '分类不存在' })
      return
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Delete category error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
