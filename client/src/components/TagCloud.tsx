import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Tag } from '../types'
import { pastelClass } from '../utils/pastel'

export default function TagCloud({ tags }: { tags: Tag[] }) {
  const { t } = useTranslation()
  if (tags.length === 0) {
    return (
      <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        {t('tags.empty')}
      </p>
    )
  }

  // 按文章数映射字号（"云"的语义：写得越多字越大）
  const counts = tags.map((t) => t.post_count || 0)
  const max = Math.max(...counts, 1)
  const min = Math.min(...counts, 0)

  const getFontSize = (count: number): string => {
    if (max === min) return '1rem'
    const ratio = (count - min) / (max - min)
    return `${0.875 + ratio * 0.875}rem`
  }

  return (
    <div className="flex flex-wrap gap-3 py-8">
      {tags.map((tag) => (
        <Link
          key={tag.id}
          to={`/tags/${tag.slug}`}
          /* 贴纸 pill + 粉彩：颜色按 tag.id 取模轮换，同一标签颜色稳定。
             保留按文章数的字号差异（tag cloud 的既有语义），只换外观。 */
          className={`tag-badge ${pastelClass(tag.id)}`}
          style={{ fontSize: getFontSize(tag.post_count || 0) }}
        >
          #{tag.name}
          <span className="ml-1.5 opacity-70">({tag.post_count || 0})</span>
        </Link>
      ))}
    </div>
  )
}
