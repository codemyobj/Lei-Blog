import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { adminGetStats } from '../../hooks/useAdmin'
import { Spinner } from '../../components/Spinner'

export default function AdminDashboardPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<{
    publishedCount: number
    draftCount: number
    totalViews: number
    tagCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGetStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    { label: t('admin.statPublished'), value: stats?.publishedCount ?? 0, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'var(--success)', to: '/admin/posts' },
    { label: t('admin.statDraft'), value: stats?.draftCount ?? 0, icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'var(--warning)', to: '/admin/posts' },
    { label: t('admin.statViews'), value: stats?.totalViews ?? 0, icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z', color: 'var(--brand)', to: '/admin/posts' },
    { label: t('admin.statTags'), value: stats?.tagCount ?? 0, icon: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01', color: '#8b5cf6', to: '/admin/tags' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>{t('admin.dashboard')}</h1>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat) => (
              <Link key={stat.label} to={stat.to} className="card card-hover p-5">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${stat.color} 15%, transparent)` }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={stat.icon} />
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{stat.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
              </Link>
            ))}
          </div>

          {/* 快捷操作 */}
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>{t('admin.quickActions')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/admin/posts/new" className="card card-hover p-5 flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center" style={{ background: 'var(--wash)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text)' }}>{t('admin.newPost')}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('admin.newPostDesc')}</div>
              </div>
            </Link>
            <Link to="/admin/about" className="card card-hover p-5 flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center" style={{ background: 'var(--wash)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text)' }}>{t('admin.editAbout')}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('admin.editAboutDesc')}</div>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
