// 运行时机械验收（文档 §12 #8 #9 #10 #11 中需要"真机"的部分）
//
// 用法：node scripts/verify-runtime.mjs
//
// 为什么需要这个脚本：
//   §12 里有 4 条标准（双主题、三态防闪白、无横向滚动、功能无损）无法靠 grep/静态检查证明，
//   必须在真实浏览器里跑。但本地没有 PostgreSQL，所以这里起一个**桩 API**（返回固定 fixture）
//   与 dist 静态目录同源提供，再用 Chrome DevTools Protocol 驱动真实 Chrome 逐项断言。
//   桩 API 只影响数据来源，不影响任何 CSS / 布局 / 主题逻辑 —— 本次改造全部在前端。
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = 4178
const CDP_PORT = 9333

// ------------------------------------------------------------------ fixtures

const CN_TITLE = '深入理解 React 虚拟列表原理'
const CODE_BLOCK = [
  '```js',
  '// 计算可视区域',
  "const LABEL = 'virtual-list'",
  'function computeRange(scrollTop, itemHeight) {',
  "  const start = Math.floor(scrollTop / itemHeight)",
  "  return { start, end: start + 10 }",
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

const POSTS = [
  {
    id: 1,
    title: CN_TITLE,
    slug: 'react-virtual-list',
    excerpt: '只渲染可视区域内的元素，把 DOM 数量从 1000+ 降到 20 以内。',
    content: POST_CONTENT,
    cover_image: null,
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
]

const CATEGORIES = [
  { id: 1, name: '前端', slug: 'frontend', description: '浏览器里的一切', sort_order: 2, post_count: 2 },
  { id: 2, name: '后端', slug: 'backend', description: '服务端与数据', sort_order: 1, post_count: 1 },
]

const TAGS = [
  { id: 1, name: 'React', slug: 'react', post_count: 1 },
  { id: 2, name: 'Vite', slug: 'vite', post_count: 1 },
  { id: 3, name: '数据库', slug: 'database', post_count: 1 },
]

const toArch = (p) => ({ id: p.id, title: p.title, slug: p.slug, published_at: p.published_at })

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

// ------------------------------------------------------------------ 桩服务

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
    const json = (body) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
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

// ------------------------------------------------------------------ CDP 客户端

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, [])
    this.listeners.get(method).push(fn)
  }

  /** 等待某个 CDP 事件一次 */
  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`等待事件超时：${method}`)), timeoutMs)
      const fn = (params) => {
        clearTimeout(timer)
        const arr = this.listeners.get(method)
        arr.splice(arr.indexOf(fn), 1)
        resolve(params)
      }
      this.on(method, fn)
    })
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails) {
      throw new Error(`页面内异常：${res.exceptionDetails.exception?.description ?? '未知'}`)
    }
    return res.result.value
  }
}

function fetchJson(url, method = 'GET') {
  return fetch(url, { method }).then((r) => r.json())
}

async function launchChrome() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ]
  const bin = candidates.find((p) => fs.existsSync(p))
  if (!bin) throw new Error('未找到 Chrome / Edge 可执行文件')

  // profile 目录放系统临时目录：既不污染仓库，也避免在仓库内做递归删除
  const userDataDir = path.join(os.tmpdir(), `lei-blog-verify-${process.pid}-${Date.now()}`)

  const child = spawn(
    bin,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  // 等待 CDP 就绪
  for (let i = 0; i < 60; i++) {
    try {
      await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`)
      return { child, userDataDir }
    } catch {
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  throw new Error('Chrome CDP 端口未就绪')
}

async function connectPage() {
  for (let i = 0; i < 40; i++) {
    const list = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`)
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      await once(ws, 'open')
      return new Cdp(ws)
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('未找到可用的页面 target')
}

// ------------------------------------------------------------------ 断言框架

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  → ${detail}` : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- WCAG 2.1 相对亮度 / 对比度（用于"代码 token 对底色 ≥4.5:1"的真实测量）---
function parseHex(h) {
  let s = String(h ?? '').trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((ch) => ch + ch).join('')
  if (!/^[0-9a-f]{6}$/i.test(s)) return null
  const n = parseInt(s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function relLum([r, g, b]) {
  const f = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(a, b) {
  const L1 = relLum(a)
  const L2 = relLum(b)
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1]
  return (hi + 0.05) / (lo + 0.05)
}
/** 解析 getComputedStyle 返回的 rgb()/rgba() 颜色 */
function parseRgb(s) {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(String(s ?? ''))
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/**
 * 在每个新文档里、**页面自身脚本之前**注入探针。
 *
 * 这是「防闪白」能否被真机证明的关键：
 *  - `__frames` 记录**前若干帧**的 <html class> 与 body 背景色。
 *    第一帧就代表首屏像素；若暗色模式下存在任何一帧是白底，就是闪白。
 *  - 探针在 document-start 就注册 rAF，早于页面里任何脚本，
 *    因此不会漏掉"早期帧"。
 */
const PROBE_SOURCE = `
  window.__frames = [];
  window.__atDCL = null;
  (function () {
    var n = 0;
    function rec() {
      try {
        window.__frames.push({
          cls: document.documentElement ? document.documentElement.className : null,
          bg: document.body ? getComputedStyle(document.body).backgroundColor : null,
        });
      } catch (e) {
        window.__frames.push({ cls: null, bg: null, err: String(e) });
      }
      if (++n < 30) requestAnimationFrame(rec);
    }
    requestAnimationFrame(rec);
  })();
  document.addEventListener('DOMContentLoaded', function () {
    window.__atDCL = {
      cls: document.documentElement.className,
      bg: getComputedStyle(document.body).backgroundColor,
      colorScheme: document.documentElement.style.colorScheme,
    };
  }, { once: true });
`

/**
 * 导航到指定路径并等待 readyState === 'complete'（不依赖 CDP 事件时序）。
 *
 * 注意：不能拿 `location.href.startsWith(target)` 比较——中文查询串会被浏览器
 * 编码成 %E8%99%9A…，与原始 target 不相等，会误判为"导航超时"。
 * 这里改为比较 pathname + 解码后的 search。
 *
 * @param waitMs 就绪后再额外等待的毫秒数（如搜索页有 250ms 防抖）
 */
async function navigate(cdp, urlPath, waitMs = 0) {
  const target = `http://127.0.0.1:${PORT}${urlPath}`
  const want = new URL(target)
  const wantSearch = decodeURIComponent(want.search)
  await cdp.send('Page.navigate', { url: target })
  for (let i = 0; i < 120; i++) {
    await sleep(100)
    try {
      const state = await cdp.evaluate(
        `JSON.stringify({ path: location.pathname, search: location.search, rs: document.readyState })`
      )
      const { path, search, rs } = JSON.parse(state)
      if (rs === 'complete' && path === want.pathname && decodeURIComponent(search) === wantSearch) {
        if (waitMs > 0) await sleep(waitMs)
        return
      }
    } catch {
      // 导航中页面上下文被销毁，属预期
    }
  }
  throw new Error(`导航超时：${urlPath}`)
}

/** 确定性地把界面语言切到指定值（headless Chrome 默认 navigator.language 为 en） */
async function setLang(cdp, lang) {
  await navigate(cdp, '/')
  await cdp.evaluate(`localStorage.setItem('blog_lang', ${JSON.stringify(lang)})`)
  await navigate(cdp, '/')
}

/**
 * 设置 localStorage 主题后重新导航，返回页面内探针记录的结果。
 * @param theme  'light' | 'dark' | 'system' | null(清除) | 任意脏值
 * @param colorScheme  需要模拟的系统配色 'light' | 'dark' | null
 */
async function themeProbe(cdp, theme, colorScheme) {
  if (colorScheme) {
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: colorScheme }],
    })
  } else {
    await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  }

  // 先到同源页面写入 localStorage，再导航目标页（localStorage 同源共享）
  await navigate(cdp, '/')
  await cdp.evaluate(
    theme === null
      ? `localStorage.removeItem('theme')`
      : `localStorage.setItem('theme', ${JSON.stringify(theme)})`
  )

  await navigate(cdp, '/')
  await sleep(250)
  return cdp.evaluate(`(() => ({
    atDCL: window.__atDCL,
    frames: window.__frames,
    darkFrames: window.__frames.filter(f => f.cls && f.cls.includes('dark')).length,
    whiteFrames: window.__frames.filter(f => f.bg === 'rgb(255, 255, 255)').length,
    blackFrames: window.__frames.filter(f => f.bg === 'rgb(11, 11, 11)').length,
    totalFrames: window.__frames.length,
  }))()`)
}

// ------------------------------------------------------------------ 主流程

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/ 不存在，请先 npm run build')
  }

  const server = await startServer()
  const { child, userDataDir } = await launchChrome()
  const cdp = await connectPage()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  // 关键：在任何导航之前注册「文档开始」探针（记录首屏帧与 DCL 快照）
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE_SOURCE })

  console.log('='.repeat(78))
  console.log('运行时验收（真实 Chrome + 桩 API，端口 ' + PORT + '）')
  console.log('='.repeat(78))

  try {
    // ---------- §12 #9 三态 + 防闪白 ----------
    console.log('\n--- §12 #9 主题三态与防闪白（断言 DCL 时刻 + 首屏每一帧）---')

    const dark = await themeProbe(cdp, 'dark')
    check(
      'theme=dark：DOMContentLoaded 时 <html> 已带 dark class',
      (dark.atDCL?.cls ?? '').includes('dark'),
      `class="${dark.atDCL?.cls}"`
    )
    check(
      'theme=dark：DCL 时 body 背景即为暗色 #0b0b0b',
      dark.atDCL?.bg === 'rgb(11, 11, 11)',
      dark.atDCL?.bg
    )
    check(
      'theme=dark：color-scheme 同步为 dark（原生控件不闪白）',
      dark.atDCL?.colorScheme === 'dark',
      dark.atDCL?.colorScheme
    )
    check(
      `theme=dark：首屏 ${dark.totalFrames} 帧中**没有一帧**白底（真正的防闪白断言）`,
      dark.whiteFrames === 0 && dark.darkFrames === dark.totalFrames && dark.totalFrames >= 5,
      `暗帧=${dark.darkFrames}/${dark.totalFrames} 白帧=${dark.whiteFrames}`
    )

    const light = await themeProbe(cdp, 'light', 'dark')
    check(
      'theme=light 且系统为暗：DCL 时仍为亮色（用户显式选择优先）',
      !(light.atDCL?.cls ?? '').includes('dark') && light.atDCL?.bg === 'rgb(255, 255, 255)',
      `class="${light.atDCL?.cls}" bg=${light.atDCL?.bg}`
    )
    check(
      'theme=light：首屏无暗帧（防反向闪烁）',
      light.blackFrames === 0 && light.totalFrames >= 5,
      `暗帧=${light.blackFrames}/${light.totalFrames}`
    )

    const sysDark = await themeProbe(cdp, 'system', 'dark')
    check(
      'theme=system 且系统为暗：首帧即为暗色（探针 DCL 校验）',
      (sysDark.atDCL?.cls ?? '').includes('dark') && sysDark.atDCL?.bg === 'rgb(11, 11, 11)',
      `class="${sysDark.atDCL?.cls}" bg=${sysDark.atDCL?.bg}`
    )
    check(
      'theme=system（系统暗）：首屏无白帧',
      sysDark.whiteFrames === 0 && sysDark.darkFrames === sysDark.totalFrames && sysDark.totalFrames >= 5,
      `暗帧=${sysDark.darkFrames}/${sysDark.totalFrames} 白帧=${sysDark.whiteFrames}`
    )

    const sysLight = await themeProbe(cdp, 'system', 'light')
    check(
      'theme=system 且系统为亮：首帧即为亮色',
      !(sysLight.atDCL?.cls ?? '').includes('dark') && sysLight.atDCL?.bg === 'rgb(255, 255, 255)',
      `class="${sysLight.atDCL?.cls}" bg=${sysLight.atDCL?.bg}`
    )

    const dirty = await themeProbe(cdp, 'darkk', 'light')
    check(
      "脏数据 theme='darkk' 回落到 system（跟随系统亮色），首帧亮色",
      !(dirty.atDCL?.cls ?? '').includes('dark') && dirty.atDCL?.bg === 'rgb(255, 255, 255)',
      `class="${dirty.atDCL?.cls}" bg=${dirty.atDCL?.bg}`
    )
    check(
      "脏数据 theme='darkk'：首屏无暗帧（未被脏值误判为暗）",
      dirty.blackFrames === 0 && dirty.totalFrames >= 5,
      `暗帧=${dirty.blackFrames}/${dirty.totalFrames}`
    )

    // system 模式下系统切换要实时跟随
    await themeProbe(cdp, 'system', 'light')
    const beforeSwitch = await cdp.evaluate(`document.documentElement.classList.contains('dark')`)
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'dark' }],
    })
    await sleep(350)
    const afterSwitch = await cdp.evaluate(
      `document.documentElement.classList.contains('dark')`
    )
    check(
      'system 模式下系统配色切换实时跟随（亮→暗，无需刷新）',
      beforeSwitch === false && afterSwitch === true,
      `${beforeSwitch} → ${afterSwitch}`
    )

    // ---------- §12 #8 双主题：计算色确实不同 ----------
    console.log('\n--- §12 #8 双主题实测：同一元素的 computed color 在两主题下不同 ---')

    // 固定中文界面，后续中文文案断言才稳定（headless 默认 navigator.language=en）
    await setLang(cdp, 'zh')

    // 注意：hljs 只在文章详情页存在，首页只有文章卡片，必须在文章页测量
    await themeProbe(cdp, 'dark')
    await navigate(cdp, '/posts/react-virtual-list')
    const darkColors = await cdp.evaluate(`(() => {
      const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
      const md = document.querySelector('.markdown-body')
      const kw = document.querySelector('.hljs-keyword')
      const str = document.querySelector('.hljs-string')
      const cmt = document.querySelector('.hljs-comment')
      return {
        bg: token('--bg'), text: token('--text'), brand: token('--brand'),
        brandFg: token('--brand-fg'), codeBg: token('--code-bg'),
        hlFg: token('--hl-fg'), hlRed: token('--hl-red'), hlBlue: token('--hl-blue'),
        hlMuted: token('--hl-muted'),
        bodyBg: getComputedStyle(document.body).backgroundColor,
        mdColor: md ? getComputedStyle(md).color : null,
        kw: kw ? getComputedStyle(kw).color : null,
        str: str ? getComputedStyle(str).color : null,
        cmt: cmt ? getComputedStyle(cmt).color : null,
        logo: (() => {
          const rect = document.querySelector('header svg rect, a svg rect')
          const path = rect ? rect.parentElement.querySelector('path[stroke]') : null
          return { stroke: path ? getComputedStyle(path).stroke : null, fill: rect ? getComputedStyle(rect).fill : null }
        })(),
      }
    })()`)

    check(
      '暗色下 hljs keyword / string / comment 三者 computed color 互不相同（token 可分辨）',
      darkColors.kw && darkColors.str && darkColors.cmt &&
        new Set([darkColors.kw, darkColors.str, darkColors.cmt]).size === 3,
      `kw=${darkColors.kw} str=${darkColors.str} cmt=${darkColors.cmt}`
    )

    await themeProbe(cdp, 'light')
    await navigate(cdp, '/posts/react-virtual-list')
    const lightColors = await cdp.evaluate(`(() => {
      const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
      const kw = document.querySelector('.hljs-keyword')
      const str = document.querySelector('.hljs-string')
      const cmt = document.querySelector('.hljs-comment')
      return {
        codeBg: token('--code-bg'),
        hlFg: token('--hl-fg'), hlRed: token('--hl-red'), hlBlue: token('--hl-blue'), hlMuted: token('--hl-muted'),
        bodyBg: getComputedStyle(document.body).backgroundColor,
        kw: kw ? getComputedStyle(kw).color : null,
        str: str ? getComputedStyle(str).color : null,
        cmt: cmt ? getComputedStyle(cmt).color : null,
        logo: (() => {
          const rect = document.querySelector('header svg rect, a svg rect')
          const path = rect ? rect.parentElement.querySelector('path[stroke]') : null
          return { stroke: path ? getComputedStyle(path).stroke : null, fill: rect ? getComputedStyle(rect).fill : null }
        })(),
      }
    })()`)

    check(
      '亮色下 hljs token 同样三者不同色',
      new Set([lightColors.kw, lightColors.str, lightColors.cmt]).size === 3,
      `kw=${lightColors.kw} str=${lightColors.str} cmt=${lightColors.cmt}`
    )
    check(
      '同一 token（keyword）在亮 / 暗下 computed color 不同',
      darkColors.kw !== lightColors.kw,
      `${lightColors.kw} vs ${darkColors.kw}`
    )
    check(
      '代码 token 与代码块底色不同（有真实对比，非同色）',
      darkColors.hlRed !== darkColors.codeBg && lightColors.kw !== lightColors.codeBg,
      `暗 hlRed=${darkColors.hlRed} on codeBg=${darkColors.codeBg}`
    )

    // 实时测量：4 个 --hl-* token 对 --code-bg 的最低对比度（WCAG 正文阈值 4.5:1）
    for (const [name, c] of [
      ['暗色', darkColors],
      ['亮色', lightColors],
    ]) {
      const bg = parseHex(c.codeBg)
      const tokens = { '--hl-fg': c.hlFg, '--hl-red': c.hlRed, '--hl-blue': c.hlBlue, '--hl-muted': c.hlMuted }
      const parsed = Object.entries(tokens).map(([k, v]) => ({ k, raw: v, hex: parseHex(v) }))
      const bad = parsed.filter((p) => !p.hex)
      if (!bg || bad.length > 0) {
        check(
          `${name}：--hl-* token 颜色可解析`,
          false,
          `codeBg=${JSON.stringify(c.codeBg)} 未解析=[${bad.map((p) => `${p.k}=${JSON.stringify(p.raw)}`).join(' ')}]`
        )
        continue
      }
      const rows = parsed.map((p) => ({ k: p.k, r: contrast(p.hex, bg) }))
      const worst = rows.reduce((a, b) => (b.r < a.r ? b : a))
      check(
        `${name}：4 个 --hl-* token 对 --code-bg(${c.codeBg}) 最低对比度 ${worst.r.toFixed(2)}:1 ≥ 4.5:1`,
        rows.every((x) => x.r >= 4.5),
        rows.map((x) => `${x.k}=${x.r.toFixed(2)}`).join(' ')
      )
    }

    // 品牌填充上的 SVG 描边（Navbar logo）：暗色下必须是近黑 --brand-fg，而非白字
    for (const [name, c] of [
      ['暗色', darkColors],
      ['亮色', lightColors],
    ]) {
      const stroke = parseRgb(c.logo?.stroke)
      const fill = parseRgb(c.logo?.fill)
      const r = stroke && fill ? contrast(stroke, fill) : null
      check(
        `${name}：品牌填充上的 SVG logo 描边 ${c.logo?.stroke} on ${c.logo?.fill} 对比度 ${r ? r.toFixed(2) : 'n/a'}:1 ≥ 4.5:1（未沿用另一个主题的白色）`,
        r !== null && r >= 4.5,
        `stroke=${c.logo?.stroke} fill=${c.logo?.fill}`
      )
    }

    // ---------- 标题字体（Archivo 生效） ----------
    console.log('\n--- 标题字体 Archivo 生效验证 ---')
    await navigate(cdp, '/archive')
    const fontInfo = await cdp.evaluate(`(async () => {
      await document.fonts.ready
      const h1 = document.querySelector('h1')
      const loaded = [...document.fonts].map(f => f.family + ':' + f.status)
      return {
        h1Family: h1 ? getComputedStyle(h1).fontFamily : null,
        h1Weight: h1 ? getComputedStyle(h1).fontWeight : null,
        h1LetterSpacing: h1 ? getComputedStyle(h1).letterSpacing : null,
        fonts: loaded,
        checkFont: document.fonts.check('600 16px Archivo'),
      }
    })()`)
    check(
      'h1 computed font-family 以 Archivo 开头',
      (fontInfo.h1Family ?? '').startsWith('Archivo'),
      fontInfo.h1Family
    )
    check(
      'Archivo 字体文件已被浏览器真正加载（document.fonts 中存在 loaded 条目）',
      fontInfo.fonts.some((f) => f.startsWith('Archivo') && f.endsWith('loaded')),
      fontInfo.fonts.join(' | ')
    )
    check(
      '标题负字距生效（h1 letter-spacing 为负值）',
      parseFloat(fontInfo.h1LetterSpacing) < 0,
      `letter-spacing=${fontInfo.h1LetterSpacing}`
    )
    check(
      '标题字重由非分层 CSS 决定：h1=700（JSX 里的 font-bold 已失效但不影响结果）',
      fontInfo.h1Weight === '700',
      `font-weight=${fontInfo.h1Weight}`
    )

    // ---------- §12 #11 功能无损 ----------
    console.log('\n--- §12 #11 功能无损（桩 API 驱动真实渲染）---')

    await navigate(cdp, '/archive')
    const archive = await cdp.evaluate(`(() => {
      const text = document.body.innerText
      const years = [...document.querySelectorAll('h2[id^="year-"]')].map(h => h.textContent.trim())
      const links = [...document.querySelectorAll('a[href^="/posts/"]')].map(a => a.getAttribute('href'))
      return { years, count: links.length, hasCn: text.includes('虚拟列表') }
    })()`)
    check(
      '归档页按年份分组渲染（出现 2026 / 2025 两个年份组）',
      archive.years.length === 2 && archive.years.includes('2026') && archive.years.includes('2025'),
      `years=[${archive.years.join(', ')}]`
    )
    check('归档页列出全部 3 篇文章', archive.count === 3, `链接数=${archive.count}`)

    await navigate(cdp, '/categories')
    const categories = await cdp.evaluate(`(() => {
      const text = document.body.innerText
      const links = [...document.querySelectorAll('a[href^="/categories/"]')].map(a => a.getAttribute('href'))
      return { links, text: text.slice(0, 200), hasFrontend: text.includes('前端') }
    })()`)
    check(
      '分类列表页渲染 2 个分类并带 post_count',
      categories.links.length === 2 && categories.hasFrontend,
      `${categories.links.join(', ')}`
    )

    await navigate(cdp, '/categories/frontend')
    const catDetail = await cdp.evaluate(`(() => {
      const text = document.body.innerText
      return { hasName: text.includes('前端'), cards: document.querySelectorAll('.card-flat').length }
    })()`)
    check(
      '分类详情页渲染该分类下的文章卡片',
      catDetail.hasName && catDetail.cards === 2,
      `card-flat 数=${catDetail.cards}`
    )

    // 搜索：中文 3 字以上（trigram）与 2 字（ilike）两种
    // 搜索 hook 有 250ms 防抖，需等防抖 + 请求返回，否则会误判为 0 结果
    for (const q of ['虚拟列表', '虚拟']) {
      await navigate(cdp, `/search?q=${encodeURIComponent(q)}`, 900)
      const s = await cdp.evaluate(`(() => {
        const text = document.body.innerText
        const marks = [...document.querySelectorAll('mark')]
        return {
          resultLinks: document.querySelectorAll('a[href^="/posts/"]').length,
          markCount: marks.length,
          markTexts: marks.map(m => m.textContent),
          hasQuery: text.includes(${JSON.stringify(q)}),
          usesInnerHTML: document.querySelectorAll('[data-dangerously]').length,
        }
      })()`)
      check(
        `搜索「${q}」能命中结果（桩 API 走 ${Array.from(q).length >= 3 ? 'trigram' : 'ilike'} 降级路径）`,
        s.resultLinks >= 1,
        `结果数=${s.resultLinks}`
      )
      check(
        `搜索「${q}」高亮用 <mark> 元素渲染且文本等于查询词`,
        s.markCount >= 1 && s.markTexts.every((t) => t === q),
        `mark=${s.markCount} 文本=[${[...new Set(s.markTexts)].join('|')}]`
      )
    }

    // 构建产物里不得出现 innerHTML 注入（结构性断言，补充高亮安全）
    const csrSafety = await cdp.evaluate(`(() => {
      const html = document.getElementById('root').innerHTML
      return { hasScriptTag: /<script/i.test(html) }
    })()`)
    check(
      '搜索结果 DOM 中不含注入的 <script>（高亮走 React 节点拼接）',
      csrSafety.hasScriptTag === false
    )

    // 文章详情 + 代码高亮 + TOC 中文锚点
    await navigate(cdp, '/posts/react-virtual-list')
    const detail = await cdp.evaluate(`(() => {
      const h2 = [...document.querySelectorAll('.markdown-body h2[id]')].map(h => ({ id: h.id, text: h.textContent.trim() }))
      const h3 = [...document.querySelectorAll('.markdown-body h3[id]')].map(h => ({ id: h.id, text: h.textContent.trim() }))
      const tocLinks = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'))
      const pre = document.querySelector('.markdown-body pre')
      const kw = document.querySelector('.hljs-keyword')
      const str = document.querySelector('.hljs-string')
      const h1 = document.querySelector('main h1, article h1')
      // 页眉元信息行 = 含"分钟阅读/min read"的那个 .t-eyebrow（不是 TOC 的 "On this page"）
      const metaEyebrow = [...document.querySelectorAll('.t-eyebrow')]
        .find((e) => /分钟阅读|min read/i.test(e.textContent))
      const metaAboveH1 = metaEyebrow && h1
        ? metaEyebrow.getBoundingClientRect().top < h1.getBoundingClientRect().top
        : false
      return {
        h2, h3, tocLinks,
        preCount: document.querySelectorAll('.markdown-body pre').length,
        preBorderRadius: pre ? getComputedStyle(pre).borderRadius : null,
        hasKw: !!kw, hasStr: !!str,
        preHtml: pre ? pre.outerHTML.slice(0, 400) : null,
        codeCls: pre ? (pre.querySelector('code')?.className ?? null) : null,
        eyebrowText: metaEyebrow ? metaEyebrow.textContent.trim().slice(0, 60) : null,
        metaAboveH1,
        h1Text: h1 ? h1.textContent.trim().slice(0, 40) : null,
        bodyText: document.body.innerText.slice(0, 120),
      }
    })()`)
    check(
      'h2 生成中文 id（rehype-slug），无 %E4 乱码',
      detail.h2.length > 0 &&
        detail.h2.every((h) => h.id.length > 0 && !/%[0-9A-F]{2}/i.test(h.id)) &&
        detail.h2.some((h) => /[\u4e00-\u9fa5]/.test(h.id)),
      `h2 ids=[${detail.h2.map((h) => h.id).join(' | ')}]`
    )
    check(
      'TOC 链接 href 与正文 h2/h3 id 完全一致（中文锚点可跳转）',
      detail.tocLinks.length >= detail.h2.length + detail.h3.length &&
        detail.h2.every((h) => detail.tocLinks.includes('#' + h.id)) &&
        detail.h3.every((h) => detail.tocLinks.includes('#' + h.id)),
      `toc=${detail.tocLinks.length} 条, h2=${detail.h2.length}, h3=${detail.h3.length}`
    )
    check(
      'TOC 链接地址中不含百分号转义（无 %E4%B8 类乱码）',
      detail.tocLinks.every((h) => !/%[0-9A-F]{2}/i.test(h)),
      `样例=${detail.tocLinks.slice(0, 3).join(', ')}`
    )
    check(
      'div.code 块渲染且圆角归零（Swiss）',
      detail.preCount === 2 && detail.preBorderRadius === '0px',
      `pre 数=${detail.preCount} radius=${detail.preBorderRadius}`
    )
    check(
      '代码块内 hljs token 已生成（keyword / string 均存在）',
      detail.hasKw && detail.hasStr,
      `code class="${detail.codeCls}" | ${detail.preHtml}`
    )
    check(
      '文章页眉标行（.t-eyebrow）含阅读时长且渲染在标题 h1 上方',
      !!detail.eyebrowText &&
        /分钟阅读|min read/i.test(detail.eyebrowText) &&
        detail.metaAboveH1 === true,
      `eyebrow="${detail.eyebrowText}" h1="${detail.h1Text}" above=${detail.metaAboveH1}`
    )

    // TOC 点击跳转真实性
    const scrollTest = await cdp.evaluate(`(() => {
      const link = [...document.querySelectorAll('a[href^="#"]')].find(a => a.getAttribute('href').includes('实现细节'))
      if (!link) return { ok: false, reason: '未找到目标 TOC 链接' }
      const id = link.getAttribute('href').slice(1)
      const el = document.getElementById(id)
      if (!el) return { ok: false, reason: 'id 未命中 DOM：' + id }
      const before = window.scrollY
      link.click()
      return new Promise((resolve) => setTimeout(() => {
        const top = el.getBoundingClientRect().top
        resolve({ ok: true, before, after: window.scrollY, top, id })
      }, 900))
    })()`)
    check(
      '点击中文锚点 TOC 条目可真实滚动到目标标题（并让出导航栏高度）',
      scrollTest.ok && scrollTest.after > scrollTest.before && scrollTest.top >= 0 && scrollTest.top < 200,
      JSON.stringify(scrollTest)
    )

    // Giscus 降级（未配置 VITE_GISCUS_* → 引导卡片、无破损 UI）
    const comment = await cdp.evaluate(`(() => {
      const sec = document.querySelector('section[aria-label]')
      const iframe = document.querySelector('iframe.giscus-frame')
      return {
        hasIframe: !!iframe,
        sectionText: sec ? sec.innerText.slice(0, 120) : null,
        hasEyebrow: !!(sec && sec.querySelector('.t-eyebrow')),
      }
    })()`)
    check(
      'Giscus 未配置时渲染引导占位卡片，且不注入任何 iframe（无破损 UI）',
      comment.hasIframe === false && !!comment.sectionText && comment.sectionText.length > 10,
      `iframe=${comment.hasIframe} 文本="${(comment.sectionText ?? '').slice(0, 60)}"`
    )
    check('评论区外围有 eyebrow 标题（Swiss 框架）', comment.hasEyebrow === true)

    // 404
    await navigate(cdp, '/definitely-not-a-page')
    const nf = await cdp.evaluate(`document.body.innerText.includes('404')`)
    check('未知路由渲染 404 页', nf === true)

    // ---------- §12 #10 无横向滚动 ----------
    console.log('\n--- §12 #10 五档宽度 × 中英双语：scrollWidth <= clientWidth ---')
    const widths = [375, 640, 768, 1024, 1440]
    const routes = ['/', '/archive', '/categories', '/categories/frontend', '/tags', '/about', '/search?q=虚拟列表', '/posts/react-virtual-list']

    for (const lang of ['zh', 'en']) {
      for (const width of widths) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: width < 768,
        })
        const bad = []
        for (const route of routes) {
          await navigate(cdp, route)
          await cdp.evaluate(`localStorage.setItem('blog_lang', ${JSON.stringify(lang)})`)
          // 语言变化需要重载才反映到 DOM 文案
          await navigate(cdp, route)
          const r = await cdp.evaluate(`(() => {
            const de = document.documentElement
            const offenders = []
            if (de.scrollWidth > de.clientWidth + 1) {
              for (const el of document.querySelectorAll('body *')) {
                const rect = el.getBoundingClientRect()
                if (rect.right > de.clientWidth + 1) {
                  offenders.push(el.tagName + '.' + (el.className || '').toString().slice(0, 40))
                }
              }
            }
            return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, offenders: offenders.slice(0, 3) }
          })()`)
          if (r.scrollWidth > r.clientWidth + 1) {
            bad.push(`${route} (${r.scrollWidth}>${r.clientWidth}) ${r.offenders.join('; ')}`)
          }
        }
        check(
          `${lang} @ ${width}px：8 条路由均无横向滚动`,
          bad.length === 0,
          bad.length ? bad.join(' || ') : '全部通过'
        )
      }
    }
    await cdp.send('Emulation.clearDeviceMetricsOverride')
  } finally {
    try {
      child.kill()
    } catch {
      /* ignore */
    }
    server.close()
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n' + '='.repeat(78))
  console.log(
    failed.length === 0
      ? `结果：全部通过（${results.length} 项运行时断言）`
      : `结果：${failed.length}/${results.length} 项失败`
  )
  for (const f of failed) console.log(`  - ${f.name} → ${f.detail}`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('运行时验收脚本异常：', err)
  process.exit(2)
})
