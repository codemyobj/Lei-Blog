import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useArchive, groupArchiveByYear } from '../hooks/useArchive'
import { Spinner } from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { formatDate } from '../utils/formatDate'

export default function ArchivePage() {
  const { t } = useTranslation()
  const { data, loading, error } = useArchive()

  const groups = groupArchiveByYear(data)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {t('archive.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('archive.subtitle', { count: data.length })}
        </p>
      </div>

      {loading && <Spinner />}

      {error && (
        <div className="card p-6 text-center" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <EmptyState title={t('archive.empty')} description={t('archive.emptyDesc')} icon="🗂️" />
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.year}>
              {/* 年份作为分组锚点，方便将来做「跳转到某年」 */}
              <h2
                id={`year-${group.year}`}
                className="text-xl font-bold mb-4 pb-2 border-b"
                style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
              >
                {group.year === 'unknown' ? t('archive.unknownYear') : group.year}
                <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                  {t('archive.postCount', { count: group.posts.length })}
                </span>
              </h2>

              <ul className="space-y-3">
                {group.posts.map((post) => (
                  <li key={post.id} className="flex items-baseline gap-3">
                    {/* 日期固定宽度，让标题左边缘对齐成一条线 */}
                    <time
                      dateTime={post.published_at ?? undefined}
                      className="text-xs shrink-0 tabular-nums"
                      style={{ color: 'var(--text-muted)', width: '5.5rem' }}
                    >
                      {post.published_at ? formatDate(post.published_at) : '—'}
                    </time>
                    <Link
                      to={`/posts/${post.slug}`}
                      className="text-sm hover:opacity-70 transition-opacity truncate"
                      style={{ color: 'var(--text)' }}
                    >
                      {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
