import { useState, useEffect, useCallback } from 'react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TocItem } from '../utils/extractToc'

/**
 * 文章目录侧栏。
 *
 * - 桌面端（lg+）：右侧 sticky 侧栏，随滚动高亮当前章节
 * - 移动端：折叠卡片，点开后列出全部章节
 *
 * 锚点说明：中文标题的 id 本身就是中文（github-slugger 保留 CJK）。
 * 这里点击只做 scrollIntoView，**不写入 location.hash**——
 * 一旦写入，浏览器 URL 序列化会把中文变成 %E4%B8%AD… 形式的百分号串。
 * 不写 hash 就从根本上杜绝了该类乱码，同时依然支持外部带 #锚点 的链接进入时自动定位。
 */
export default function TocSidebar({
  items,
  className = '',
}: {
  items: TocItem[]
  /** 追加到最外层容器的类名，供调用方控制排布（如桌面端靠右） */
  className?: string
}) {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState<string>('')
  const [mobileOpen, setMobileOpen] = useState(false)

  // --- 滚动高亮：用 IntersectionObserver 观察所有标题 ---
  useEffect(() => {
    // 无目录时不挂观察器。注意这里直接 return，**不做同步 setState**——
    // effect 体内同步改状态会触发级联渲染（react-hooks/set-state-in-effect）。
    // 且下方 items 为空时组件本就返回 null，残留的 activeId 不会渲染出来。
    if (items.length === 0) return

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)

    if (headings.length === 0) return

    const visibleIds = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id)
          } else {
            visibleIds.delete(entry.target.id)
          }
        }
        // 多个标题同时可见时，取文档顺序最靠前的那个
        const firstVisible = items.find((item) => visibleIds.has(item.id))
        setActiveId(firstVisible ? firstVisible.id : '')
      },
      {
        // 顶部让出 sticky 导航栏高度，底部收窄判定区，使「当前章节」更符合直觉
        rootMargin: '-88px 0px -60% 0px',
        threshold: 0,
      }
    )

    for (const heading of headings) observer.observe(heading)

    return () => observer.disconnect()
  }, [items])

  // --- 进入页面时若 URL 自带锚点，滚动到对应标题 ---
  useEffect(() => {
    if (items.length === 0) return
    const rawHash = window.location.hash
    if (!rawHash || rawHash === '#') return

    const targetId = decodeURIComponent(rawHash.slice(1))
    const target = document.getElementById(targetId)
    if (!target) return

    // 等一帧，确保 Markdown 已渲染出标题节点
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)

    return () => window.clearTimeout(timer)
  }, [items])

  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return // id 不存在时放行默认行为，不做无意义拦截

    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
    setMobileOpen(false)
  }, [])

  if (items.length === 0) return null

  const renderList = (variant: 'desktop' | 'mobile') => (
    <ul className={variant === 'desktop' ? 'space-y-1' : 'space-y-1'}>
      {items.map((item) => {
        const active = item.id === activeId
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(event) => handleClick(event, item.id)}
              className="block text-sm transition-colors"
              style={{
                paddingLeft: item.level === 3 ? '1rem' : '0.5rem',
                paddingRight: '0.5rem',
                paddingTop: '0.375rem',
                paddingBottom: '0.375rem',
                /* 激活态用 --text + 2px 左线，不再用品牌色（单强调色纪律） */
                color: active ? 'var(--text)' : 'var(--text-muted)',
                background: 'transparent',
                fontWeight: active ? 600 : 400,
                borderLeft: active ? '2px solid var(--text)' : '2px solid transparent',
              }}
              aria-current={active ? 'true' : undefined}
            >
              {item.text}
            </a>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className={`lg:w-56 lg:shrink-0 ${className}`}>
      {/* 桌面端：右侧 sticky 侧栏 */}
      <div className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
          <p className="t-eyebrow mb-3">
            {t('toc.title')}
          </p>
          {renderList('desktop')}
        </div>
      </div>

      {/* 移动端：折叠卡片 */}
      <div className="lg:hidden card p-4">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between text-sm font-bold"
          style={{ color: 'var(--text)' }}
          aria-expanded={mobileOpen}
        >
          <span>{t('toc.title')}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: mobileOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {mobileOpen && <div className="mt-3">{renderList('mobile')}</div>}
      </div>
    </div>
  )
}
