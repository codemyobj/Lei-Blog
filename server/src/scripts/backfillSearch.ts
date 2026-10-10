// ============================================================
// 存量文章回填 search_document
//
// 用途：把历史文章（在 search_document 列上线之前写入的）补齐搜索文档，
//       否则这些文章永远搜不到。
//
// 用法：
//   cd server && npm run db:search-backfill
//
// 幂等：可重复执行；默认只处理 search_document 为空的行，
//       加 --force 则全部重建（例如 stripMarkdown 逻辑升级后）。
// 性能：逐篇更新（文章量级别 < 10k，耗时可接受），每批打印进度。
// ============================================================

import pool from '../config/db'
import { buildSearchDocument } from '../utils/stripMarkdown'

const FORCE = process.argv.includes('--force')

async function backfillSearchDocument(): Promise<void> {
  console.log(`[backfill] mode=${FORCE ? 'force(全部重建)' : '只看空值'} cwd=${process.cwd()}`)

  // 统计待处理总数
  const totalResult = await pool.query(
    FORCE
      ? `SELECT COUNT(*)::int AS count FROM posts`
      : `SELECT COUNT(*)::int AS count FROM posts WHERE search_document IS NULL OR search_document = ''`
  )
  const total: number = totalResult.rows[0].count
  console.log(`[backfill] 待处理文章：${total} 篇`)

  if (total === 0) {
    console.log('[backfill] ✅ 无需回填')
    return
  }

  // 一次性取 ID 列表，避免边更新边翻页导致偏移漂移
  const pendingResult = await pool.query<{ id: number; title: string; excerpt: string | null; content: string | null }>(
    FORCE
      ? `SELECT id, title, excerpt, content FROM posts ORDER BY id`
      : `SELECT id, title, excerpt, content FROM posts WHERE search_document IS NULL OR search_document = '' ORDER BY id`
  )

  let success = 0
  let failed = 0

  for (const [index, row] of pendingResult.rows.entries()) {
    try {
      const document = buildSearchDocument(row.title, row.excerpt, row.content)
      await pool.query('UPDATE posts SET search_document = $1 WHERE id = $2', [document, row.id])
      success += 1
    } catch (err) {
      failed += 1
      console.error(`[backfill] ❌ id=${row.id} 失败：`, err)
    }

    if ((index + 1) % 50 === 0 || index + 1 === pendingResult.rows.length) {
      console.log(`[backfill] 进度 ${index + 1}/${pendingResult.rows.length}`)
    }
  }

  // 回填后非空率自检
  const verifyResult = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(CASE WHEN search_document IS NOT NULL AND search_document <> '' THEN 1 END)::int AS filled
     FROM posts`
  )
  const { total: allPosts, filled } = verifyResult.rows[0]
  const rate = allPosts === 0 ? 100 : (filled / allPosts) * 100

  console.log(`[backfill] 成功 ${success} 篇，失败 ${failed} 篇`)
  console.log(`[backfill] search_document 非空率：${filled}/${allPosts} = ${rate.toFixed(1)}%`)

  if (failed > 0) {
    process.exitCode = 1
  }
}

backfillSearchDocument()
  .catch((err) => {
    console.error('[backfill] ❌ 回填失败：', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
