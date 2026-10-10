import GithubSlugger from 'github-slugger'

/**
 * 目录（TOC）条目。
 *
 * `id` 必须与 rehype-slug 生成到 <h2>/<h3> 上的 id **完全一致**，
 * 否则点击目录无法跳转。二者共用 github-slugger（rehype-slug 的内部实现），
 * 因此直接 import 同一个库是保证一致性的唯一可靠做法。
 */
export interface TocItem {
  /** 标题锚点 id（中文标题会保留中文，与 GitHub 行为一致） */
  id: string
  /** 去掉行内 Markdown 标记后的纯文本标题 */
  text: string
  /** 标题层级：只取 h2 / h3 */
  level: 2 | 3
}

/** 参与目录的最小层级（h1 是文章标题，不进目录） */
const MIN_LEVEL = 2
/** 参与目录的最大层级 */
const MAX_LEVEL = 3

/** ATX 标题行：## 文本 / ### 文本（允许闭合 #） */
const ATX_HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/

/**
 * 去掉标题里的行内 Markdown 语法。
 *
 * rehype-slug 拿到的是**渲染后**的纯文本（`` `code` `` 只剩 code、
 * `[文字](链接)` 只剩 文字），所以抽取目录时必须做同样的还原，
 * 否则 id 会比 DOM 里的真实 id 多出反引号、方括号等字符。
 */
function stripInlineMarkdown(raw: string): string {
  let text = raw

  // 行内代码：`code` → code。最先处理，避免内部字符被后续规则误删
  text = text.replace(/`([^`]+)`/g, '$1')
  // 图片：![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  // 行内链接：[text](url) → text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  // 引用式链接：[text][ref] / [text][] → text
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
  // 裸 HTML 标签：<b>x</b> → x
  text = text.replace(/<[^>]+>/g, '')
  // 反斜杠转义：\* → *
  text = text.replace(/\\(.)/g, '$1')
  // 强调标记 * _ ~
  text = text.replace(/[*_~]/g, '')

  return text.trim()
}

/**
 * 从 Markdown **源文本**抽取 h2 / h3 目录。
 *
 * 在客户端执行，不改动后端数据模型。
 *
 * 会跳过以下误报来源：
 * - 围栏代码块（``` 或 ~~~）：里面的 `# 注释`（bash / Python）不是标题
 * - 缩进代码块（4 空格缩进）
 *
 * @param markdown Markdown 源文本
 * @returns 按文档顺序排列的目录条目；无标题时返回空数组
 */
export function extractToc(markdown: string): TocItem[] {
  if (!markdown) return []

  const slugger = new GithubSlugger()
  const items: TocItem[] = []

  /** 围栏代码块的结束标记；null 表示当前不在代码块内 */
  let fenceMarker: string | null = null

  for (const line of markdown.split(/\r?\n/)) {
    // --- 围栏代码块状态机 ---
    const fenceMatch = line.match(/^[ \t]*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fenceMarker === null) {
        // 进入代码块，记录围栏字符以便匹配闭合
        fenceMarker = marker[0]
        continue
      }
      if (marker[0] === fenceMarker) {
        // 闭合（同字符且长度不小于起始）
        fenceMarker = null
      }
      // 代码块内部的任何内容都不解析
      continue
    }
    if (fenceMarker !== null) continue

    // --- 缩进代码块 ---
    if (/^[ ]{4,}/.test(line)) continue

    // --- ATX 标题 ---
    const match = line.match(ATX_HEADING_RE)
    if (!match) continue

    const level = match[1].length
    const text = stripInlineMarkdown(match[2])
    if (!text) continue

    // ⚠️ 必须对所有层级（h1-h6）都调用 slug()：
    // rehype-slug 的 slugger 是按整篇文档顺序计重的，
    // 若这里只对 h2/h3 计重，重复标题的后缀（-1、-2）就会与真实 DOM id 错位。
    const id = slugger.slug(text)

    if (level < MIN_LEVEL || level > MAX_LEVEL) continue

    items.push({ id, text, level: level as 2 | 3 })
  }

  return items
}
