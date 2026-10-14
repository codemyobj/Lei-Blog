/**
 * rehypeGallery —— 把 Markdown 里**连续的纯图片段落**转成杂志式图集网格。
 *
 * 为什么需要它：
 *   数据库里没有"图集"字段（cover_image 是单张外链 URL，VARCHAR(500)），
 *   且本次禁止改 schema。所以图集只能从**正文 Markdown**里长出来 ——
 *   约定：连续两行及以上的 `![alt](url)`（各自成段）会被收集成一个图集网格。
 *
 * 产出结构：
 *   - 连续 1 张        → `<figure class="md-figure">`（单图 + 可选 figcaption）
 *   - 连续 >= 2 张     → `<div class="md-gallery">`
 *                        内含若干 `<figure class="md-gallery-item">`，
 *                        数量 >= 3 时第一张加 `wide`（跨 2 列、2:1），其余 1:1；
 *                        最后再补一条 `<p class="md-gallery-cap">`（取最后一张的 alt）。
 *
 * 注意：只把"段落里除了图片就是空白"的段落视为图集成员 ——
 *       图文混排的段落（`看这张 ![x](y) 很美`）不受影响，仍按普通段落渲染。
 */

/** 最小化的 hast 节点形状（避免为 ~60 行插件引入 @types/hast 依赖） */
interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/** 判断是否"纯图片段落"；是则返回其中的 img 节点数组，否则返回 null */
function imageOnlyParagraph(node: HastNode): HastNode[] | null {
  if (node.type !== 'element' || node.tagName !== 'p') return null
  const kids = node.children ?? []
  if (kids.length === 0) return null

  const images: HastNode[] = []
  for (const child of kids) {
    // 段落里 Markdown 渲染常夹着纯空白的 text 节点，跳过
    if (child.type === 'text' && !(child.value ?? '').trim()) continue
    if (child.type === 'element' && child.tagName === 'img') {
      images.push(child)
      continue
    }
    return null // 混有文字/链接/其它元素 → 不是图集成员
  }
  return images.length > 0 ? images : null
}

function readAlt(image: HastNode): string {
  const alt = image.properties?.alt
  return typeof alt === 'string' ? alt.trim() : ''
}

/** 浅拷贝 img 并清掉 className，避免把段落级样式带进图集 */
function cloneImage(image: HastNode): HastNode {
  return { ...image, properties: { ...image.properties } }
}

function makeSingleFigure(image: HastNode): HastNode {
  const alt = readAlt(image)
  const children: HastNode[] = [cloneImage(image)]
  if (alt) {
    children.push({
      type: 'element',
      tagName: 'figcaption',
      properties: {},
      children: [{ type: 'text', value: alt }],
    })
  }
  return {
    type: 'element',
    tagName: 'figure',
    properties: { className: ['md-figure'] },
    children,
  }
}

function makeGallery(images: HastNode[]): HastNode[] {
  // 数量 >= 3 时第一张跨 2 列（横幅 2:1），其余 1:1 —— 与已批准预览的网格一致。
  // 2 张时不做横幅，两张方图并排更稳。
  const wideIndex = images.length >= 3 ? 0 : -1

  const figures: HastNode[] = images.map((image, index) => ({
    type: 'element',
    tagName: 'figure',
    properties: {
      className:
        index === wideIndex ? ['md-gallery-item', 'wide'] : ['md-gallery-item'],
    },
    children: [cloneImage(image)],
  }))

  const out: HastNode[] = [
    { type: 'element', tagName: 'div', properties: { className: ['md-gallery'] }, children: figures },
  ]

  // 图集说明：取最后一张的 alt（杂志图集通常是"整组一句话说明"）
  const caption = readAlt(images[images.length - 1])
  if (caption) {
    out.push({
      type: 'element',
      tagName: 'p',
      properties: { className: ['md-gallery-cap'] },
      children: [{ type: 'text', value: caption }],
    })
  }
  return out
}

/** 是否为"块间空白"文本节点（hast 里块级元素之间会夹 \n 文本节点） */
function isBlankText(node: HastNode): boolean {
  return node.type === 'text' && !(node.value ?? '').trim()
}

export default function rehypeGallery() {
  return (tree: unknown): void => {
    const root = tree as HastNode
    if (!Array.isArray(root.children)) return

    const source = root.children
    const result: HastNode[] = []

    let i = 0
    while (i < source.length) {
      // 块间空白的文本节点原样保留（不参与图集收集，也不打断收集逻辑）
      if (isBlankText(source[i])) {
        result.push(source[i])
        i += 1
        continue
      }

      const first = imageOnlyParagraph(source[i])
      if (!first) {
        result.push(source[i])
        i += 1
        continue
      }

      // 收集连续的"纯图片段落"。
      // ⚠️ remark-rehype 会在块级元素之间插入 `\n` 文本节点，必须跳过它们
      //    才能把相邻的 <p><img></p> 认成一组（否则每张图各成一组，永远退化成单图）。
      const run: HastNode[][] = [first]
      i += 1
      while (i < source.length) {
        if (isBlankText(source[i])) {
          i += 1
          continue
        }
        const next = imageOnlyParagraph(source[i])
        if (!next) break
        run.push(next)
        i += 1
      }

      const images = run.flat()
      if (images.length === 1) {
        result.push(makeSingleFigure(images[0]))
      } else {
        result.push(...makeGallery(images))
      }
    }

    root.children = result
  }
}
