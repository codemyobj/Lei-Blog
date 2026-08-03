import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTag } from '../hooks/useTags'
import { Spinner } from '../components/Spinner'
import PostCard from '../components/PostCard'
import EmptyState from '../components/EmptyState'

export default function TagDetailPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { tag, posts, loading, error } = useTag(slug)

  if (loading) return <Spinner />

  if (error || !tag) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🏷️</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {error || t('tags.notFound')}
        </h1>
        <Link to="/tags" className="btn btn-primary mt-4">{t('tags.viewAll')}</Link>
      </div>
    )
  }

  return (
    <div>
      {/* 面包屑 */}
      <div className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link to="/tags" className="hover:underline">{t('nav.tags')}</Link>
        <span className="mx-2">/</span>
        <span style={{ color: 'var(--text)' }}>#{tag.name}</span>
      </div>

      {/* 标签标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          #{tag.name}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('tags.postCount', { count: posts.length })}
        </p>
      </div>

      {/* 文章列表 */}
      {posts.length === 0 ? (
        <EmptyState title={t('tags.emptyPosts')} icon="📄" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
