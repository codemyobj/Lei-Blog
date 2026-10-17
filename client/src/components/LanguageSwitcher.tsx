import { useTranslation } from 'react-i18next'

// 语言切换器：分段控件，中文 / English 一键切换，偏好持久化在 localStorage
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation()
  const current = i18n.resolvedLanguage || i18n.language
  const options = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'EN' },
  ]

  return (
    <div
      className={`inline-flex items-center p-0.5 text-xs font-semibold ${className}`}
      style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
      role="group"
      aria-label="Language"
    >
      {options.map((opt) => {
        const active = current.startsWith(opt.code)
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => i18n.changeLanguage(opt.code)}
            className="px-2.5 py-1 transition-colors"
            style={{
              background: active ? 'var(--brand)' : 'transparent',
              /* var(--brand-fg) 亮暗两套 token 均已按 ≥4.5:1 校验（见 scripts/verify-contrast.mjs） */
              color: active ? 'var(--brand-fg)' : 'var(--text-secondary)',
            }}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
