import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  return (
    /* footer 上沿改用强调线 --rule（Swiss 用线做结构分隔，不用浅浅的 --border） */
    <footer className="border-t mt-16" style={{ borderColor: 'var(--rule)' }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="t-meta" style={{ color: 'var(--text-muted)' }}>
          {t('footer.text', { year })}
        </p>
        <div className="flex items-center gap-4 t-meta">
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
