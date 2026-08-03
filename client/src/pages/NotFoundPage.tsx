import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <div className="text-8xl font-bold mb-4" style={{ color: 'var(--brand)' }}>404</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>{t('notFound.title')}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          {t('notFound.desc')}
        </p>
        <Link to="/" className="btn btn-primary">{t('notFound.backHome')}</Link>
      </div>
    </div>
  )
}
