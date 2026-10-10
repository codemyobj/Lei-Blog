import { useAsyncResource } from './useAsyncResource'
import i18n from '../i18n'
import type { Tag, Post } from '../types'

/** 全部标签（含每标签已发布文章数） */
export function useTags() {
  const { data, loading, error } = useAsyncResource<{ tags: Tag[] }>(
    'tags',
    '/tags',
    i18n.t('error.loadTags')
  )
  return { tags: data?.tags ?? [], loading, error }
}

/** 单个标签详情；slug 为空时（路由参数未就绪）不发请求，loading 直接为 false */
export function useTag(slug: string | undefined) {
  const { data, loading, error } = useAsyncResource<{ tag: Tag; posts: Post[] }>(
    slug ?? null,
    `/tags/${slug ?? ''}`,
    i18n.t('error.loadTags')
  )
  return { tag: data?.tag ?? null, posts: data?.posts ?? [], loading, error }
}
