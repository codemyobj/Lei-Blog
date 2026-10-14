import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePosts } from '../hooks/usePosts'
import PostCard from '../components/PostCard'
import Pagination from '../components/Pagination'
import { Spinner } from '../components/Spinner'
import EmptyState from '../components/EmptyState'

export default function HomePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  // 页码直接从 URL 派生，不再用 useState 镜像再在 effect 里同步——
  // 后者既是多余的一跳渲染，也会命中 react-hooks/set-state-in-effect。
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  const { data, loading, error } = usePosts(page, 9)

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: String(newPage) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      {/*
        页头：杂志 masthead —— 红色 kicker（站点名 + 右侧延伸细线）
        → 衬线 h1 → 导语。
        不加通栏 border-b：编辑风页头靠 kicker 的细线收尾，不再压一条黑线。
      */}
      <header className="mb-12 sm:mb-16">
        <p className="t-kicker mb-5">{t('nav.brand')}</p>
        <h1 className="text-3xl mb-3">{t('home.title')}</h1>
        <p className="t-lead max-w-[56ch]">{t('home.subtitle')}</p>
      </header>

      {/* 加载中 */}
      {loading && <Spinner />}

      {/* 错误 */}
      {error && (
        <div className="card p-6 text-center" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* 文章列表 */}
      {!loading && !error && data && (
        <>
          {data.posts.length === 0 ? (
            <EmptyState title={t('home.emptyTitle')} description={t('home.emptyDesc')} icon="📝" />
          ) : (
            <>
              {/*
                3 列杂志卡片网格（预览 .cards：3 列 / gap 26px）。
                ⚠️ items-start：封面图为 NULL 的卡片没有图片区，必须让
                   每张卡按自身内容取高 —— 否则会在行内被拉高，出现"空的高框"。
              */}
              <div className="grid grid-cols-1 items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {data.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={handlePageChange}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
