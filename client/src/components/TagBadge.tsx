import { Link } from 'react-router-dom'
import type { Tag } from '../types'
import { pastelClass } from '../utils/pastel'

/**
 * 贴纸标签：pill + 粉彩底/字。
 *
 * 粉彩按 tag.id 取模轮换（utils/pastel.ts）—— 同一个标签在任何页面
 * 颜色都稳定，不随列表顺序跳变。六组的文字对比度均已实测 ≥4.5:1
 * （见 scripts/verify-contrast.mjs），但**粉彩叠在半透明/图片背景上会掉对比度**，
 * 所以贴纸一律放在 --surface / --bg 这类实底上，不叠在图上。
 */
export default function TagBadge({ tag, size = 'sm' }: { tag: Tag; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'px-4 py-1.5 text-sm' : 'px-3 py-1 text-xs'
  return (
    <Link
      to={`/tags/${tag.slug}`}
      className={`tag-badge ${pastelClass(tag.id)} ${sizeClass}`}
    >
      # {tag.name}
    </Link>
  )
}
