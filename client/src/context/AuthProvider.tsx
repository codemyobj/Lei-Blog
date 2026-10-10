import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import apiClient from '../api'
import type { User } from '../types'
import { AuthContext } from './AuthContext'

/**
 * 认证状态提供者：负责「页面加载时用本地 token 恢复会话」。
 *
 * 组件与 `useAuth` 分文件，原因见 `AuthContext.tsx` 顶部注释。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  /**
   * 初始 loading 由「本地是否存在 token」直接派生。
   *
   * 不能写成 `useState(true)` 再在 effect 里 `setLoading(false)`——那是在
   * effect 体内同步 setState，会命中 `react-hooks/set-state-in-effect`
   * （首次渲染后立即再渲染一次）。无 token 时首帧即已就绪，
   * 只有存在 token 时才需要等 `/auth/me` 返回。
   */
  const [loading, setLoading] = useState<boolean>(() => Boolean(localStorage.getItem('token')))

  useEffect(() => {
    if (!localStorage.getItem('token')) return

    let cancelled = false

    apiClient
      .get('/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.data.user)
      })
      .catch(() => {
        // token 失效（过期 / 被吊销）：清掉本地凭证，回到未登录态
        localStorage.removeItem('token')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password })
    localStorage.setItem('token', res.data.token)
    setUser(res.data.user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
