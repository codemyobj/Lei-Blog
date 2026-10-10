import { createContext, useContext } from 'react'
import type { User } from '../types'

export interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

/**
 * 认证上下文。
 *
 * ⚠️ 本文件刻意**只导出 context 与 hook**，不导出组件。
 * `react-refresh/only-export-components` 要求「只导出组件的文件」才能保住
 * Fast Refresh：组件与 hook 混在一个文件里，改动该文件时会退化成整页刷新。
 * 因此 `AuthProvider` 组件单独放在 `./AuthProvider.tsx`。
 */
export const AuthContext = createContext<AuthContextType | null>(null)

/** 读取认证上下文；未包裹 `<AuthProvider>` 时直接抛错，避免拿到 null 后再空指针 */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内部使用')
  return ctx
}
