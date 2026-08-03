import { useState, useEffect, useCallback } from 'react'
import apiClient from '../api'
import i18n from '../i18n'
import type { Post, PaginatedPosts } from '../types'

export function usePosts(page = 1, pageSize = 9, tag?: string) {
  const [data, setData] = useState<PaginatedPosts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, any> = { page, pageSize }
      if (tag) params.tag = tag
      const res = await apiClient.get('/posts', { params })
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || i18n.t('error.loadPosts'))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, tag])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export function usePost(slug: string | undefined) {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    apiClient
      .get(`/posts/${slug}`)
      .then((res) => setPost(res.data.post))
    .catch((err) => setError(err.response?.data?.error || i18n.t('error.loadPosts')))
    .finally(() => setLoading(false))
  }, [slug])

  return { post, loading, error }
}
