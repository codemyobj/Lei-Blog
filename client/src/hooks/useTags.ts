import { useState, useEffect } from 'react'
import apiClient from '../api'
import i18n from '../i18n'
import type { Tag, Post } from '../types'

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    apiClient
      .get('/tags')
      .then((res) => setTags(res.data.tags))
    .catch((err) => setError(err.response?.data?.error || i18n.t('error.loadTags')))
    .finally(() => setLoading(false))
  }, [])

  return { tags, loading, error }
}

export function useTag(slug: string | undefined) {
  const [tag, setTag] = useState<Tag | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
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
      .get(`/tags/${slug}`)
      .then((res) => {
        setTag(res.data.tag)
        setPosts(res.data.posts)
      })
    .catch((err) => setError(err.response?.data?.error || i18n.t('error.loadTags')))
    .finally(() => setLoading(false))
  }, [slug])

  return { tag, posts, loading, error }
}
