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
