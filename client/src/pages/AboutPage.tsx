import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import apiClient from '../api'
import type { About } from '../types'
import { Spinner } from '../components/Spinner'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { formatDate } from '../utils/formatDate'

export default function AboutPage() {
  const { t } = useTranslation()
  const [about, setAbout] = useState<About | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient
      .get('/about')
      .then((res) => setAbout(res.data.about))
      .catch((err) => setError(err.response?.data?.error || t('about.loadFailed')))
      .finally(() => setLoading(false))
  }, [t])

  if (loading) return <Spinner />

  if (error) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="card p-6" style={{ color: 'var(--danger)' }}>{error}</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <article>
        <MarkdownRenderer content={about?.content || ''} />

        {about?.updated_at && (
          <footer className="mt-12 pt-6 border-t text-meta text-center" style={{ borderColor: 'var(--rule)', color: 'var(--text-muted)' }}>
            {t('about.lastUpdated', { date: formatDate(about.updated_at) })}
          </footer>
        )}
      </article>
    </div>
  )
}
