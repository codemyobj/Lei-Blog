import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePosts } from '../hooks/usePosts'
import PostCard from '../components/PostCard'
import Pagination from '../components/Pagination'
import { Spinner } from '../components/Spinner'
import EmptyState from '../components/EmptyState'

export default function HomePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  // 页码直接从 URL 派生，不再用 useState 镜像再在 effect 里同步——
  // 后者既是多余的一跳渲染，也会命中 react-hooks/set-state-in-effect。
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  const { data, loading, error } = usePosts(page, 9)

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: String(newPage) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      {/* 页头 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {t('home.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('home.subtitle')}
        </p>
      </div>

      {/* 加载中 */}
      {loading && <Spinner />}

      {/* 错误 */}
      {error && (
        <div className="card p-6 text-center" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* 文章列表 */}
      {!loading && !error && data && (
        <>
          {data.posts.length === 0 ? (
            <EmptyState title={t('home.emptyTitle')} description={t('home.emptyDesc')} icon="📝" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={handlePageChange}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
