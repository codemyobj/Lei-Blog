import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        {/* 短横线：Swiss 用线做结构，不用颜色 */}
        <div className="w-16 border-t-4 mb-6 mx-auto" style={{ borderColor: 'var(--rule)' }} />
        <div className="text-8xl mb-4" style={{ color: 'var(--text)' }}>404</div>
        <h1 className="text-2xl mb-2">{t('notFound.title')}</h1>
        <p className="t-lead mb-8">
          {t('notFound.desc')}
        </p>
        <Link to="/" className="btn btn-primary">{t('notFound.backHome')}</Link>
      </div>
    </div>
  )
}
