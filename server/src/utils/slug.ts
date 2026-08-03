// ============================================================
// 工具函数：slug 生成
// 将标题转为 URL 友好标识；中文保留并用连字符分隔
// ============================================================

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // 中文字符保留，其余非字母数字中文转为连字符
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

// 确保 slug 在数据库中唯一，若冲突则追加数字后缀
export async function ensureUniqueSlug(
  pool: any,
  baseSlug: string,
  excludeId?: number,
  table: 'posts' | 'tags' = 'posts'
): Promise<string> {
  let slug = baseSlug || 'untitled'
  let suffix = 0

  while (true) {
    const query = excludeId
      ? `SELECT id FROM ${table} WHERE slug = $1 AND id != $2`
      : `SELECT id FROM ${table} WHERE slug = $1`
    const params = excludeId ? [slug, excludeId] : [slug]
    const result = await pool.query(query, params)
    if (result.rows.length === 0) break
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }
  return slug
}
