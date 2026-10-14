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
      /* card-media：有边框的杂志卡，封面图是主角（预览 .card + .im）。
         悬停轻微上浮由 .card-media:hover 提供。 */
      className="card-media group"
    >
      {/*
        封面图区：3:2（预览卡片封面比例）。
        ⚠️ cover_image 为 NULL 时**整块不渲染**（不能留一个空的高框），
           由调用处的 grid items-start 保证卡片各自按内容取高，不塌陷也不留白。
        外链图加载失败时 onError 把 img 藏起来，--wash 底色 + 内描边兜底，
        不会出现浏览器的破图图标。
      */}
      {post.cover_image && (
        <div className="hairline-frame aspect-[3/2]">
          <img
            src={post.cover_image}
            alt={post.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.visibility = 'hidden'
            }}
            className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-90"
          />
        </div>
      )}

      <div className="p-4 pb-5">
        {/* 标题（衬线，19px；字重由非分层 CSS 决定 = 600，不写 font-* utility） */}
        <h2 className="text-xl mb-2 group-hover:text-[color:var(--brand)] transition-colors">
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

        {/* 元信息：等宽（杂志排版的 meta 语汇） */}
        <div className="t-meta flex flex-wrap items-center gap-4" style={{ color: 'var(--text-muted)' }}>
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
      </div>
    </Link>
  )
}
