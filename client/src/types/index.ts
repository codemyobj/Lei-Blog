// 前端共享 TypeScript 类型

export interface User {
  id: number
  email: string
  name: string
  created_at: string
  updated_at: string
}

export interface Tag {
  id: number
  name: string
  slug: string
  created_at?: string
  post_count?: number
}

/** 分类（详情页与列表项共用；列表项含 post_count） */
export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  sort_order: number
  post_count?: number
}

/** 文章上挂载的分类引用（后端拼接的精简形态，无分类时为 null） */
export interface CategoryRef {
  id: number
  name: string
  slug: string
}

export interface Post {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content?: string | null
  cover_image: string | null
  status: 'draft' | 'published'
  view_count: number
  published_at: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
  tag_ids?: number[]
  /** 所属分类；后端保证无分类时为 null（而非 undefined），API 形状稳定 */
  category?: CategoryRef | null
}

/** 归档条目：后端只返回列表展示所需的最小字段 */
export interface ArchivePost {
  id: number
  title: string
  slug: string
  published_at: string | null
}

/**
 * 搜索结果项。
 *
 * 注意：**服务端不返回高亮片段**，`title` / `excerpt` 都是纯文本，
 * 关键词高亮由前端用 <mark> 包裹（见 components/Highlight.tsx）。
 */
export interface SearchResult {
  id: number
  title: string
  slug: string
  excerpt: string | null
  published_at: string | null
  score: number
  tags: Tag[]
  category: CategoryRef | null
}

/** 搜索命中的策略，用于诊断与提示（trigram / ILIKE 降级） */
export type SearchStrategy = 'trigram' | 'ilike'

export interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  /** 服务端查询耗时（毫秒） */
  took_ms: number
  strategy: SearchStrategy
  /** 本次是否叠加了英文词干匹配（查询含 ASCII 时） */
  used_english_tsvector: boolean
}

export interface About {
  id: number
  content: string
  updated_at: string | null
}

export interface PaginatedPosts {
  posts: Post[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreatePostData {
  title: string
  slug?: string
  excerpt?: string
  content: string
  cover_image?: string
  status?: 'draft' | 'published'
  published_at?: string
  tag_ids?: number[]
}

export interface CreateTagData {
  name: string
  slug?: string
}
