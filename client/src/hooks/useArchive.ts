import { useAsyncResource } from './useAsyncResource'
import i18n from '../i18n'
import type { ArchivePost } from '../types'

/** 归档列表：后端返回全部已发布文章的精简字段，按年份分组在前端做 */
export function useArchive() {
  const { data, loading, error } = useAsyncResource<{ posts: ArchivePost[]; total: number }>(
    'archive',
    '/posts/archive',
    i18n.t('error.loadArchive')
  )
  return { data: data?.posts ?? [], loading, error }
}

/** 按年份归并归档条目，年份倒序、年内按时间倒序 */
export function groupArchiveByYear(posts: ArchivePost[]): { year: string; posts: ArchivePost[] }[] {
  const buckets = new Map<string, ArchivePost[]>()

  for (const post of posts) {
    // published_at 理论上必填，但为 NULL 时归入「未知年份」而不是丢弃
    const year = post.published_at ? String(new Date(post.published_at).getFullYear()) : 'unknown'
    const bucket = buckets.get(year)
    if (bucket) {
      bucket.push(post)
    } else {
      buckets.set(year, [post])
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => {
      // unknown 永远排在最后
      if (a[0] === 'unknown') return 1
      if (b[0] === 'unknown') return -1
      return Number(b[0]) - Number(a[0])
    })
    .map(([year, yearPosts]) => ({
      year,
      posts: [...yearPosts].sort((a, b) => {
        const ta = a.published_at ? new Date(a.published_at).getTime() : 0
        const tb = b.published_at ? new Date(b.published_at).getTime() : 0
        return tb - ta
      }),
    }))
}
