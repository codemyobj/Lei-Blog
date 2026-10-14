import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCategories } from '../hooks/useCategories'
import { Spinner } from '../components/Spinner'
import EmptyState from '../components/EmptyState'

export default function CategoriesPage() {
  const { t } = useTranslation()
  const { data, loading, error } = useCategories()

  return (
    <div>
      {/* 页头：去掉居中，改左对齐栅格 + 通栏强调线 */}
      <div className="mb-12 pb-6 border-b" style={{ borderColor: 'var(--rule)' }}>
        <h1 className="text-3xl mb-2">
          {t('category.title')}
        </h1>
        <p className="t-lead">
          {t('category.subtitle', { count: data.length })}
        </p>
      </div>

      {loading && <Spinner />}

      {error && (
        <div className="card p-6 text-center" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <EmptyState title={t('category.empty')} icon="📁" />
      )}

      {!loading && !error && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {data.map((category) => (
            <Link
              key={category.id}
              to={`/categories/${category.slug}`}
              className="card-flat block group"
            >
              <h2
                className="text-lg mb-2 flex items-center gap-2 group-hover:text-[color:var(--brand)]"
              >
                <span aria-hidden="true">📁</span>
                {category.name}
              </h2>
              {category.description && (
                <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  {category.description}
                </p>
              )}
              <p className="text-meta" style={{ color: 'var(--text-muted)' }}>
                {t('category.postCount', { count: category.post_count ?? 0 })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
