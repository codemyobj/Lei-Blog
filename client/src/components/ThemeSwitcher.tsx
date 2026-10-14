import { useTranslation } from 'react-i18next'
import type { ReactElement } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { Theme } from '../context/ThemeContext'

/** 三个可选主题，顺序即 UI 展示顺序 */
const THEME_OPTIONS: readonly Theme[] = ['light', 'dark', 'system']

/** 亮色：太阳 */
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
      <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
      <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
    </svg>
  )
}

/** 暗色：月亮 */
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

/** 跟随系统：显示器 */
function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

const ICONS: Record<Theme, () => ReactElement> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
}

/**
 * 主题切换器。
 *
 * - `variant="segmented"`（默认）：三段式分段控件，风格与 LanguageSwitcher 一致，桌面端用
 * - `variant="compact"`：单按钮循环 light → dark → system，移动端顶栏省空间用
 */
export default function ThemeSwitcher({
  variant = 'segmented',
  className = '',
}: {
  variant?: 'segmented' | 'compact'
  className?: string
}) {
  const { t } = useTranslation()
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()

  const labelOf = (value: Theme): string => {
    if (value === 'light') return t('theme.light')
    if (value === 'dark') return t('theme.dark')
    return t('theme.system')
  }

  if (variant === 'compact') {
    const CurrentIcon = ICONS[theme]
    // 提示语里带上「点击后是什么」，避免用户误以为按钮坏了
    const nextLabel = labelOf(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`p-2 transition-colors ${className}`}
        style={{ color: 'var(--text-secondary)' }}
        title={`${t('theme.label')}：${labelOf(theme)}（→ ${nextLabel}）`}
        aria-label={`${t('theme.label')}：${labelOf(theme)}（→ ${nextLabel}）`}
      >
        <span className="flex items-center justify-center w-5 h-5">
          <CurrentIcon />
        </span>
      </button>
    )
  }

  return (
    <div
      className={`inline-flex items-center p-0.5 ${className}`}
      style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
      role="group"
      aria-label={t('theme.label')}
    >
      {THEME_OPTIONS.map((option) => {
        const active = theme === option
        const Icon = ICONS[option]
        return (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            className="p-1.5 transition-colors"
            style={{
              background: active ? 'var(--brand)' : 'transparent',
              /* 暗色下 --brand-fg 是近黑：#fff 在 #FF4D4D 上只有 3.27:1 */
              color: active ? 'var(--brand-fg)' : 'var(--text-secondary)',
            }}
            title={labelOf(option)}
            aria-label={labelOf(option)}
            aria-pressed={active}
          >
            <span className="flex items-center justify-center w-4 h-4">
              <Icon />
            </span>
          </button>
        )
      })}
      {/* 供读屏软件播报当前生效主题（system 时与选择值不同） */}
      <span className="sr-only" aria-live="polite">
        {t('theme.current', { theme: resolvedTheme === 'dark' ? t('theme.dark') : t('theme.light') })}
      </span>
    </div>
  )
}
