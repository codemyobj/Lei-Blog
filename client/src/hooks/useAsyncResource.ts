import { useCallback, useEffect, useState } from 'react'
import apiClient from '../api'
import i18n from '../i18n'

/** 从 axios 错误中取出后端返回的 error 文案，取不到则回退默认文案 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    const message = response?.data?.error
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

/**
 * 带「请求键」的异步 GET 资源。
 *
 * 为什么不写成 `useEffect` 里同步 `setLoading(true)`：
 * 那会在 effect 体内直接触发一次额外渲染，命中
 * `react-hooks/set-state-in-effect`（eslint-plugin-react-hooks v7 新增规则）。
 * 这里改为**派生**——`loading` 由「当前请求键」与「是否已有该键的结果」推出，
 * effect 体内只有异步回调里的赋值，不产生级联渲染。
 *
 * 另外，取值时按请求键校验归属：键对不上就返回初始值，
 * 这样切换筛选条件 / 翻页时，上一次的旧数据不会短暂闪现。
 *
 * @param requestKey     请求标识；传 `null` 表示「不发请求」（如 slug 尚未就绪）
 * @param url            请求地址
 * @param fallbackMessage 失败且后端未返回 error 字段时的兜底文案
 */
export function useAsyncResource<T>(
  requestKey: string | null,
  url: string,
  fallbackMessage: string = i18n.t('error.loadFailed')
) {
  const [value, setValue] = useState<{ key: string; data: T } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // 重取令牌参与请求键。令牌只能由事件处理器（reload）递增，
  // 不能在 effect 体内 setState——那正是本 hook 要规避的写法。
  const key = requestKey === null ? null : `${reloadToken}|${requestKey}`

  useEffect(() => {
    if (key === null) return

    let cancelled = false

    apiClient
      .get<T>(url)
      .then((res) => {
        if (!cancelled) setValue({ key, data: res.data })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFailure({ key, message: extractErrorMessage(err, fallbackMessage) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [key, url, fallbackMessage])

  const settled = value?.key === key || failure?.key === key

  /** 重新拉取（仍走同一个请求键，只是让键变化以触发 effect） */
  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return {
    data: value?.key === key ? value.data : null,
    error: failure?.key === key ? failure.message : '',
    loading: key !== null && !settled,
    reload,
  }
}
