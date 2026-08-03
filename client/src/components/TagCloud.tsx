import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Tag } from '../types'

export default function TagCloud({ tags }: { tags: Tag[] }) {
  const { t } = useTranslation()
  if (tags.length === 0) {
    return (
      <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        {t('tags.empty')}
      </p>
    )
  }

  // 按文章数映射字号
  const counts = tags.map((t) => t.post_count || 0)
  const max = Math.max(...counts, 1)
  const min = Math.min(...counts, 0)

  const getFontSize = (count: number): string => {
    if (max === min) return '1rem'
    const ratio = (count - min) / (max - min)
    return `${0.875 + ratio * 0.875}rem`
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center py-8">
      {tags.map((tag) => (
        <Link
          key={tag.id}
          to={`/tags/${tag.slug}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold transition-all hover:scale-105"
          style={{
            fontSize: getFontSize(tag.post_count || 0),
            background: 'var(--brand-light)',
            color: 'var(--brand)',
            border: '1px solid var(--border)',
          }}
        >
          #{tag.name}
          <span className="text-xs opacity-70">({tag.post_count || 0})</span>
        </Link>
      ))}
    </div>
  )
}
