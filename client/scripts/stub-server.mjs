// 共享桩服务：给「无 PostgreSQL 的本地验收」提供确定性数据 + dist 静态资源。
//
// 被两个脚本共用：
//   - scripts/verify-runtime.mjs  （真机断言）
//   - scripts/screenshot.mjs      （落盘截图）
//
// 桩 API 只影响**数据来源**，不影响任何 CSS / 布局 / 主题逻辑 —— 换肤全部在前端。
// 图片走本站 /img/*.svg（确定性、无外网依赖），这样截图不会因为外链抖动而变化。
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

export const PORT = 4178

// ---------------------------------------------------------------- fixtures

export const CN_TITLE = '深入理解 React 虚拟列表原理'
const CODE_BLOCK = [
  '```js',
  '// 计算可视区域',
  "const LABEL = 'virtual-list'",
  'function computeRange(scrollTop, itemHeight) {',
  '  const start = Math.floor(scrollTop / itemHeight)',
  '  return { start, end: start + 10 }',
  '}',
  '```',
  '',
  '```sql',
  "SELECT id, title FROM posts WHERE slug = 'react-virtual-list' LIMIT 10;",
  '```',
].join('\n')

const POST_CONTENT = [
  '## 为什么需要虚拟列表',
  '',
  '当列表项超过 **1000** 条时，直接渲染会带来巨大的 DOM 开销。',
  '',
  '### 核心思路',
  '',
  '只渲染可视区域内的元素，其余用占位高度撑开。',
  '',
  CODE_BLOCK,
  '',
  '## 实现细节',
  '',
  '> 虚拟列表的关键是"滚动位置 → 索引区间"的映射。',
  '',
  '### 边界处理',
  '',
  '注意滚动到底部时的取整误差。',
].join('\n')

// 生活类文章：**cover_image 为 NULL**（与真实库一致），图集完全靠正文 Markdown
// 里的连续图片段落长出来（见 utils/rehypeGallery.ts）—— 不改 schema。
const LIFE_TITLE = '在山里住了七天，我把手机放下了'
const LIFE_CONTENT = [
  '## 山里的七天',
  '',
  '第二天早上我被鸟叫吵醒，不是闹钟。那种感觉很陌生——我已经很多年没有被"环境"叫醒过，一直是被"任务"叫醒。我在门口坐了很久，什么都没做，也没觉得浪费。',
  '',
  '> 原来我一直把"无聊"和"空白"搞混了。空白是可以装东西的，无聊只是没东西可装。',
  '> ',
  '> —— 第七天，下山路上的笔记',
  '',
  '这篇不想写成攻略，就想把几个瞬间留下来。下面这些是随手拍的，没什么构图，但每次翻到都会想起当时的风。',
  '',
  '![山里的早晨](/img/g1.svg)',
  '',
  '![半路的亭子](/img/g2.svg)',
  '',
  '![没信号的手机](/img/g3.svg)',
  '',
  '![一碗很烫的粥](/img/g4.svg)',
  '',
  '![回程的车窗](/img/g5.svg)',
  '',
  '## 回来之后',
  '',
  '回来第一件事是把手机上的通知清了一遍。留了电话、短信和地图，其余的都关掉了。',
].join('\n')

export const POSTS = [
  {
    id: 1,
    title: CN_TITLE,
    slug: 'react-virtual-list',
    excerpt: '只渲染可视区域内的元素，把 DOM 数量从 1000+ 降到 20 以内。',
    content: POST_CONTENT,
    cover_image: null, // 与真实库一致：4 篇全是 NULL
    status: 'published',
    view_count: 1234,
    published_at: '2026-08-12T00:00:00.000Z',
    created_at: '2026-08-12T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
    tags: [{ id: 1, name: 'React', slug: 'react' }],
    category: { id: 1, name: '前端', slug: 'frontend' },
  },
  {
    id: 2,
    title: 'Vite 构建优化笔记',
    slug: 'vite-build-notes',
    excerpt: '拆包、预构建与产物分析。',
    content: '## 背景\n\n构建时间从 30s 降到 8s。\n\n```bash\nnpm run build -- --report\n```\n',
    cover_image: null,
    status: 'published',
    view_count: 88,
    published_at: '2026-03-02T00:00:00.000Z',
    created_at: '2026-03-02T00:00:00.000Z',
    updated_at: '2026-03-02T00:00:00.000Z',
    tags: [{ id: 2, name: 'Vite', slug: 'vite' }],
    category: { id: 1, name: '前端', slug: 'frontend' },
  },
  {
    id: 3,
    title: 'PostgreSQL 全文检索实践',
    slug: 'postgres-fulltext',
    excerpt: 'pg_trgm 与中文搜索。',
    content: '## 背景\n\n中文没有词边界。\n',
    cover_image: null,
    status: 'published',
    view_count: 42,
    published_at: '2025-11-20T00:00:00.000Z',
    created_at: '2025-11-20T00:00:00.000Z',
    updated_at: '2025-11-20T00:00:00.000Z',
    tags: [{ id: 3, name: '数据库', slug: 'database' }],
    category: { id: 2, name: '后端', slug: 'backend' },
  },
  {
    id: 4,
    title: LIFE_TITLE,
    slug: 'seven-days-in-the-mountains',
    excerpt: '没有信号的第七天，我才发现原来我一直把"无聊"和"空白"搞混了。',
    content: LIFE_CONTENT,
    cover_image: null,
    status: 'published',
    view_count: 256,
    published_at: '2026-10-14T00:00:00.000Z',
    created_at: '2026-10-14T00:00:00.000Z',
    updated_at: '2026-10-14T00:00:00.000Z',
    tags: [{ id: 4, name: '生活', slug: 'life' }],
    category: { id: 3, name: '生活', slug: 'life' },
  },
]

export const CATEGORIES = [
  { id: 1, name: '前端', slug: 'frontend', description: '浏览器里的一切', sort_order: 3, post_count: 2 },
  { id: 2, name: '后端', slug: 'backend', description: '服务端与数据', sort_order: 2, post_count: 1 },
  { id: 3, name: '生活', slug: 'life', description: '技术之外的事', sort_order: 1, post_count: 1 },
]

export const TAGS = [
  { id: 1, name: 'React', slug: 'react', post_count: 1 },
  { id: 2, name: 'Vite', slug: 'vite', post_count: 1 },
  { id: 3, name: '数据库', slug: 'database', post_count: 1 },
  { id: 4, name: '生活', slug: 'life', post_count: 1 },
]

export const toArch = (p) => ({ id: p.id, title: p.title, slug: p.slug, published_at: p.published_at })

function searchResults(q, page, pageSize) {
  const needle = q.toLowerCase()
  const hit = POSTS.filter(
    (p) =>
      p.title.toLowerCase().includes(needle) ||
      (p.excerpt ?? '').toLowerCase().includes(needle) ||
      p.content.toLowerCase().includes(needle)
  ).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    published_at: p.published_at,
    score: 1,
    tags: p.tags,
    category: p.category,
  }))
  return {
    results: hit,
    total: hit.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(hit.length / pageSize)),
    took_ms: 1.23,
    strategy: Array.from(q).length >= 3 ? 'trigram' : 'ilike',
    used_english_tsvector: /[a-z]/i.test(q),
  }
}

// ---------------------------------------------------------------- 桩图片

// 暖色渐变 SVG（对齐已批准预览的 .grad-a / .grad-b 色板），
// 作为确定性图片源 —— 截图不依赖外网，也不会因外链抖动而变化。
const GRADIENTS = [
  ['#e9e2d6', '#cbbfae', '#a89a86'],
  ['#d8c9b8', '#b9a795', '#9c8b78'],
  ['#ded4c4', '#c3b49f', '#a3937e'],
  ['#e3dacb', '#c8b9a5', '#ab9a84'],
  ['#d5c7b4', '#b7a48f', '#98866f'],
  ['#e7dfD3', '#cfc2ae', '#b0a08a'],
]

function svgImage(name) {
  const index = Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % GRADIENTS.length
  const [a, b, c] = GRADIENTS[index]
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>` +
    `</linearGradient></defs>` +
    `<rect width="1200" height="800" fill="url(#g)"/>` +
    `</svg>`
  )
}

// ---------------------------------------------------------------- 服务

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
}

const DIST = path.resolve(import.meta.dirname, '../dist')

export function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
    const json = (body) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
    }

    // ---- 桩图片（确定性、同源） ----
    const imgMatch = url.pathname.match(/^\/img\/([a-z0-9-]+)\.svg$/)
    if (imgMatch) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' })
      return res.end(svgImage(imgMatch[1]))
    }

    // ---- 桩 API ----
    if (url.pathname === '/api/health') return json({ status: 'ok' })
    if (url.pathname === '/api/posts/archive') {
      return json({ posts: POSTS.map(toArch), total: POSTS.length })
    }
    if (url.pathname === '/api/posts') {
      const page = Number(url.searchParams.get('page') ?? 1)
      const pageSize = Number(url.searchParams.get('pageSize') ?? 9)
      const tag = url.searchParams.get('tag')
      const category = url.searchParams.get('category')
      let list = POSTS
      if (tag) list = list.filter((p) => p.tags.some((t) => t.slug === tag))
      if (category) list = list.filter((p) => p.category?.slug === category)
      return json({
        posts: list,
        total: list.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(list.length / pageSize)),
      })
    }
    const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/)
    if (postMatch) {
      const post = POSTS.find((p) => p.slug === decodeURIComponent(postMatch[1]))
      if (!post) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: '文章不存在' }))
      }
      return json({ post })
    }
    if (url.pathname === '/api/categories') return json({ categories: CATEGORIES })
    const catMatch = url.pathname.match(/^\/api\/categories\/([^/]+)$/)
    if (catMatch) {
      const c = CATEGORIES.find((x) => x.slug === decodeURIComponent(catMatch[1]))
      if (!c) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: '分类不存在' }))
      }
      return json({ category: c })
    }
    if (url.pathname === '/api/tags') return json({ tags: TAGS })
    const tagMatch = url.pathname.match(/^\/api\/tags\/([^/]+)$/)
    if (tagMatch) {
      const name = decodeURIComponent(tagMatch[1])
      const t = TAGS.find((x) => x.slug === name)
      if (!t) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: '标签不存在' }))
      }
      return json({ tag: t, posts: POSTS.filter((p) => p.tags.some((x) => x.slug === t.slug)) })
    }
    if (url.pathname === '/api/search') {
      const q = url.searchParams.get('q') ?? ''
      if (!q.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: '搜索关键词不能为空' }))
      }
      return json(searchResults(q, Number(url.searchParams.get('page') ?? 1), Number(url.searchParams.get('pageSize') ?? 10)))
    }
    if (url.pathname === '/api/about') {
      return json({ about: { id: 1, content: '## 关于\n\n一个写博客的人。', updated_at: '2026-01-01T00:00:00.000Z' } })
    }

    // ---- 桩认证 + 后台接口：让真实 admin 页面能渲染，从而实测其标题字重 ----
    if (url.pathname === '/api/auth/me') {
      return json({
        user: {
          id: 1,
          email: 'admin@example.com',
          name: 'Admin',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      })
    }
    if (url.pathname === '/api/admin/posts') {
      return json({ posts: POSTS, total: POSTS.length, page: 1, pageSize: 1000, totalPages: 1 })
    }
    if (url.pathname === '/api/admin/tags') return json({ tags: TAGS })
    if (url.pathname === '/api/admin/about') {
      return json({ about: { id: 1, content: '## 关于\n\n一个写博客的人。', updated_at: '2026-01-01T00:00:00.000Z' } })
    }

    // ---- dist 静态资源（SPA fallback） ----
    let filePath = path.join(DIST, url.pathname)
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403)
      return res.end()
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST, 'index.html')
    }
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)))
}
