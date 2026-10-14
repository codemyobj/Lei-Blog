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
      {/* 页头：杂志 masthead —— 红色 kicker + 衬线标题 + 导语 */}
      <header className="mb-12">
        <p className="t-kicker mb-5">{t('nav.categories')}</p>
        <h1 className="text-3xl mb-3">
          {t('category.title')}
        </h1>
        <p className="t-lead max-w-[56ch]">
          {t('category.subtitle', { count: data.length })}
        </p>
      </header>

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
              <p className="t-meta" style={{ color: 'var(--text-muted)' }}>
                {t('category.postCount', { count: category.post_count ?? 0 })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
