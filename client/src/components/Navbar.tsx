import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'

export default function Navbar() {
  const location = useLocation()
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/tags', label: t('nav.tags') },
    { to: '/about', label: t('nav.about') },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md border-b"
      style={{ background: 'color-mix(in srgb, var(--surface) 85%, transparent)', borderColor: 'var(--border)' }}
    >
      <nav className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg" style={{ color: 'var(--text)' }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="var(--brand)" />
            <path d="M9 11h14M9 16h14M9 21h9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span>{t('nav.brand')}</span>
        </Link>

        {/* 桌面端导航 */}
        <div className="hidden sm:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
              style={{
                color: isActive(link.to) ? 'var(--brand)' : 'var(--text-secondary)',
                background: isActive(link.to) ? 'var(--brand-light)' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          ))}

          {/* 语言切换 */}
          <LanguageSwitcher className="ml-1" />

          {/* 主题切换 */}
          <button
            onClick={toggleTheme}
            className="ml-1 p-2 rounded-full transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={t('nav.toggleTheme')}
            aria-label={t('nav.toggleTheme')}
          >
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>

          {/* 后台入口 */}
          <Link
            to={user ? '/admin' : '/admin/login'}
            className="btn btn-outline ml-2 text-xs"
          >
            {user ? t('nav.admin') : t('nav.login')}
          </Link>
        </div>

        {/* 移动端菜单按钮 */}
        <div className="flex sm:hidden items-center gap-2">
          <LanguageSwitcher />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={t('nav.toggleTheme')}
          >
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-full"
            style={{ color: 'var(--text)' }}
              aria-label={t('nav.menu')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* 移动端展开菜单 */}
      {mobileOpen && (
        <div className="sm:hidden border-t" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
                style={{
                  color: isActive(link.to) ? 'var(--brand)' : 'var(--text-secondary)',
                  background: isActive(link.to) ? 'var(--brand-light)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={user ? '/admin' : '/admin/login'}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              {user ? t('nav.admin') : t('nav.login')}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
