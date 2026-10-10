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
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {t('category.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((category) => (
            <Link
              key={category.id}
              to={`/categories/${category.slug}`}
              className="card card-hover block p-6"
            >
              <h2
                className="text-lg font-bold mb-2 flex items-center gap-2"
                style={{ color: 'var(--text)' }}
              >
                <span aria-hidden="true">📁</span>
                {category.name}
              </h2>
              {category.description && (
                <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  {category.description}
                </p>
              )}
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('category.postCount', { count: category.post_count ?? 0 })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
