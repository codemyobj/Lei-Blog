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
}

// 列表展示用的文章（不含 content）
export type PostListRow = Omit<PostRow, 'content'>

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

export interface AboutRow {
  id: number
  content: string
  updated_at: Date
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

export interface UpdateAboutBody {
  content: string
}
