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
    <div className="max-w-4xl">
      {/* 页头：标题 + 副标题 + 通栏强调线 */}
      <div className="mb-12 pb-6 border-b" style={{ borderColor: 'var(--rule)' }}>
        <h1 className="text-3xl mb-2">
          {t('archive.title')}
        </h1>
        <p className="t-lead">
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
        <div className="space-y-14">
          {groups.map((group) => (
            /* 两列索引：左列大号年份，右列规则行（桌面端分列，移动端自然堆叠） */
            <section key={group.year} className="grid lg:grid-cols-[10rem_1fr] gap-x-8 gap-y-4">
              {/* 年份作为分组锚点，方便将来做「跳转到某年」 */}
              <div>
                <h2
                  id={`year-${group.year}`}
                  className="text-2xl tabular-nums pb-2 border-b"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  {group.year === 'unknown' ? t('archive.unknownYear') : group.year}
                </h2>
                <p className="text-meta mt-2" style={{ color: 'var(--text-muted)' }}>
                  {t('archive.postCount', { count: group.posts.length })}
                </p>
              </div>

              <ul className="min-w-0">
                {group.posts.map((post) => (
                  <li
                    key={post.id}
                    className="flex items-baseline gap-3 border-b py-3 last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {/* 日期固定宽度，让标题左边缘对齐成一条线 */}
                    <time
                      dateTime={post.published_at ?? undefined}
                      className="text-meta shrink-0 tabular-nums"
                      style={{ color: 'var(--text-muted)', width: '5.5rem' }}
                    >
                      {post.published_at ? formatDate(post.published_at) : '—'}
                    </time>
                    <Link
                      to={`/posts/${post.slug}`}
                      className="text-sm transition-colors truncate hover:text-[color:var(--brand)]"
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
