import { Link } from 'react-router-dom'
import type { Tag } from '../types'

export default function TagBadge({ tag, size = 'sm' }: { tag: Tag; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'px-4 py-1.5 text-sm' : 'px-3 py-1 text-xs'
  return (
    <Link
      to={`/tags/${tag.slug}`}
      className={`tag-badge ${sizeClass}`}
    >
      # {tag.name}
    </Link>
  )
}
