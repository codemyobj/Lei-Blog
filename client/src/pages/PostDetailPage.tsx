import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePost } from '../hooks/usePosts'
import { Spinner } from '../components/Spinner'
import MarkdownRenderer from '../components/MarkdownRenderer'
import TagBadge from '../components/TagBadge'
import { formatDate } from '../utils/formatDate'
import { estimateReadingTime } from '../utils/readingTime'

export default function PostDetailPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { post, loading, error } = usePost(slug)

  if (loading) return <Spinner />

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {error || t('post.notFound')}
        </h1>
        <Link to="/" className="btn btn-primary mt-4">{t('post.backHome')}</Link>
      </div>
    )
  }

  const readingTime = estimateReadingTime(post.content || '')

  return (
    <article className="max-w-3xl mx-auto">
      {/* 返回链接 */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm mb-6 hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t('post.backHome')}
      </Link>

      {/* 文章头部 */}
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight" style={{ color: 'var(--text)' }}>
          {post.title}
        </h1>

        {/* 元信息 */}
        <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          {post.published_at && (
            <span className="flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {formatDate(post.published_at)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {t('post.minutesRead', { count: readingTime })}
          </span>
          <span className="flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {t('post.viewsCount', { count: post.view_count })}
          </span>
        </div>

        {/* 标签 */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </header>

      {/* 封面图 */}
      {post.cover_image && (
        <div className="mb-8 rounded-2xl overflow-hidden">
          <img src={post.cover_image} alt={post.title} className="w-full max-h-96 object-cover" />
        </div>
      )}

      {/* 文章内容 */}
      <MarkdownRenderer content={post.content || ''} />

      {/* 底部分隔 */}
      <hr className="my-8 border-0 border-t" style={{ borderColor: 'var(--border)' }} />

      <div className="flex items-center justify-between">
        <Link to="/" className="btn btn-outline">
          {t('post.backToList')}
        </Link>
      </div>
    </article>
  )
}
