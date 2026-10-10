import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSearch } from '../hooks/useSearch'
import { useTags } from '../hooks/useTags'
import { Spinner } from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import TagBadge from '../components/TagBadge'
import Highlight from '../components/Highlight'
import { formatDate } from '../utils/formatDate'

export default function SearchPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const query = searchParams.get('q') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))

  /**
   * 输入框用**非受控 + ref**，而不是受控 state 镜像 URL。
   *
   * 受控镜像需要在 useEffect 里 `setInput(query)` 把 URL 同步回本地状态，
   * 这会命中 `react-hooks/set-state-in-effect`（effect 体内同步 setState）。
   * 这里改由 `key={query}` 控制：URL 一变，输入框重挂载，`defaultValue` 自然生效，
   * 既满足「点标签后输入框跟着更新」，又不产生级联渲染。
   */
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, loading, error } = useSearch(query, page)
  const { tags: hotTags } = useTags()

  const submit = (nextQuery: string, nextPage = 1) => {
    const params: Record<string, string> = {}
    if (nextQuery.trim()) params.q = nextQuery.trim()
    if (nextPage > 1) params.page = String(nextPage)
    setSearchParams(params)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    submit(inputRef.current?.value ?? '')
  }

  const handlePageChange = (nextPage: number) => {
    submit(query, nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasQuery = query.trim().length > 0
  const noResults = hasQuery && !loading && !error && data !== null && data.results.length === 0

  /**
   * 热门标签作为搜索建议。
   *
   * 注意：这里**不能**用 <button> 包 <TagBadge>——TagBadge 内部是 <Link>（<a>），
   * button 里嵌 a 是无效 HTML，读屏软件与键盘焦点都会出问题。
   * 直接用 Link 指向本页并带 q 参数，语义正确、可右键新开标签页。
   */
  const renderTagSuggestions = (tagsToRender: typeof hotTags) => (
    <div className="flex flex-wrap gap-2">
      {tagsToRender.map((tag) => (
        <Link key={tag.id} to={`/search?q=${encodeURIComponent(tag.name)}`} className="tag-badge px-3 py-1 text-xs">
          # {tag.name}
        </Link>
      ))}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {t('search.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('search.subtitle')}
        </p>
      </div>

      {/* 搜索框 */}
      <form onSubmit={handleSubmit} className="mb-6" role="search">
        <div className="flex gap-2">
          <input
            key={query}
            ref={inputRef}
            type="search"
            defaultValue={query}
            placeholder={t('search.placeholder')}
            className="input flex-1"
            aria-label={t('search.placeholder')}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            {t('search.submit')}
          </button>
        </div>
      </form>

      {/* 结果统计（含服务端策略与耗时，便于确认降级是否生效） */}
      {hasQuery && data && !loading && (
        <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
          {t('search.resultCount', { count: data.total, query })}
          <span className="ml-2 opacity-60">
            {t('search.meta', { ms: data.took_ms })}
            {data.strategy === 'ilike' && ` · ${t('search.strategyShortQuery')}`}
          </span>
        </p>
      )}

      {loading && <Spinner />}

      {error && (
        <div className="card p-6 text-center" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* 未输入：给出热门标签作为入口，避免一片空白 */}
      {!hasQuery && (
        <div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('search.hint')}
          </p>
          {hotTags.length > 0 && renderTagSuggestions(hotTags.slice(0, 10))}
        </div>
      )}

      {/* 无结果：给出引导而不是死胡同 */}
      {noResults && (
        <div>
          <EmptyState
            title={t('search.emptyTitle', { query })}
            description={t('search.emptyDesc')}
            icon="🔍"
          />
          {hotTags.length > 0 && (
            <div className="text-center mt-2">
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                {t('search.tryThese')}
              </p>
              <div className="flex justify-center">{renderTagSuggestions(hotTags.slice(0, 8))}</div>
            </div>
          )}
        </div>
      )}

      {/* 结果列表 */}
      {hasQuery && !loading && !error && data && data.results.length > 0 && (
        <>
          <ul className="space-y-4">
            {data.results.map((result) => (
              <li key={result.id}>
                <Link to={`/posts/${result.slug}`} className="card card-hover block p-5">
                  <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>
                    <Highlight text={result.title} query={query} />
                  </h2>
                  {result.excerpt && (
                    <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      <Highlight text={result.excerpt} query={query} />
                    </p>
                  )}
                  <div
                    className="flex flex-wrap items-center gap-3 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {result.published_at && <span>{formatDate(result.published_at)}</span>}
                    {result.category && (
                      <span className="flex items-center gap-1">
                        <span aria-hidden="true">📁</span>
                        {result.category.name}
                      </span>
                    )}
                    {result.tags.slice(0, 3).map((tag) => (
                      <TagBadge key={tag.id} tag={tag} />
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={data.page} totalPages={data.totalPages} onChange={handlePageChange} />
        </>
      )}
    </div>
  )
}
