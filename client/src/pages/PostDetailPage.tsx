import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePost } from '../hooks/usePosts'
import { Spinner } from '../components/Spinner'
import MarkdownRenderer from '../components/MarkdownRenderer'
import TagBadge from '../components/TagBadge'
import TocSidebar from '../components/TocSidebar'
import CommentSection from '../components/CommentSection'
import { formatDate } from '../utils/formatDate'
import { estimateReadingTime } from '../utils/readingTime'
import { extractToc } from '../utils/extractToc'

export default function PostDetailPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { post, loading, error } = usePost(slug)

  if (loading) return <Spinner />

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-2xl mb-2">
          {error || t('post.notFound')}
        </h1>
        <Link to="/" className="btn btn-primary mt-4">{t('post.backHome')}</Link>
      </div>
    )
  }

  const readingTime = estimateReadingTime(post.content || '')
  // 目录从 Markdown 源文本抽取，与 MarkdownRenderer 里的 rehype-slug 共用
  // 同一个 github-slugger 算法，保证 href 与正文 id 一致（见 utils/extractToc.ts）
  const tocItems = extractToc(post.content || '')

  return (
    <div className="max-w-5xl mx-auto">
      {/*
        排布说明：DOM 顺序是 [目录][正文]，配合 lg:order-last 实现——
        - 移动端（flex-col，order 类不生效）：目录折叠卡片在正文**之前**，符合阅读顺序
        - 桌面端（flex-row，目录被推到 last）：正文在左、目录在右
        用 DOM 顺序而非重复渲染，避免挂两份 IntersectionObserver。
      */}
      <div className="flex flex-col lg:flex-row gap-10">
        <TocSidebar items={tocItems} className="lg:order-last" />

        <article className="flex-1 min-w-0 max-w-3xl">
          {/* 返回链接 */}
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm mb-6 hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('post.backHome')}
          </Link>

          {/*
            文章头部：Swiss 的 kicker/eyebrow 模式 —— 元信息行**移到标题上方**，
            这是本次唯一一处结构性 JSX 调序。header 加下沿强调线。
          */}
          <header className="mb-8 pb-8 border-b" style={{ borderColor: 'var(--rule)' }}>
            {/* 眉标行：日期 · 阅读时长 · 阅读量 · 分类 */}
            <div className="t-eyebrow flex flex-wrap items-center gap-4 mb-4">
              {post.published_at && (
                <span className="flex items-center gap-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {formatDate(post.published_at)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {t('post.minutesRead', { count: readingTime })}
              </span>
              <span className="flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {t('post.viewsCount', { count: post.view_count })}
              </span>
              {post.category && (
                <Link
                  to={`/categories/${post.category.slug}`}
                  className="flex items-center gap-1 hover:opacity-70"
                >
                  <span aria-hidden="true">📁</span>
                  {post.category.name}
                </Link>
              )}
            </div>

            {/* 大字号标题（字重由非分层 CSS 决定：h1 = 700） */}
            <h1 className="text-3xl sm:text-4xl mb-4">
              {post.title}
            </h1>

            {/* 标签 */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </header>

          {/* 封面图（无边距圆角） */}
          {post.cover_image && (
            <div className="mb-8 overflow-hidden">
              <img src={post.cover_image} alt={post.title} className="w-full max-h-96 object-cover" />
            </div>
          )}

          {/* 文章内容 */}
          <MarkdownRenderer content={post.content || ''} />

          {/* 底部分隔（强调线） */}
          <hr className="my-8 border-0 border-t" style={{ borderColor: 'var(--rule)' }} />

          <div className="flex items-center justify-between">
            <Link to="/" className="btn btn-outline">
              {t('post.backToList')}
            </Link>
          </div>

          {/* 评论区：外围加瑞士式框架（Giscus 是跨域 iframe，外部 CSS 无法穿透，
              因此只做「上边线 + eyebrow 标题」的外围处理） */}
          <section className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--rule)' }} aria-label={t('comment.title')}>
            <h2 className="t-eyebrow mb-4">
              {t('comment.title')}
            </h2>
            <CommentSection />
          </section>
        </article>
      </div>
    </div>
  )
}
