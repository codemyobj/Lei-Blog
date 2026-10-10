import { useAsyncResource } from './useAsyncResource'
import i18n from '../i18n'
import type { Post, PaginatedPosts } from '../types'

/** 拼接列表查询串（只带上真正生效的筛选参数，避免空参数污染 URL） */
function buildListUrl(page: number, pageSize: number, tag?: string, category?: string): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (tag) params.set('tag', tag)
  if (category) params.set('category', category)
  return `/posts?${params.toString()}`
}

/**
 * 文章列表（分页）。
 *
 * 筛选维度互斥地通过 tag 或 category 传入；同时传两者时后端会叠加过滤，
 * 但页面层不应出现这种用法（标签页归标签页，分类页归分类页）。
 *
 * 重取由 `useAsyncResource` 内部的令牌完成——令牌只在事件处理器里递增，
 * 不在 effect 体内 setState（后者会命中 react-hooks/set-state-in-effect）。
 */
export function usePosts(page = 1, pageSize = 9, tag?: string, category?: string) {
  const requestKey = `posts|${page}|${pageSize}|${tag ?? ''}|${category ?? ''}`
  const { data, loading, error, reload } = useAsyncResource<PaginatedPosts>(
    requestKey,
    buildListUrl(page, pageSize, tag, category),
    i18n.t('error.loadPosts')
  )

  return { data, loading, error, refetch: reload }
}

export function usePost(slug: string | undefined) {
  const { data, loading, error } = useAsyncResource<{ post: Post }>(
    slug ?? null,
    `/posts/${slug ?? ''}`
  )
  return { post: data?.post ?? null, loading, error }
}
