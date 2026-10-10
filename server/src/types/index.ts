// ============================================================
// 服务端共享 TypeScript 类型
// 对应数据库表结构和 API 请求/响应格式
// ============================================================

// --- 数据库行类型 ---

export interface UserRow {
  id: number
  email: string
  password_hash: string
  name: string
  created_at: Date
  updated_at: Date
}

// 返回给客户端的安全用户对象（不含 password_hash）
export type SafeUser = Omit<UserRow, 'password_hash'>

export interface PostRow {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  cover_image: string | null
  status: 'draft' | 'published'
  view_count: number
  published_at: Date | null
  created_at: Date
  updated_at: Date
  /** 一级分类外键，可为空（文章允许无分类） */
  category_id: number | null
  /** 全文搜索专用列：标题 + 摘要 + 去 Markdown 的正文纯文本 */
  search_document: string | null
}

// 列表展示用的文章（不含 content / search_document）
export type PostListRow = Omit<PostRow, 'content' | 'search_document'>

export interface TagRow {
  id: number
  name: string
  slug: string
  created_at: Date
}

// 带文章数的标签
export interface TagWithCountRow extends TagRow {
  post_count: string | number
}

export interface PostTagRow {
  post_id: number
  tag_id: number
}

export interface CategoryRow {
  id: number
  name: string
  slug: string
  description: string | null
  sort_order: number
  created_at: Date
}

// 带文章数的分类
export interface CategoryWithCountRow extends CategoryRow {
  post_count: string | number
}

export interface AboutRow {
  id: number
  content: string
  updated_at: Date
}

/** 附在文章上的分类简略信息（文章无分类时为 null） */
export interface CategoryRef {
  id: number
  name: string
  slug: string
}

// --- 搜索相关类型 ---

/** 单条搜索结果 */
export interface SearchResultRow {
  id: number
  title: string
  slug: string
  excerpt: string | null
  published_at: Date | null
  /** 相关度得分（仅 trigram 分支有效；ILIKE 分支为 0） */
  score: number
  tags: TagRow[]
  category: CategoryRef | null
}

/** GET /api/search 响应体 */
export interface SearchResponseBody {
  results: SearchResultRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  took_ms: number
  /** 本次实际走的执行策略，便于排查降级是否符合预期 */
  strategy: 'trigram' | 'ilike'
  /** 是否额外参与了英文词干（to_tsvector('english')）匹配 */
  used_english_tsvector: boolean
}

/** 归档按年分组后的单篇文章条目 */
export interface ArchiveItemRow {
  id: number
  title: string
  slug: string
  published_at: Date | null
}

/** GET /api/posts/archive 响应体中的一个年份分组 */
export interface ArchiveGroup {
  year: number
  posts: ArchiveItemRow[]
}

// --- API 请求类型 ---

export interface LoginBody {
  email: string
  password: string
}

export interface CreatePostBody {
  title: string
  slug?: string
  excerpt?: string
  content: string
  cover_image?: string
  status?: 'draft' | 'published'
  published_at?: string
  tag_ids?: number[]
  /** 分类 ID；传 null 显式取消分类，不传表示不修改 */
  category_id?: number | null
}

export interface UpdatePostBody extends Partial<CreatePostBody> {}

export interface CreateTagBody {
  name: string
  slug?: string
}

export interface UpdateTagBody {
  name?: string
  slug?: string
}

export interface CreateCategoryBody {
  name: string
  slug?: string
  description?: string
  sort_order?: number
}

export interface UpdateCategoryBody {
  name?: string
  slug?: string
  description?: string
  sort_order?: number
}

export interface UpdateAboutBody {
  content: string
}
