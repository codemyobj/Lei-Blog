import { useTranslation } from 'react-i18next'
import { useTags } from '../hooks/useTags'
import { Spinner } from '../components/Spinner'
import TagCloud from '../components/TagCloud'

export default function TagsPage() {
  const { t } = useTranslation()
  const { tags, loading, error } = useTags()

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {t('tags.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('tags.subtitle', { count: tags.length })}
        </p>
      </div>

      {loading && <Spinner />}

      {error && (
        <div className="card p-6 text-center" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {!loading && !error && <TagCloud tags={tags} />}
    </div>
  )
}
