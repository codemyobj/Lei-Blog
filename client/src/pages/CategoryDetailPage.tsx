import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCategory } from '../hooks/useCategories'
import { usePosts } from '../hooks/usePosts'
import { Spinner } from '../components/Spinner'
import PostCard from '../components/PostCard'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'

export default function CategoryDetailPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  // 页码**直接**从 URL 派生，不额外用 useState 镜像一份。
  // 镜像状态需要 useEffect 同步（会命中 react-hooks/set-state-in-effect），
  // 且两份状态存在短暂不一致的窗口。URL 就是唯一真相源。
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))

  const { category, loading: categoryLoading, error: categoryError } = useCategory(slug)
  const { data, loading: postsLoading, error: postsError } = usePosts(page, 9, undefined, slug)

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: String(newPage) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (categoryLoading) return <Spinner />

  if (categoryError || !category) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📁</div>
        <h1 className="text-2xl mb-2">
          {categoryError || t('category.notFound')}
        </h1>
        <Link to="/categories" className="btn btn-primary mt-4">
          {t('category.viewAll')}
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* 面包屑 */}
      <div className="mb-6 t-meta" style={{ color: 'var(--text-muted)' }}>
        <Link to="/categories" className="hover:underline">
          {t('nav.categories')}
        </Link>
        <span className="mx-2">/</span>
        <span style={{ color: 'var(--text)' }}>{category.name}</span>
      </div>

      {/* 页头：杂志 masthead —— 红色 kicker + 衬线标题 + 导语 */}
      <header className="mb-12">
        <p className="t-kicker mb-5">{t('nav.categories')}</p>
        <h1 className="text-3xl mb-3">
          {category.name}
        </h1>
        {category.description && (
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            {category.description}
          </p>
        )}
        <p className="t-lead max-w-[56ch]">
          {t('category.postCount', { count: category.post_count ?? 0 })}
        </p>
      </header>

      {postsLoading && <Spinner />}

      {postsError && (
        <div className="card p-6 text-center" style={{ color: 'var(--danger)' }}>
          {postsError}
        </div>
      )}

      {!postsLoading && !postsError && data && (
        <>
          {data.posts.length === 0 ? (
            <EmptyState title={t('category.emptyPosts')} icon="📄" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
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
