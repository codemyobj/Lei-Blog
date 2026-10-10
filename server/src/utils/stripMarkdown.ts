// ============================================================
// 工具函数：Markdown → 纯文本
//
// 用途：生成 posts.search_document（全文搜索专用列）。
// 写入时由服务端一次性生成并入库，查询时不再转换，避免每次搜索重复消耗 CPU。
//
// 实现取舍：不引入 markdown-it / remark 依赖，用一组正则覆盖常见 Markdown 语法。
// 目标不是「完美还原」，而是「让搜索能命中正文」，所以需要：
//   - 保留链接文字与图片 alt（去掉 URL）
//   - 保留代码块内部文本（搜代码时能命中）
//   - 丢弃所有标记符号（`*`、`#`、`>`、`-`、`|` 等）
// ============================================================

/**
 * 将 Markdown 源码转换为纯文本。
 *
 * @param markdown - Markdown 原文（允许 null / undefined）
 * @returns 归一化空白后的纯文本；入参为空时返回空字符串
 *
 * @example
 * stripMarkdown('# 标题\n\n这是 **加粗** 的 [链接](https://a.b)')
 * // → '标题 这是 加粗 的 链接'
 */
export function stripMarkdown(markdown: string | null | undefined): string {
  if (!markdown) return ''

  let text = markdown

  // 1) 代码块：保留内部代码文本，只去掉围栏（``` 或 ~~~）与语言标注
  text = text.replace(/^[ \t]*(?:```|~~~)[^\n]*\n?([\s\S]*?)(?:^[ \t]*(?:```|~~~)[^\n]*$|$)/gm, '$1')
  text = text.replace(/^(?:```|~~~).*$/gm, '')

  // 2) 图片：![alt](url) → alt（保留 alt，丢弃 URL）
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')

  // 3) 链接：[text](url) → text（保留正文，丢弃 URL）
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')

  // 4) 参考式链接 / 脚注定义：[id]: url → 删除整行
  text = text.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '')

  // 5) 行内 HTML 标签：<br/>、<span>...</span> 等 → 删除标签本身，保留内容
  text = text.replace(/<\/?[^>]+>/g, '')

  // 6) 标题标记：# 标题 → 标题
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '')

  // 7) 引用标记：> 内容 → 内容
  text = text.replace(/^\s{0,3}>+\s?/gm, '')

  // 8) 列表标记：- / * / + / 1.  → 去掉符号
  text = text.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, '')

  // 9) 分隔线：*** / --- / ___ → 删除整行
  text = text.replace(/^\s{0,3}(?:\*\s*\*\s*\*[\s*]*|-\s*-\s*-[\s-]*|_\s*_\s*_[\s_]*)$/gm, '')

  // 10) 表格分隔行：| --- | --- | → 删除（单元格内容已在上一步保留）
  text = text.replace(/^\s*\|?[\s:-]+\|[\s:|-]*$/gm, '')

  // 11) 表格边框竖线 → 空格
  text = text.replace(/\|/g, ' ')

  // 12) 任务列表复选框：[ ] / [x] → 删除（对搜索无意义）
  text = text.replace(/\[[ xX]\]/g, '')

  // 13) 强调标记：先处理 ** / __，再处理 * / _，避免误删字母间的下划线
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/\*([^*\n]+)\*/g, '$1')
  text = text.replace(/(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, '$1')

  // 14) 删除线：~~text~~ → text
  text = text.replace(/~~([^~]+)~~/g, '$1')

  // 15) 行内代码：`code` → code
  text = text.replace(/`([^`]+)`/g, '$1')

  // 16) 转义字符：\* → *
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')

  // 17) 归一化空白：所有空白字符折叠为单个空格并去首尾
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

/**
 * 生成一篇文章的搜索文档：标题 + 摘要 + 正文纯文本，用换行分隔。
 *
 * 三者的权重差异通过 SQL 里的 `similarity(title, q) * 3` 体现，而非重复拼接，
 * 因此这里每部分只出现一次。
 *
 * @param title - 文章标题
 * @param excerpt - 文章摘要（可为空）
 * @param content - Markdown 正文
 * @returns 合并后的纯文本搜索文档
 */
export function buildSearchDocument(
  title: string,
  excerpt: string | null | undefined,
  content: string | null | undefined
): string {
  const parts: string[] = [title]
  const plainExcerpt = excerpt ? excerpt.trim() : ''
  if (plainExcerpt) parts.push(plainExcerpt)

  const plainContent = stripMarkdown(content)
  if (plainContent) parts.push(plainContent)

  return parts.join('\n')
}
