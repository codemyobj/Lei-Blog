import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  return (
    <footer className="border-t mt-12" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('footer.text', { year })}
        </p>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/about" style={{ color: 'var(--text-muted)' }} className="hover:underline">
            {t('footer.about')}
          </Link>
          <Link to="/tags" style={{ color: 'var(--text-muted)' }} className="hover:underline">
            {t('nav.tags')}
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)' }}
            className="hover:underline"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
