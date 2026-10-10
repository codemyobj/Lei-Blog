import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { adminGetAbout, adminUpdateAbout } from '../../hooks/useAdmin'
import { extractErrorMessage } from '../../hooks/useAsyncResource'
import MarkdownEditor from '../../components/MarkdownEditor'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import { Spinner } from '../../components/Spinner'
import { formatDate } from '../../utils/formatDate'

export default function AdminAboutEditPage() {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    adminGetAbout()
      .then((about) => {
        setContent(about.content)
        setUpdatedAt(about.updated_at)
      })
      .catch((err) => setError(err.response?.data?.error || t('about.loadFailed')))
      .finally(() => setLoading(false))
  }, [t])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const about = await adminUpdateAbout(content)
      setUpdatedAt(about.updated_at)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t('error.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('admin.aboutEdit')}</h1>
          {updatedAt && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('about.lastUpdated', { date: formatDate(updatedAt) })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreview(!preview)}
            className="btn btn-outline text-xs"
          >
            {preview ? t('editor.edit') : t('editor.preview')}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
          {t('admin.saveSuccess')}
        </div>
      )}

      {preview ? (
        <div className="max-w-3xl">
          <MarkdownRenderer content={content} />
        </div>
      ) : (
        <MarkdownEditor value={content} onChange={setContent} height={600} />
      )}
    </div>
  )
}
