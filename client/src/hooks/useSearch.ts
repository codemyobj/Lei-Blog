import { useState, useEffect } from 'react'
import apiClient from '../api'
import i18n from '../i18n'
import type { SearchResponse } from '../types'
import { extractErrorMessage } from './useAsyncResource'

/** 输入停止后等待多久才发请求，避免逐字符打服务端 */
export const SEARCH_DEBOUNCE_MS = 250

/**
 * 全文搜索。
 *
 * @param query 关键词
 * @param page  页码，从 1 开始
 *
 * 两个设计点：
 * 1. 空查询**不发请求**，直接清空结果，避免无意义的后端往返。
 * 2. 所有 setState 都发生在防抖定时器的**回调**里（异步），
 *    而不是 effect 体内同步调用——后者会命中
 *    `react-hooks/set-state-in-effect`，造成级联渲染。
 *    `loading` 因此改为派生：请求键已有结果即视为完成。
 */
export function useSearch(query: string, page = 1) {
  const trimmed = query.trim()
  const requestKey = trimmed ? `search|${trimmed}|${page}` : null

  const [value, setValue] = useState<{ key: string; data: SearchResponse } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)

  useEffect(() => {
    if (requestKey === null) return

    let cancelled = false

    const timer = window.setTimeout(() => {
      apiClient
        .get<SearchResponse>('/search', { params: { q: trimmed, page, pageSize: 10 } })
        .then((res) => {
          if (!cancelled) setValue({ key: requestKey, data: res.data })
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setFailure({
              key: requestKey,
              message: extractErrorMessage(err, i18n.t('error.searchFailed')),
            })
          }
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [requestKey, trimmed, page])

  const settled = value?.key === requestKey || failure?.key === requestKey

  return {
    data: value?.key === requestKey ? value.data : null,
    error: failure?.key === requestKey ? failure.message : '',
    loading: requestKey !== null && !settled,
  }
}
