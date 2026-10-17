/**
 * remarkHighlight —— 把正文里的 `==文字==` 变成荧光笔高亮。
 *
 * 为什么不是 `<mark>文字</mark>`（原方案）：
 *   **react-markdown v10 默认不渲染原始 HTML**，而 remark-rehype 会把行内 HTML
 *   标签**直接剥掉**（连 raw 节点都不留，只留下里面的纯文本）。
 *   实测：写 `<mark>空白</mark>` 渲染出来就是"空白"两个字，页面上 0 个 <mark>。
 *   要让 `<mark>` 生效必须引 `rehype-raw`，那等于允许正文写任意 HTML
 *   （含 `<script>`）—— 为一个高亮效果打开存储型 XSS 面，不值得。
 *   所以改用 `==文字==` 这个**纯 Markdown 语法**，在 mdast 层转换，
 *   零新依赖、零安全变化。
 *
 * 产出结构：
 *   mdast `strong` 节点 + `data.hName = 'mark'`（remark-rehype 尊重 hName，
 *   会输出成真正的 `<mark>`，语义正确）+ `data.hProperties.className = ['hl']`。
 *   样式见 index.css 的 `.markdown-body mark` / `.markdown-body .hl`。
 *
 * 约定（写进 docs/DESIGN-SYSTEM-JOURNAL.md §5）：
 *   - 正文里用 `==要强调的文字==` 得到荧光笔扫过效果。
 *   - 高亮内部**不再解析行内 Markdown**，所以 `==含 **粗体** 的文字==` 里的
 *     `**` 会原样显示；需要混排时把粗体放到高亮外面。
 *   - 内容里不能含单个 `=`（正则用 `[^=\n]+` 匹配，遇到 `=` 会提前收尾）。
 */

/** 最小化的 mdast 节点形状（避免为一个小插件引入 @types/mdast 依赖） */
interface MdastNode {
  type: string
  value?: string
  children?: MdastNode[]
  data?: Record<string, unknown>
}

/** `==文字==`：内容不含 `=` 与换行（避免吞掉后续内容） */
const HIGHLIGHT_RE = /==([^=\n]+)==/g

/** 把一个文本节点按 `==…==` 切成 [纯文本, 高亮节点, 纯文本, …]；无命中返回 null */
function splitHighlight(value: string): MdastNode[] | null {
  const out: MdastNode[] = []
  let cursor = 0
  let matched = false
  // 每次新建正则：带 g 标志的正则对象会记住 lastIndex，复用会漏匹配
  const re = new RegExp(HIGHLIGHT_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    matched = true
    if (m.index > cursor) {
      out.push({ type: 'text', value: value.slice(cursor, m.index) })
    }
    out.push({
      type: 'strong',
      data: { hName: 'mark', hProperties: { className: ['hl'] } },
      children: [{ type: 'text', value: m[1] }],
    })
    cursor = m.index + m[0].length
  }
  if (!matched) return null
  if (cursor < value.length) {
    out.push({ type: 'text', value: value.slice(cursor) })
  }
  return out
}

/** 递归遍历 mdast；只在 `text` 节点上切分，因此不会碰代码块 / 行内代码 */
function transform(node: MdastNode): void {
  if (!Array.isArray(node.children)) return
  const next: MdastNode[] = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('==')) {
      const parts = splitHighlight(child.value)
      if (parts) {
        next.push(...parts)
        continue
      }
    }
    transform(child)
    next.push(child)
  }
  node.children = next
}

export default function remarkHighlight() {
  return (tree: unknown): void => {
    transform(tree as MdastNode)
  }
}
