// 真实构建产物截图（用于人工视觉验收）
//
// 用法：node scripts/screenshot.mjs [输出目录]
//   默认输出到 C:\Users\雷磊\WorkBuddy\2026-10-06-00-34-50\shots\
//
// 为什么不是手写静态页：
//   这些 png 必须由 **dist/ 真实构建产物 + 真机 Chrome** 渲染出来，
//   才能证明"换肤后的真实页面长这样"，而不是我画的一张图。
//   数据来源复用 scripts/stub-server.mjs（与 verify-runtime.mjs 单一来源）——
//   4 篇文章 cover_image 全为 NULL（与生产库一致），生活文带正文图集。
//
// 产出（6 张，命名清晰）：
//   home-light.png / home-dark.png    首页 1440 宽
//   post-light.png / post-dark.png    技术文详情（cover_image=NULL 的真实文章）
//   post-gallery.png                  生活文详情（无封面 + 正文 5 图图集）
//   home-mobile.png                   首页 375 宽
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { PORT, startServer } from './stub-server.mjs'

const CDP_PORT = 9334
const OUT_DIR =
  process.argv[2] ?? 'C:/Users/雷磊/WorkBuddy/2026-10-06-00-34-50/shots'

const DIST = path.resolve(import.meta.dirname, '../dist')

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

function fetchJson(url) {
  return fetch(url).then((r) => r.json())
}

async function launchChrome() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ]
  const bin = candidates.find((p) => fs.existsSync(p))
  if (!bin) throw new Error('未找到 Chrome / Edge 可执行文件')

  const userDataDir = path.join(os.tmpdir(), `lei-blog-shot-${process.pid}-${Date.now()}`)
  const child = spawn(
    bin,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

/**
 * 全页截图：先按 width 覆盖设备度量，再按内容实际高度裁剪。
 * @returns 像素高度
 */
async function capture(cdp, width, file) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 768,
  })
  // 等图片（桩 SVG）与字体就绪
  await cdp.evaluate(`(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})))
    return true
  })()`)
  await sleep(250)
  const metrics = await cdp.send('Page.getLayoutMetrics')
  const size = metrics.cssContentSize ?? metrics.contentSize
  const clip = {
    x: 0,
    y: 0,
    width: Math.ceil(size.width),
    height: Math.ceil(size.height),
    scale: 1,
  }
  const res = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip,
  })
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'))
  return { width: clip.width, height: clip.height }
}

// ------------------------------------------------------------------ 主流程

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/ 不存在，请先 npm run build')
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const server = await startServer()
  const { child } = await launchChrome()
  const cdp = await connectPage()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  // [文件名, 路由, 主题, 宽度, 语言, 就绪后额外等待]
  const shots = [
    ['home-light.png', '/', 'light', 1440, 'zh', 0],
    ['home-dark.png', '/', 'dark', 1440, 'zh', 0],
    ['post-light.png', '/posts/react-virtual-list', 'light', 1440, 'zh', 0],
    ['post-dark.png', '/posts/react-virtual-list', 'dark', 1440, 'zh', 0],
    ['post-gallery.png', '/posts/seven-days-in-the-mountains', 'light', 1440, 'zh', 0],
    ['home-mobile.png', '/', 'light', 375, 'zh', 0],
  ]

  console.log('='.repeat(78))
  console.log(`真实构建产物截图 → ${OUT_DIR}`)
  console.log(`桩 API 端口 ${PORT}（cover_image 全为 NULL，与生产库一致）`)
  console.log('='.repeat(78))

  try {
    // 先写一次 pref（同源），后续每张只需设主题即可
    await navigate(cdp, '/')
    for (const [name, route, theme, width, lang] of shots) {
      await navigate(cdp, '/')
      await cdp.evaluate(`localStorage.setItem('theme', ${JSON.stringify(theme)})`)
      await cdp.evaluate(`localStorage.setItem('blog_lang', ${JSON.stringify(lang)})`)
      await navigate(cdp, route, 400)
      const file = path.join(OUT_DIR, name)
      const size = await capture(cdp, width, file)
      const bytes = fs.statSync(file).size
      console.log(
        `  ✓ ${name.padEnd(20)} ${String(width).padStart(4)}px  ${size.width}×${size.height}  ${(bytes / 1024).toFixed(1)} KB`
      )
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

  console.log('\n完成：共 6 张截图。')
}

main().catch((err) => {
  console.error('截图脚本异常：', err)
  process.exit(1)
})
