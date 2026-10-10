import { createContext, useContext } from 'react'

/**
 * 用户可选择的主题（三态）。
 *
 * - `light` / `dark`：显式锁定
 * - `system`：跟随操作系统 `prefers-color-scheme`，系统切换时实时跟随
 */
export type Theme = 'light' | 'dark' | 'system'

/** 实际生效的主题（system 已解析为 light / dark） */
export type ResolvedTheme = 'light' | 'dark'

/** localStorage 键名。⚠️ 必须与 index.html 内联防闪白脚本保持一致 */
export const THEME_STORAGE_KEY = 'theme'

/** 系统深色偏好媒体查询。⚠️ 必须与 index.html 内联脚本保持一致 */
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export interface ThemeContextType {
  /** 用户选择的三态值 */
  theme: Theme
  /** 实际生效的二态值，供 UI 判断当前是亮是暗 */
  resolvedTheme: ResolvedTheme
  /** 直接设置三态（写入 localStorage 并持久化） */
  setTheme: (next: Theme) => void
  /** 在 light ↔ dark 之间切换（保留给旧调用方；system 状态下点击会解析后再取反） */
  toggleTheme: () => void
}

/**
 * 主题上下文。
 *
 * ⚠️ 本文件刻意**只导出 context / hook / 常量**，不导出组件：
 * `react-refresh/only-export-components` 要求「只导出组件的文件」才能保住
 * Fast Refresh，组件与 hook 混在一个文件里会让该文件退化成整页刷新。
 * `ThemeProvider` 组件因此单独放在 `./ThemeProvider.tsx`。
 *
 * 三个导出（`THEME_STORAGE_KEY` / `DARK_MEDIA_QUERY` / `useTheme`）在 Provider
 * 与 `index.html` 内联脚本之间共享，是「同一份约定只写一次」的唯一来源。
 */
export const ThemeContext = createContext<ThemeContextType | null>(null)

/** 读取主题上下文；未包裹 `<ThemeProvider>` 时直接抛错 */
export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 <ThemeProvider> 内部使用')
  return ctx
}

/**
 * 读取持久化的主题偏好。
 *
 * 只接受合法三态值；脏数据（如历史版本写入的其它字符串）一律回落到 `system`，
 * 避免出现「存储里有值但 UI 无法解释」的中间态。
 */
export function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved && (['light', 'dark', 'system'] as readonly string[]).includes(saved)) {
      return saved as Theme
    }
  } catch {
    // 隐私模式下 localStorage 可能不可写，忽略即可
  }
  return 'system'
}

/** 写入持久化的主题偏好（失败静默：无痕模式 / 配额耗尽不应影响切换） */
export function persistTheme(next: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // 忽略写入失败，不应影响主题切换
  }
}

/** 当前系统是否偏好深色 */
export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_MEDIA_QUERY).matches
}
