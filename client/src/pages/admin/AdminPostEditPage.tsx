import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { adminGetPost, adminCreatePost, adminUpdatePost, adminGetTags } from '../../hooks/useAdmin'
import type { Tag, CreatePostData } from '../../types'
import MarkdownEditor from '../../components/MarkdownEditor'
import { Spinner } from '../../components/Spinner'

export default function AdminPostEditPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])

  // 加载标签列表
  useEffect(() => {
    adminGetTags().then(setAllTags).catch(() => {})
  }, [])

  // 编辑模式：加载文章数据
  useEffect(() => {
    if (!isEdit) return
    adminGetPost(parseInt(id!))
      .then((post) => {
        setTitle(post.title)
        setSlug(post.slug)
        setExcerpt(post.excerpt || '')
        setContent(post.content || '')
        setCoverImage(post.cover_image || '')
        setStatus(post.status)
        setSelectedTagIds(post.tag_ids || [])
      })
      .catch((err) => setError(err.response?.data?.error || t('about.loadFailed')))
      .finally(() => setLoading(false))
  }, [id, isEdit, t])

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((tag) => tag !== tagId) : [...prev, tagId]
    )
  }

  const handleSave = async (saveStatus?: 'draft' | 'published') => {
    if (!title.trim() || !content.trim()) {
      setError(t('post.errorRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const data: CreatePostData = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt: excerpt.trim() || undefined,
        content,
        cover_image: coverImage.trim() || undefined,
        status: saveStatus || status,
        tag_ids: selectedTagIds,
      }
      if (isEdit) {
        await adminUpdatePost(parseInt(id!), data)
      } else {
        await adminCreatePost(data)
      }
      navigate('/admin/posts')
    } catch (err: any) {
      setError(err.response?.data?.error || t('error.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link to="/admin/posts" className="btn btn-ghost text-sm">
            {t('admin.backToList')}
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {isEdit ? t('admin.editPost') : t('admin.newPost')}
          </h1>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 主编辑区 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('post.titlePlaceholder')}
            className="input mb-4 text-lg font-bold"
          />

          {/* Slug */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('post.slugLabel')}
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-first-post"
              className="input text-sm"
            />
          </div>

          {/* 摘要 */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('post.excerptLabel')}
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder={t('post.excerptPlaceholder')}
              className="input text-sm resize-none"
              rows={2}
            />
          </div>

          {/* 封面图 */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('post.coverLabel')}
            </label>
            <input
              type="text"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
              className="input text-sm"
            />
          </div>

          {/* 正文 Markdown 编辑器 */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('post.contentLabel')}
            </label>
            <MarkdownEditor value={content} onChange={setContent} height={500} />
          </div>
        </div>

        {/* 侧边栏：发布设置 */}
        <aside className="lg:w-72 shrink-0">
          <div className="card p-5 sticky top-4">
            {/* 状态 */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                {t('admin.status')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatus('draft')}
                  className="btn text-xs flex-1"
                  style={{
                    background: status === 'draft' ? 'var(--warning)' : 'var(--surface)',
                    color: status === 'draft' ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {t('admin.draft')}
                </button>
                <button
                  onClick={() => setStatus('published')}
                  className="btn text-xs flex-1"
                  style={{
                    background: status === 'published' ? 'var(--success)' : 'var(--surface)',
                    color: status === 'published' ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {t('admin.published')}
                </button>
              </div>
            </div>

            {/* 标签 */}
            <div className="mb-6">
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                {t('admin.tagLabel')}
              </label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {allTags.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('admin.noTagsHint')}</p>
                ) : (
                  allTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                      style={{
                        background: selectedTagIds.includes(tag.id) ? 'var(--brand)' : 'var(--surface-hover)',
                        color: selectedTagIds.includes(tag.id) ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      # {tag.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSave('published')}
                disabled={saving}
                className="btn btn-primary w-full"
              >
                {saving ? t('common.saving') : (isEdit ? t('post.updatePublish') : t('post.publish'))}
              </button>
              <button
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="btn btn-outline w-full"
              >
                {t('post.saveDraft')}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
