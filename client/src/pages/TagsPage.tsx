import { useTranslation } from 'react-i18next'
import { useTags } from '../hooks/useTags'
import { Spinner } from '../components/Spinner'
import TagCloud from '../components/TagCloud'

export default function TagsPage() {
  const { t } = useTranslation()
  const { tags, loading, error } = useTags()

  return (
    <div>
      {/* 页头：去掉居中，改左对齐栅格 + 通栏强调线 */}
      <div className="mb-12 pb-6 border-b" style={{ borderColor: 'var(--rule)' }}>
        <h1 className="text-3xl mb-2">
          {t('tags.title')}
        </h1>
        <p className="t-lead">
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
