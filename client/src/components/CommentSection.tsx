import Giscus from '@giscus/react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../context/ThemeContext'

/**
 * Giscus 配置。
 *
 * 四个值都来自构建期环境变量（`client/.env`），**不硬编码**——
 * 仓库信息属于部署方私有的配置，写进源码会让 fork 出去的副本串到别人的 Discussion。
 * Vite 在 build 期内联 `VITE_` 前缀变量，因此**改动后必须重新构建**才生效。
 */
const GISCUS_CONFIG = {
  repo: import.meta.env.VITE_GISCUS_REPO as string | undefined,
  repoId: import.meta.env.VITE_GISCUS_REPO_ID as string | undefined,
  category: import.meta.env.VITE_GISCUS_CATEGORY as string | undefined,
  categoryId: import.meta.env.VITE_GISCUS_CATEGORY_ID as string | undefined,
}

/** 四个值缺任何一个都无法挂载，统一在这里判定 */
function isGiscusConfigured(): boolean {
  return Boolean(
    GISCUS_CONFIG.repo &&
      GISCUS_CONFIG.repoId &&
      GISCUS_CONFIG.category &&
      GISCUS_CONFIG.categoryId
  )
}

/** 未配置时的引导卡片：解释如何开启，而不是留下一片空白或报错 */
function SetupHint() {
  const { t } = useTranslation()
  return (
    <div
      className="border border-dashed p-6 text-center"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {/* 圆角已归零；此处保留 text-2xl（原 text-3xl 在改后字号刻度下会从 30px 涨到 36px） */}
      <div className="text-2xl mb-3" aria-hidden="true">
        💬
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
        {t('comment.notConfigured')}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {t('comment.setupHint')}
      </p>
      <a
        href="https://giscus.app/zh-CN"
        target="_blank"
        rel="noreferrer noopener"
        className="inline-block mt-3 text-xs underline"
        style={{ color: 'var(--brand)' }}
      >
        {t('comment.setupLink')}
      </a>
    </div>
  )
}

/**
 * 文章评论区（基于 GitHub Discussions）。
 *
 * 关键设计：**未配置时必须优雅降级**。
 * 本组件在缺配置时直接返回引导卡片，不渲染任何 `<iframe>`、不访问 giscus.app、
 * 不产生控制台报错——否则用户看到的会是一块破图或直接白屏。
 */
export default function CommentSection() {
  const { resolvedTheme } = useTheme()

  if (!isGiscusConfigured()) {
    return <SetupHint />
  }

  return (
    <Giscus
      repo={GISCUS_CONFIG.repo as `${string}/${string}`}
      repoId={GISCUS_CONFIG.repoId as string}
      category={GISCUS_CONFIG.category as string}
      categoryId={GISCUS_CONFIG.categoryId as string}
      mapping="pathname"
      strict="0"
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="top"
      // 跟随站点主题，避免暗色页面里嵌一块白底评论区
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      lang="zh-CN"
      loading="lazy"
    />
  )
}
