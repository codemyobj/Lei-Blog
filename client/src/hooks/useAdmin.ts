import apiClient from '../api'
import type { Post, Tag, About, CreatePostData, CreateTagData, PaginatedPosts } from '../types'

// 文章管理
export async function adminGetPosts(page = 1, pageSize = 20, status?: string): Promise<PaginatedPosts> {
  const params: Record<string, string | number> = { page, pageSize }
  if (status) params.status = status
  const res = await apiClient.get('/admin/posts', { params })
  return res.data
}

export async function adminGetPost(id: number): Promise<Post> {
  const res = await apiClient.get(`/admin/posts/${id}`)
  return res.data.post
}

export async function adminCreatePost(data: CreatePostData): Promise<Post> {
  const res = await apiClient.post('/admin/posts', data)
  return res.data.post
}

export async function adminUpdatePost(id: number, data: Partial<CreatePostData>): Promise<Post> {
  const res = await apiClient.put(`/admin/posts/${id}`, data)
  return res.data.post
}

export async function adminDeletePost(id: number): Promise<void> {
  await apiClient.delete(`/admin/posts/${id}`)
}

// 标签管理
export async function adminGetTags(): Promise<Tag[]> {
  const res = await apiClient.get('/admin/tags')
  return res.data.tags
}

export async function adminCreateTag(data: CreateTagData): Promise<Tag> {
  const res = await apiClient.post('/admin/tags', data)
  return res.data.tag
}

export async function adminUpdateTag(id: number, data: Partial<CreateTagData>): Promise<Tag> {
  const res = await apiClient.put(`/admin/tags/${id}`, data)
  return res.data.tag
}

export async function adminDeleteTag(id: number): Promise<void> {
  await apiClient.delete(`/admin/tags/${id}`)
}

// 关于页管理
export async function adminGetAbout(): Promise<About> {
  const res = await apiClient.get('/admin/about')
  return res.data.about
}

export async function adminUpdateAbout(content: string): Promise<About> {
  const res = await apiClient.put('/admin/about', { content })
  return res.data.about
}

// 仪表盘统计
export async function adminGetStats(): Promise<{
  publishedCount: number
  draftCount: number
  totalViews: number
  tagCount: number
}> {
  const [posts, tags] = await Promise.all([adminGetPosts(1, 1000), adminGetTags()])
  const published = posts.posts.filter((p) => p.status === 'published').length
  const draft = posts.posts.filter((p) => p.status === 'draft').length
  const totalViews = posts.posts.reduce((sum, p) => sum + (p.view_count || 0), 0)
  return {
    publishedCount: published,
    draftCount: draft,
    totalViews,
    tagCount: tags.length,
  }
}
