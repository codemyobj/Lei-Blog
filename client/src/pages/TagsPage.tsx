import { useTranslation } from 'react-i18next'
import { useTags } from '../hooks/useTags'
import { Spinner } from '../components/Spinner'
import TagCloud from '../components/TagCloud'

export default function TagsPage() {
  const { t } = useTranslation()
  const { tags, loading, error } = useTags()

  return (
    <div>
      {/* 页头：手账 masthead —— 手写小标注 + 黑体标题 + 导语 */}
      <header className="mb-12">
        <p className="t-kicker mb-5">{t('nav.tags')}</p>
        <h1 className="text-3xl mb-3">
          {t('tags.title')}
        </h1>
        <p className="t-lead max-w-[56ch]">
          {t('tags.subtitle', { count: tags.length })}
        </p>
      </header>

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
