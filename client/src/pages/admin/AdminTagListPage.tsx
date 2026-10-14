import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminCreateTag, adminUpdateTag, adminDeleteTag } from '../../hooks/useAdmin'
import { extractErrorMessage, useAsyncResource } from '../../hooks/useAsyncResource'
import type { Tag } from '../../types'
import { Spinner } from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'

export default function AdminTagListPage() {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 标签列表拉取交给 useAsyncResource：loading 由「请求键」派生，
  // 避免在 effect 体内同步 setLoading(true) 触发级联渲染
  // （react-hooks/set-state-in-effect）。
  const { data, loading, reload } = useAsyncResource<{ tags: Tag[] }>(
    'admin-tags',
    '/admin/tags'
  )
  const tags = data?.tags ?? []

  const openCreate = () => {
    setEditingTag(null)
    setName('')
    setSlug('')
    setError('')
    setShowForm(true)
  }

  const openEdit = (tag: Tag) => {
    setEditingTag(tag)
    setName(tag.name)
    setSlug(tag.slug)
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('tag.errorRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingTag) {
        await adminUpdateTag(editingTag.id, { name: name.trim(), slug: slug.trim() || undefined })
      } else {
        await adminCreateTag({ name: name.trim(), slug: slug.trim() || undefined })
      }
      setShowForm(false)
      reload()
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t('error.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('error.deleteTagConfirm'))) return
    try {
      await adminDeleteTag(id)
      reload()
    } catch (err: unknown) {
      alert(extractErrorMessage(err, t('error.deleteFailed')))
    }
  }

  return (
    <div>
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl" style={{ color: 'var(--text)' }}>{t('admin.tags')}</h1>
        <button onClick={openCreate} className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('admin.newTag')}
        </button>
      </div>

      {/* 表单弹层 */}
      {showForm && (
        <div className="card p-5 mb-6">
          <h2 className="mb-4" style={{ color: 'var(--text)' }}>
            {editingTag ? t('admin.editTag') : t('admin.newTag')}
          </h2>
          {error && (
            <div className="mb-3 p-3 text-sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('tag.namePlaceholder')}
              className="input flex-1"
              autoFocus
            />
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('common.slugPlaceholder')}
              className="input flex-1 text-sm"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button onClick={() => setShowForm(false)} className="btn btn-outline">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* 标签列表 */}
      {loading ? (
        <Spinner />
      ) : tags.length === 0 ? (
        <EmptyState title={t('admin.emptyTagsTitle')} description={t('admin.emptyTagsDesc')} icon="🏷️" />
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <div key={tag.id} className="card px-4 py-3 flex items-center gap-3">
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>#{tag.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  /{tag.slug} · {t('tags.postCount', { count: tag.post_count || 0 })}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(tag)} className="btn btn-ghost text-xs px-2 py-1">
                  {t('admin.edit')}
                </button>
                <button onClick={() => handleDelete(tag.id)} className="btn btn-ghost text-xs px-2 py-1" style={{ color: 'var(--danger)' }}>
                  {t('admin.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
