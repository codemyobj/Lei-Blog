import type { ReactNode } from 'react'

interface HighlightProps {
  /** 纯文本（服务端返回的 title / excerpt，不含 HTML） */
  text: string
  /** 搜索关键词；为空时原样返回文本 */
  query: string
}

/**
 * 关键词高亮。
 *
 * 实现要点：
 * - **不使用 `dangerouslySetInnerHTML`**。把文本按命中区间切成若干纯字符串片段，
 *   交给 React 作为子节点渲染，React 自身会转义，因此天然免疫 XSS。
 *   若改用 innerHTML 拼接，`<img onerror=...>` 这类正文内容就能直接执行脚本。
 * - 大小写不敏感匹配（对英文有意义；中文无大小写，等价于直接包含匹配）。
 * - 命中片段用 `<mark>` 包裹，配色由 index.css 的该元素样式统一控制。
 */
export default function Highlight({ text, query }: HighlightProps) {
  const trimmed = query.trim()
  if (!trimmed) return <>{text}</>

  const haystack = text.toLowerCase()
  const needle = trimmed.toLowerCase()

  // 关键词比正文还长，不可能命中
  if (needle.length > haystack.length) return <>{text}</>

  const nodes: ReactNode[] = []
  let cursor = 0
  let index = haystack.indexOf(needle)

  // indexOf 的第二个参数无法表达「已消费到哪里」，因为它按字符偏移而非节点偏移，
  // 这里用 cursor 手动推进，保证同一段文本不会被重复切分。
  while (index !== -1) {
    if (index > cursor) {
      nodes.push(text.slice(cursor, index))
    }
    nodes.push(
      <mark key={`${index}-${cursor}`} className="search-hit">
        {text.slice(index, index + needle.length)}
      </mark>
    )
    cursor = index + needle.length
    index = haystack.indexOf(needle, cursor)
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return <>{nodes}</>
}
