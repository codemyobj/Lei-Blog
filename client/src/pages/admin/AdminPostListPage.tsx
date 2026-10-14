import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { adminDeletePost } from '../../hooks/useAdmin'
import { extractErrorMessage, useAsyncResource } from '../../hooks/useAsyncResource'
import type { Post, PaginatedPosts } from '../../types'
import { Spinner } from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import { formatDate } from '../../utils/formatDate'

const PAGE_SIZE = 10

export default function AdminPostListPage() {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)

  // 列表拉取交给 useAsyncResource：loading 由「请求键」派生，
  // 避免在 effect 体内同步 setLoading(true) 触发级联渲染
  // （react-hooks/set-state-in-effect）。
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (statusFilter) params.set('status', statusFilter)

  const { data, loading, error, reload } = useAsyncResource<PaginatedPosts>(
    `admin-posts|${page}|${statusFilter}`,
    `/admin/posts?${params.toString()}`
  )

  const handleDelete = async (id: number) => {
    if (!confirm(t('error.deletePostConfirm'))) return
    try {
      await adminDeletePost(id)
      reload()
    } catch (err: unknown) {
      alert(extractErrorMessage(err, t('error.deleteFailed')))
    }
  }

  return (
    <div>
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl" style={{ color: 'var(--text)' }}>{t('admin.posts')}</h1>
        <Link to="/admin/posts/new" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('admin.newPost')}
        </Link>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 mb-6">
        {[
          { value: '', label: t('admin.filterAll') },
          { value: 'published', label: t('admin.filterPublished') },
          { value: 'draft', label: t('admin.filterDraft') },
        ].map((filter) => (
          <button
            key={filter.value}
            onClick={() => { setStatusFilter(filter.value); setPage(1) }}
            className="btn text-xs"
            style={{
              background: statusFilter === filter.value ? 'var(--brand)' : 'var(--surface)',
              color: statusFilter === filter.value ? 'var(--invert-fg)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* 拉取失败 */}
      {error && (
        <div className="card p-4 mb-6 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : data && data.posts.length > 0 ? (
        <>
          {/* 文章列表 */}
          <div className="flex flex-col gap-3">
            {data.posts.map((post: Post) => (
              <div key={post.id} className="card p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      className="font-semibold hover:opacity-70 truncate"
                      style={{ color: 'var(--text)' }}
                    >
                      {post.title}
                    </Link>
                    <span
                      className="text-xs px-2 py-0.5 font-semibold"
                      style={{
                        background: post.status === 'published' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--warning) 15%, transparent)',
                        color: post.status === 'published' ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      {post.status === 'published' ? t('admin.published') : t('admin.draft')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{post.published_at ? formatDate(post.published_at) : t('admin.notPublished')}</span>
                    <span>{t('post.viewsCount', { count: post.view_count })}</span>
                    {post.tags && post.tags.length > 0 && (
                      <span className="hidden sm:inline truncate">
                        {post.tags.map((tag) => `#${tag.name}`).join(' ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {post.status === 'published' && (
                    <a
                      href={`/posts/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost text-xs"
                      title={t('admin.view')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </a>
                  )}
                  <Link to={`/admin/posts/${post.id}/edit`} className="btn btn-outline text-xs">
                    {t('admin.edit')}
                  </Link>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="btn btn-danger text-xs"
                  >
                    {t('admin.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-outline text-xs"
              >
                {t('pagination.prev')}
              </button>
              <span className="text-sm px-3" style={{ color: 'var(--text-secondary)' }}>
                {t('pagination.pageOf', { page, totalPages: data.totalPages })}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="btn btn-outline text-xs"
              >
                {t('pagination.next')}
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={t('admin.emptyPostsTitle')}
          description={t('admin.emptyPostsDesc')}
          icon="📝"
        />
      )}
    </div>
  )
}
