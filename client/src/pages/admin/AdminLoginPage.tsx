import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../hooks/useAsyncResource'

export default function AdminLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/admin')
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t('error.loginFailed')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        {/* 返回博客 */}
        <Link to="/" className="inline-flex items-center gap-1 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('admin.backToBlog')}
        </Link>

        <div className="card p-8">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="0" fill="var(--brand)" />
              <path d="M9 11h14M9 16h14M9 21h9" stroke="var(--brand-fg)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>{t('admin.loginTitle')}</span>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('admin.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('admin.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
              {loading ? t('admin.loggingIn') : t('admin.login')}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
