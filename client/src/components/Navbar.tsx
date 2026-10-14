import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const location = useLocation()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/archive', label: t('nav.archive') },
    { to: '/categories', label: t('nav.categories') },
    { to: '/tags', label: t('nav.tags') },
    { to: '/about', label: t('nav.about') },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  /**
   * 导航链接的统一样式（桌面 / 移动端复用）。
   *
   * 激活态用**反相块**（--invert-bg / --invert-fg）而非品牌色浅底：
   * 原 --brand-light 是品牌色洗底，与"单强调色"纪律冲突。
   */
  const linkStyle = (path: string) => ({
    color: isActive(path) ? 'var(--invert-fg)' : 'var(--text-secondary)',
    background: isActive(path) ? 'var(--invert-bg)' : 'transparent',
  })

  return (
    <header
      className="sticky top-0 z-50 border-b"
      /* ⚠️ h-16 (64px) 被 TocSidebar 的 rootMargin 与 .markdown-body 的
         scroll-margin-top 成对依赖，不要改。 */
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <nav className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0" style={{ color: 'var(--text)' }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="0" fill="var(--brand)" />
            <path d="M9 11h14M9 16h14M9 21h9" stroke="var(--brand-fg)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="hidden lg:inline">{t('nav.brand')}</span>
        </Link>

        {/*
          桌面端导航。
          ⚠️ 断点用 lg 而非 sm：英文 label（Home/Archive/Categories/Tags/About）
          比中文长得多，640px 下放不下 5 个链接 + 搜索 + 语言 + 主题 + 登录按钮。
        */}
        <div className="hidden lg:flex items-center gap-0.5">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="px-3 py-2 text-sm font-semibold transition-colors"
              style={linkStyle(link.to)}
            >
              {link.label}
            </Link>
          ))}

          {/* 搜索入口（图标按钮，节省横向空间） */}
          <Link
            to="/search"
            className="ml-0.5 p-2 transition-colors"
            style={{ color: isActive('/search') ? 'var(--brand)' : 'var(--text-secondary)' }}
            title={t('nav.search')}
            aria-label={t('nav.search')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>

          {/* 语言切换 */}
          <LanguageSwitcher className="ml-1" />

          {/* 主题三态切换 */}
          <ThemeSwitcher className="ml-1" />

          {/* 后台入口（统一 14px：Swiss 下按钮不再缩小） */}
          <Link
            to={user ? '/admin' : '/admin/login'}
            className="btn btn-outline ml-2"
          >
            {user ? t('nav.admin') : t('nav.login')}
          </Link>
        </div>

        {/* 移动端菜单按钮 */}
        <div className="flex lg:hidden items-center gap-1">
          <Link
            to="/search"
            className="p-2"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={t('nav.search')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>

          <LanguageSwitcher />

          {/* 移动端用紧凑版：单按钮循环 亮 → 暗 → 跟随系统 */}
          <ThemeSwitcher variant="compact" />

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2"
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
        <div className="lg:hidden border-t" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="px-6 py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 text-sm font-semibold transition-colors"
                style={linkStyle(link.to)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={user ? '/admin' : '/admin/login'}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 text-sm font-semibold"
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
