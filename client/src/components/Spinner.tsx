import { useTranslation } from 'react-i18next'

export function Spinner() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="spinner" />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )
}
