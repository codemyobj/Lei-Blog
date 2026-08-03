import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import LanguageSwitcher from './LanguageSwitcher'

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const menuItems = [
    { to: '/admin', label: t('admin.dashboard'), icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
    { to: '/admin/posts', label: t('admin.posts'), icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6M9 9h1' },
    { to: '/admin/tags', label: t('admin.tags'), icon: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01' },
    { to: '/admin/about', label: t('admin.aboutEdit'), icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  ]

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* 侧边栏 */}
      <aside
        className="hidden lg:flex flex-col w-64 border-r fixed inset-y-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="h-16 flex items-center px-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <Link to="/admin" className="flex items-center gap-2 font-bold">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--brand)" />
              <path d="M9 11h14M9 16h14M9 21h9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span style={{ color: 'var(--text)' }}>{t('admin.title')}</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{
                color: isActive(item.to) ? 'var(--brand)' : 'var(--text-secondary)',
                background: isActive(item.to) ? 'var(--brand-light)' : 'transparent',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}

          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold mt-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
            </svg>
            {t('admin.backToBlog')}
          </Link>
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="px-4 py-2 mb-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{user?.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-danger w-full text-xs">
            {t('admin.logout')}
          </button>
        </div>
      </aside>

      {/* 移动端顶部栏 */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <Link to="/admin" className="font-bold text-sm" style={{ color: 'var(--text)' }}>{t('admin.title')}</Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button onClick={toggleTheme} className="p-2" style={{ color: 'var(--text-secondary)' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button onClick={handleLogout} className="btn btn-danger text-xs">{t('admin.logout')}</button>
        </div>
      </div>

      {/* 移动端底部导航 */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 flex items-center justify-around border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-1 px-3 py-2"
            style={{ color: isActive(item.to) ? 'var(--brand)' : 'var(--text-muted)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span className="text-[10px] font-semibold">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* 主内容区 */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
