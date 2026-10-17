import { useTranslation } from 'react-i18next'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  // 生成页码数组：首页 + 末页 + 当前页 ±2 + 省略号
  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = []
    const delta = 2
    const left = Math.max(2, page - delta)
    const right = Math.min(totalPages - 1, page + delta)

    pages.push(1)
    if (left > 2) pages.push('...')
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalPages - 1) pages.push('...')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  const pages = getPageNumbers()

  return (
    <nav className="flex items-center justify-center gap-2 mt-12 flex-wrap">
      {/* 上一页 */}
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="btn btn-outline text-xs px-3 py-2"
        aria-label={t('pagination.prev')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* 页码（桌面端显示全部，移动端简化） */}
      <div className="hidden sm:flex items-center gap-1">
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2" style={{ color: 'var(--text-muted)' }}>...</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className="w-10 h-10 text-sm font-semibold transition-colors"
              style={{
                background: p === page ? 'var(--brand)' : 'transparent',
                /* --brand-fg 亮暗两套 token 均已按 ≥4.5:1 校验（见 scripts/verify-contrast.mjs） */
                color: p === page ? 'var(--brand-fg)' : 'var(--text-secondary)',
              }}
            >
              {p}
            </button>
          )
        )}
      </div>

      {/* 移动端：第 N / M 页 */}
      <span className="sm:hidden text-sm font-semibold px-3" style={{ color: 'var(--text-secondary)' }}>
        {t('pagination.pageOf', { page, totalPages })}
      </span>

      {/* 下一页 */}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="btn btn-outline text-xs px-3 py-2"
        aria-label={t('pagination.next')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </nav>
  )
}
