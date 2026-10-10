// ============================================================
// 全文搜索控制器
//
// 技术选型：PostgreSQL pg_trgm（三元组）+ GIN 索引，服务端查询。
// 三元组滑窗不依赖词边界，因此中文**无需分词**即可命中。
//
// 查询策略（明确规则，不留例外）：
//   q 为空 / 码点长度 > 100  → 400，不下发查询
//   码点长度 >= 3           → trigram 全文匹配（见下方阈值说明）
//   码点长度 1~2            → 降级 ILIKE '%q%'（trigram 至少要 3 字符才能生成三元组，
//                              2 字查询相似度恒为 0，必须有降级路径）
//   q 含 ASCII 字母          → 额外叠加 to_tsvector('english') 词干匹配（hooks 命中 hook）
//
// ⚠️ 重要修正（基于 PostgreSQL 18.3 + pg_trgm 实测）：
//   方案文档建议的 `similarity(search_document, q) > 0.15` **在真实数据上不可用**。
//   `similarity()` 计算的是「两份文本全部三元组的交集/并集」，文档越长分母越大：
//     similarity('虚拟列表', '深入理解虚拟列表原理')   = 0.1429  ← 标题精确包含，仍低于 0.15
//     similarity('虚拟列表', <400+ 字的真实文章>)      = 0.0610
//   结论：**连标题精确命中都会被该阈值挡掉，中文搜索将永远返回 0 条。**
//
//   正确做法是使用 pg_trgm 专门为「短查询词匹配长文档」提供的 word_similarity()：
//   它取「文档中相似度最高的一段连续片段」来比对，不受文档长度稀释。同批实测：
//     word_similarity('虚拟列表', <标题含词的文档>)    = 1.0000
//     word_similarity('虚拟列表', <仅正文含词的文档>)  = 0.8000
//     word_similarity('虚拟列表', <完全无关的文档>)    = 0.0000
//     word_similarity('hooks',    <含 hook 的文档>)    = 0.6667
//   正负样本间隔极大（命中 ≥ 0.66，无关 ≤ 0.09），0.3 阈值留有充足安全边界。
//   注意 word_similarity 是**非对称**的：第一个参数必须是较短的查询词。
// ============================================================

import { Request, Response } from 'express'
import pool from '../config/db'
import type { SearchResultRow, SearchResponseBody, TagRow, CategoryRef } from '../types'

/** 查询词最大长度（码点），超过直接 400 */
const MAX_QUERY_LENGTH = 100
/** 触发 trigram 的最小查询长度（pg_trgm 三元组至少需要 3 个字符） */
const TRIGRAM_MIN_LENGTH = 3
/** 单页最大返回条数 */
const MAX_PAGE_SIZE = 50
/** 默认单页条数 */
const DEFAULT_PAGE_SIZE = 10

/** 搜索策略 */
type SearchStrategy = 'trigram' | 'ilike'

/**
 * 按 Unicode **码点**计算字符串长度。
 *
 * 不能用 `String.length`：那是 UTF-16 码元数量，emoji / 部分生僻汉字会算成 2，
 * 导致本该走 trigram 的中文查询被错误降级。
 */
function codePointLength(text: string): number {
  return Array.from(text).length
}

/**
 * ⚠️ 索引使用情况（已知且接受的权衡，不是 bug）：
 *
 * `word_similarity(...)` 作为**裸表达式谓词**用不上 GIN 索引，实际是 seq scan + 逐行计算。
 * 个人博客量级（数百篇）下 1~2ms，完全够用，因此当前实现刻意保持简单。
 *
 * 升级路径（文章量到万级时再切，别提前优化）：
 *   1. 谓词换成运算符形式：`$1 <% search_document`
 *   2. **同时**把 GUC `pg_trgm.word_similarity_threshold` 设为 0.3
 *      —— 该 GUC 默认是 0.6，只换运算符不设 GUC 会静默用错阈值，比不改成更糟。
 *   3. GUC 要生效需在 `pool.on('connect')` 里 `SET`（连接级），
 *      或用显式 BEGIN/COMMIT 包起来 —— `SET LOCAL` 只在事务内有效，
 *      而 `pool.query()` 单语句是隐式事务，作用域不对。
 */

/**
 * word_similarity 阈值。
 *
 * 命中样本实测 ≥ 0.66，无关样本 ≤ 0.09，因此 0.3 有充足安全边界。
 * 可用环境变量 SEARCH_MIN_SCORE 覆盖（0 < x < 1）。
 */
function resolveSimilarityThreshold(): number {
  const parsed = parseFloat(process.env.SEARCH_MIN_SCORE ?? '')
  if (!Number.isNaN(parsed) && parsed > 0 && parsed < 1) return parsed
  return 0.3
}

/**
 * 转义 LIKE 模式中的通配符 `%` `_` 与默认转义符 `\`。
 * 防止用户输入的 `%` 让 ILIKE 退化成全表匹配。
 */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`)
}

/** 判断查询词是否需要额外走英文词干匹配 */
function needsEnglishStemming(q: string): boolean {
  return /[A-Za-z]/.test(q)
}

/**
 * 动态分配 SQL 占位符的收集器。
 *
 * ⚠️ 必须动态分配：PostgreSQL 在 Parse 阶段要推断每个参数的类型。
 *    如果 SQL 里出现了 `$3` 却从未使用 `$1`，会直接报
 *    `could not determine data type of parameter $1`。
 *    ILIKE 分支恰好不使用 `$1`（只用 like 模式），因此不能写死占位符编号。
 */
class SqlParamBuilder {
  private values: unknown[] = []

  /** 追加一个值，返回它对应的占位符（如 `$1`） */
  push(value: unknown): string {
    this.values.push(value)
    return `$${this.values.length}`
  }

  /** 当前已分配的参数值副本 */
  snapshot(): unknown[] {
    return [...this.values]
  }
}

/** 构造 WHERE 条件；同时通过 builder 分配参数占位符 */
function buildConditions(
  builder: SqlParamBuilder,
  strategy: SearchStrategy,
  useTsVector: boolean,
  q: string,
  likePattern: string,
  threshold: number
): { conditions: string[]; queryRef: string } {
  const conditions: string[] = []
  let queryRef = ''

  if (strategy === 'trigram') {
    // 主路径：查询词与文档中某段连续片段的相似度超过阈值
    queryRef = builder.push(q)
    conditions.push(
      `word_similarity(${queryRef}, coalesce(p.search_document, '')) > ${threshold}`
    )
  } else {
    // 降级路径：子串匹配。除方案文档的 title/excerpt 外，额外包含正文纯文本，
    // 否则「虚拟」这类只出现在正文里的 2 字查询会搜不到任何结果。
    const likeRef = builder.push(likePattern)
    conditions.push(`p.title ILIKE ${likeRef}`)
    conditions.push(`coalesce(p.excerpt, '') ILIKE ${likeRef}`)
    conditions.push(`coalesce(p.search_document, '') ILIKE ${likeRef}`)
  }

  if (useTsVector) {
    // 英文词干匹配用 plainto_tsquery 而非 websearch_to_tsquery：
    // 后者遇到不配对的引号会抛语法错误，前者对用户输入的容错性最好。
    const stemRef = builder.push(q)
    conditions.push(
      `to_tsvector('english', coalesce(p.search_document, '')) @@ plainto_tsquery('english', ${stemRef})`
    )
  }

  return { conditions, queryRef }
}

/** 批量获取文章标签 */
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
    const { post_id, ...tag } = row
    if (!map[post_id]) map[post_id] = []
    map[post_id].push(tag as TagRow)
  }
  return map
}

// GET /api/search?q=关键词&page=1&pageSize=10 — 全文搜索
export const search = async (req: Request, res: Response) => {
  const startedAt = process.hrtime.bigint()

  try {
    const rawQuery = req.query.q
    const q = typeof rawQuery === 'string' ? rawQuery.trim() : ''

    // --- 参数校验 ---
    const queryLength = codePointLength(q)
    if (queryLength === 0) {
      res.status(400).json({ error: '搜索关键词不能为空' })
      return
    }
    if (queryLength > MAX_QUERY_LENGTH) {
      res.status(400).json({ error: `搜索关键词过长（最多 ${MAX_QUERY_LENGTH} 个字符）` })
      return
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(req.query.pageSize as string) || DEFAULT_PAGE_SIZE)
    )
    const offset = (page - 1) * pageSize

    // --- 策略判定 ---
    const strategy: SearchStrategy = queryLength >= TRIGRAM_MIN_LENGTH ? 'trigram' : 'ilike'
    const useTsVector = needsEnglishStemming(q)
    const similarityThreshold = resolveSimilarityThreshold()
    const likePattern = `%${escapeLikePattern(q)}%`

    const builder = new SqlParamBuilder()
    const { conditions, queryRef } = buildConditions(
      builder, strategy, useTsVector, q, likePattern, similarityThreshold
    )
    const whereClause = conditions.join('\n    OR ')
    const countParams = builder.snapshot()

    // 列表查询在过滤参数之后追加 LIMIT / OFFSET
    const limitRef = builder.push(pageSize)
    const offsetRef = builder.push(offset)
    const postsParams = builder.snapshot()

    const scoreExpression =
      strategy === 'trigram'
        ? `(word_similarity(${queryRef}, p.title) * 3 + word_similarity(${queryRef}, coalesce(p.search_document, '')))`
        : `0::double precision`

    const orderByClause =
      strategy === 'trigram'
        ? `score DESC, p.published_at DESC NULLS LAST`
        : `p.published_at DESC NULLS LAST`

    const baseSelect = `
      p.id, p.title, p.slug, p.excerpt, p.published_at,
      p.category_id,
      c.id AS category_id_ref, c.name AS category_name, c.slug AS category_slug,
      ${scoreExpression} AS score`

    const postsQuery = `
      SELECT ${baseSelect}
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'published'
        AND (${whereClause})
      ORDER BY ${orderByClause}
      LIMIT ${limitRef} OFFSET ${offsetRef}`

    const countQuery = `
      SELECT COUNT(*)::int AS count
      FROM posts p
      WHERE p.status = 'published'
        AND (${whereClause})`

    const [postsResult, countResult] = await Promise.all([
      pool.query(postsQuery, postsParams),
      pool.query(countQuery, countParams),
    ])

    const total = countResult.rows[0].count as number
    const rows = postsResult.rows

    // --- 组装结果：批量回带标签与分类 ---
    const postIds: number[] = rows.map((r: any) => r.id)
    const tagsMap = await getTagsForPosts(postIds)

    const results: SearchResultRow[] = rows.map((row: any) => {
      const category: CategoryRef | null =
        row.category_id_ref === null || row.category_id_ref === undefined
          ? null
          : { id: row.category_id_ref, name: row.category_name, slug: row.category_slug }

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        published_at: row.published_at,
        score: Number(row.score),
        tags: tagsMap[row.id] || [],
        category,
      }
    })

    const tookMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

    const body: SearchResponseBody = {
      results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      took_ms: Math.round(tookMs * 100) / 100,
      strategy,
      used_english_tsvector: useTsVector,
    }

    res.json(body)
  } catch (err) {
    console.error('Search error:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
}
