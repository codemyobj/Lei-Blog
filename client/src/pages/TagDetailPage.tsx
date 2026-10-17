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
        <h1 className="text-2xl mb-2">
          {error || t('tags.notFound')}
        </h1>
        <Link to="/tags" className="btn btn-primary mt-4">{t('tags.viewAll')}</Link>
      </div>
    )
  }

  return (
    <div>
      {/* 面包屑 */}
      <div className="mb-6 t-meta" style={{ color: 'var(--text-muted)' }}>
        <Link to="/tags" className="hover:underline">{t('nav.tags')}</Link>
        <span className="mx-2">/</span>
        <span style={{ color: 'var(--text)' }}>#{tag.name}</span>
      </div>

      {/* 页头：手账 masthead —— 手写小标注 + 黑体标题 + 导语 */}
      <header className="mb-12">
        <p className="t-kicker mb-5">{t('nav.tags')}</p>
        <h1 className="text-3xl mb-3">
          #{tag.name}
        </h1>
        <p className="t-lead max-w-[56ch]">
          {t('tags.postCount', { count: posts.length })}
        </p>
      </header>

      {/* 文章列表 */}
      {posts.length === 0 ? (
        <EmptyState title={t('tags.emptyPosts')} icon="📄" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
