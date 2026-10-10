import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DARK_MEDIA_QUERY,
  ThemeContext,
  persistTheme,
  readStoredTheme,
  systemPrefersDark,
} from './ThemeContext'
import type { ResolvedTheme, Theme, ThemeContextType } from './ThemeContext'

/**
 * 主题状态提供者。
 *
 * 组件与 `useTheme` 分文件，原因见 `ThemeContext.tsx` 顶部注释。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)

  // 监听系统配色变化：system 模式下要实时跟随
  useEffect(() => {
    const mql = window.matchMedia(DARK_MEDIA_QUERY)
    const handleChange = (event: MediaQueryListEvent): void => {
      setSystemDark(event.matches)
    }

    // Safari 14 以下只有已废弃的 addListener，做能力探测兜底
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange)
      return () => mql.removeEventListener('change', handleChange)
    }
    mql.addListener(handleChange)
    return () => mql.removeListener(handleChange)
  }, [])

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // 同步到 <html class="dark">；Tailwind darkMode:'class' 与 hljs 变量均依赖该 class
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    // 让原生控件（滚动条、表单、日期选择器）跟随主题
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    persistTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    // 基于「当前实际显示」取反，而非基于存储值，否则 system 模式下点击可能毫无变化
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value = useMemo<ThemeContextType>(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
