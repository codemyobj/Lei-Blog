import { useAsyncResource } from './useAsyncResource'
import i18n from '../i18n'
import type { Category } from '../types'

/** 全部分类（含已发布文章数） */
export function useCategories() {
  const { data, loading, error } = useAsyncResource<{ categories: Category[] }>(
    'categories',
    '/categories',
    i18n.t('error.loadCategories')
  )
  return { data: data?.categories ?? [], loading, error }
}

/** 单个分类详情；slug 为空时直接结束加载 */
export function useCategory(slug: string | undefined) {
  const { data, loading, error } = useAsyncResource<{ category: Category }>(
    slug ?? null,
    `/categories/${slug ?? ''}`,
    i18n.t('error.loadCategories')
  )
  return { category: data?.category ?? null, loading, error }
}
