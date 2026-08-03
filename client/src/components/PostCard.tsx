import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Post } from '../types'
import { timeAgo } from '../utils/formatDate'
import { estimateReadingTime } from '../utils/readingTime'
import TagBadge from './TagBadge'

export default function PostCard({ post }: { post: Post }) {
  const { t } = useTranslation()
  const readingTime = estimateReadingTime(post.content || post.excerpt || '')

  return (
    <Link
      to={`/posts/${post.slug}`}
      className="card card-hover block p-6 group"
    >
      {/* 封面图 */}
      {post.cover_image && (
        <div className="mb-4 -mx-6 -mt-6 overflow-hidden rounded-t-2xl">
          <img
            src={post.cover_image}
            alt={post.title}
            className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}

      {/* 标题 */}
      <h2 className="text-xl font-bold mb-2 group-hover:opacity-80 transition-opacity" style={{ color: 'var(--text)' }}>
        {post.title}
      </h2>

      {/* 摘要 */}
      {post.excerpt && (
        <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
          {post.excerpt}
        </p>
      )}

      {/* 标签 */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </div>
      )}

      {/* 元信息 */}
      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        {post.published_at && (
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <time dateTime={post.published_at}>{timeAgo(post.published_at)}</time>
          </span>
        )}
        <span className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {t('post.minutesRead', { count: readingTime })}
        </span>
        <span className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {post.view_count}
        </span>
      </div>
    </Link>
  )
}
