// 运行时机械验收（文档 §12 #8 #9 #10 #11 中需要"真机"的部分）
//
// 用法：node scripts/verify-runtime.mjs
//
// 为什么需要这个脚本：
//   §12 里有 4 条标准（双主题、三态防闪白、无横向滚动、功能无损）无法靠 grep/静态检查证明，
//   必须在真实浏览器里跑。但本地没有 PostgreSQL，所以这里起一个**桩 API**（返回固定 fixture）
//   与 dist 静态目录同源提供，再用 Chrome DevTools Protocol 驱动真实 Chrome 逐项断言。
//   桩 API 只影响数据来源，不影响任何 CSS / 布局 / 主题逻辑 —— 本次改造全部在前端。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
// 桩服务与 fixture 抽到 stub-server.mjs，与 scripts/screenshot.mjs 单一来源共享，
// 避免两处 fixture 漂移导致"断言过的页"和"截图的页"不是同一批数据。
import { PORT, startServer } from './stub-server.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')
const CDP_PORT = 9333

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
    whiteFrames: window.__frames.filter(f => f.bg === 'rgb(251, 248, 243)').length,
    blackFrames: window.__frames.filter(f => f.bg === 'rgb(23, 20, 15)').length,
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
      'theme=dark：DCL 时 body 背景即为暗色 #17140f（手账风暖近黑）',
      dark.atDCL?.bg === 'rgb(23, 20, 15)',
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
      !(light.atDCL?.cls ?? '').includes('dark') && light.atDCL?.bg === 'rgb(251, 248, 243)',
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
      (sysDark.atDCL?.cls ?? '').includes('dark') && sysDark.atDCL?.bg === 'rgb(23, 20, 15)',
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
      !(sysLight.atDCL?.cls ?? '').includes('dark') && sysLight.atDCL?.bg === 'rgb(251, 248, 243)',
      `class="${sysLight.atDCL?.cls}" bg=${sysLight.atDCL?.bg}`
    )

    const dirty = await themeProbe(cdp, 'darkk', 'light')
    check(
      "脏数据 theme='darkk' 回落到 system（跟随系统亮色），首帧亮色",
      !(dirty.atDCL?.cls ?? '').includes('dark') && dirty.atDCL?.bg === 'rgb(251, 248, 243)',
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

    // ---------- 标题字体（手账风：黑体系统栈，Newsreader/Archivo 均已移除） ----------
    console.log('\n--- 标题字体：黑体系统栈生效 / 自托管字体全部退场 ---')
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
      }
    })()`)
    check(
      'h1 computed font-family 以 PingFang SC 开头（手账风：标题走黑体，与正文同族）',
      /^["']?PingFang SC/.test(fontInfo.h1Family ?? ''),
      fontInfo.h1Family
    )
    check(
      '标题栈含中文系统黑体回退（HarmonyOS / MiSans / Microsoft YaHei，中文零字节方案）',
      /HarmonyOS Sans SC/.test(fontInfo.h1Family ?? '') &&
        /Microsoft YaHei/.test(fontInfo.h1Family ?? ''),
      fontInfo.h1Family
    )
    check(
      'Newsreader / Archivo 均已退场：document.fonts 中零自托管字体条目',
      fontInfo.fonts.length === 0,
      fontInfo.fonts.join(' | ') || '（0 个自托管字体条目）'
    )
    check(
      '标题负字距生效（h1 letter-spacing 为负值）',
      parseFloat(fontInfo.h1LetterSpacing) < 0,
      `letter-spacing=${fontInfo.h1LetterSpacing}`
    )
    check(
      '标题字重由标题 CSS 规则决定：h1=700（手账风统一 700，层级靠字号不靠字重）',
      fontInfo.h1Weight === '700',
      `font-weight=${fontInfo.h1Weight}`
    )

    // ---------- 标题字重：级联真实机制（Tailwind v3 展平 ⇒ 特异性决胜，非"非分层优先"） ----------
    console.log('\n--- 标题字重机制：非分层规则并不优先，标题上的 utility 会真的赢 ---')

    // (a) 用真实构建 CSS 注入测试节点，实证机制（含反面用例）
    await navigate(cdp, '/')
    const cascade = await cdp.evaluate(`(() => {
      const host = document.createElement('div')
      host.innerHTML = '<h2 id="__a" class="text-lg">A</h2>'
        + '<h2 id="__b" class="text-lg font-bold">B</h2>'
        + '<h1 id="__c" class="text-2xl">C</h1>'
        + '<h3 id="__d">D</h3>'
      document.body.appendChild(host)
      const w = (id) => getComputedStyle(document.getElementById(id)).fontWeight
      const r = { plainH2: w('__a'), h2Bold: w('__b'), plainH1: w('__c'), plainH3: w('__d') }
      host.remove()
      return r
    })()`)
    check(
      '标题 CSS 规则生效：纯 <h1> / <h2> / <h3> 均为 700（手账风统一字重）',
      cascade.plainH2 === '700' && cascade.plainH3 === '700' && cascade.plainH1 === '700',
      `h1=${cascade.plainH1} h2=${cascade.plainH2} h3=${cascade.plainH3}`
    )
    check(
      '<h2 class="font-bold"> 实测 700（与 CSS 同值）—— 证伪"非分层护栏"：utility 在标题上真的会赢（故须靠约定禁用）',
      cascade.h2Bold === '700',
      `h2.font-bold=${cascade.h2Bold}`
    )

    // (b) 真实 admin 页面实测（stub 提供 /auth/me + /admin/*，让受保护页面真正渲染）
    await navigate(cdp, '/')
    await cdp.evaluate(`localStorage.setItem('token', 'stub-token')`)
    await navigate(cdp, '/admin', 900)
    const adminH = await cdp.evaluate(`(() => {
      const h2 = [...document.querySelectorAll('h2')].find((h) => h.classList.contains('text-lg'))
      const h1 = document.querySelector('h1')
      return {
        path: location.pathname,
        h2Text: h2 ? h2.textContent.trim() : null,
        h2Weight: h2 ? getComputedStyle(h2).fontWeight : null,
        h2Class: h2 ? String(h2.className) : null,
        h1Weight: h1 ? getComputedStyle(h1).fontWeight : null,
      }
    })()`)
    check(
      '真实 admin 页（AdminDashboardPage）<h2 class="text-lg"> 实测字重 = 700',
      adminH.path === '/admin' && adminH.h2Weight === '700',
      `path=${adminH.path} h2="${adminH.h2Text}" class="${adminH.h2Class}" weight=${adminH.h2Weight}`
    )
    check(
      '真实 admin 页 <h1> 实测字重 = 700（与 CSS 一致，无 utility 干扰）',
      adminH.h1Weight === '700',
      `h1 weight=${adminH.h1Weight}`
    )
    await cdp.evaluate(`localStorage.removeItem('token')`)

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
    check('归档页列出全部 4 篇文章', archive.count === 4, `链接数=${archive.count}`)

    await navigate(cdp, '/categories')
    const categories = await cdp.evaluate(`(() => {
      const text = document.body.innerText
      const links = [...document.querySelectorAll('a[href^="/categories/"]')].map(a => a.getAttribute('href'))
      return { links, text: text.slice(0, 200), hasFrontend: text.includes('前端'), hasLife: text.includes('生活') }
    })()`)
    check(
      '分类列表页渲染 3 个分类（含新增「生活」）并带 post_count',
      categories.links.length === 3 && categories.hasFrontend && categories.hasLife,
      `${categories.links.join(', ')}`
    )

    await navigate(cdp, '/categories/frontend')
    const catDetail = await cdp.evaluate(`(() => {
      const text = document.body.innerText
      return { hasName: text.includes('前端'), cards: document.querySelectorAll('.card-media').length }
    })()`)
    check(
      '分类详情页渲染该分类下的文章卡片（手账卡 .card-media）',
      catDetail.hasName && catDetail.cards === 2,
      `card-media 数=${catDetail.cards}`
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

    // 文章详情 + 代码高亮 + TOC 中文锚点 + 杂志化元素
    await navigate(cdp, '/posts/react-virtual-list')
    const detail = await cdp.evaluate(`(() => {
      const h2 = [...document.querySelectorAll('.markdown-body h2[id]')].map(h => ({ id: h.id, text: h.textContent.trim() }))
      const h3 = [...document.querySelectorAll('.markdown-body h3[id]')].map(h => ({ id: h.id, text: h.textContent.trim() }))
      const tocLinks = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'))
      const pre = document.querySelector('.markdown-body pre')
      const kw = document.querySelector('.hljs-keyword')
      const str = document.querySelector('.hljs-string')
      const h1 = document.querySelector('main h1, article h1')
      const top = (el) => el ? el.getBoundingClientRect().top : null
      // 手写小标注（分类；✎ 前缀由 CSS ::before 提供）
      const kicker = document.querySelector('.t-kicker')
      // 元信息行 = 含"分钟阅读/min read"的 .t-meta（不是 TOC 的 "On this page"）
      const metaRow = [...document.querySelectorAll('.t-meta')]
        .find((e) => /分钟阅读|min read/i.test(e.textContent))
      // 手账引文：粉彩圆角块 + 手写正文
      const bq = document.querySelector('.markdown-body blockquote')
      const bqP = bq ? bq.querySelector('p') : null
      const bqBefore = bq ? getComputedStyle(bq, '::before') : null
      // 荧光笔标题：读 h2 的背景图与 fit-content 宽度行为
      const h2El = document.querySelector('.markdown-body h2')
      const h2cs = h2El ? getComputedStyle(h2El) : null
      // 首字下沉必须**已移除**：第一段的 ::first-letter 应与正文同字号
      const firstP = document.querySelector('.markdown-body > p:first-of-type')
      const fl = firstP ? getComputedStyle(firstP, '::first-letter') : null
      return {
        h2, h3, tocLinks,
        preCount: document.querySelectorAll('.markdown-body pre').length,
        preBorderRadius: pre ? getComputedStyle(pre).borderRadius : null,
        hasKw: !!kw, hasStr: !!str,
        preHtml: pre ? pre.outerHTML.slice(0, 400) : null,
        codeCls: pre ? (pre.querySelector('code')?.className ?? null) : null,
        h1Text: h1 ? h1.textContent.trim().slice(0, 40) : null,
        // ---- 手账风元素 ----
        kickerText: kicker ? kicker.textContent.trim() : null,
        kickerFont: kicker ? getComputedStyle(kicker).fontFamily : null,
        kickerColor: kicker ? getComputedStyle(kicker).color : null,
        kickerBeforeContent: kicker ? getComputedStyle(kicker, '::before').content : null,
        kickerAboveH1: kicker && h1 ? top(kicker) < top(h1) : false,
        metaText: metaRow ? metaRow.textContent.trim().slice(0, 60) : null,
        metaBelowH1: metaRow && h1 ? top(metaRow) > top(h1) : false,
        // 荧光笔标题
        h2BgImage: h2cs ? h2cs.backgroundImage : null,
        h2FontWeight: h2cs ? h2cs.fontWeight : null,
        h2FontSize: h2cs ? h2cs.fontSize : null,
        h2Padding: h2cs ? h2cs.padding : null,
        h2Width: h2El ? h2El.getBoundingClientRect().width : null,
        h2TextWidth: h2El ? (h2El.firstChild?.textContent ?? '').length : 0,
        // 引文
        bqRadius: bq ? getComputedStyle(bq).borderRadius : null,
        bqBg: bq ? getComputedStyle(bq).backgroundColor : null,
        bqPad: bq ? getComputedStyle(bq).padding : null,
        bqFont: bqP ? getComputedStyle(bqP).fontFamily : null,
        bqFontSize: bqP ? getComputedStyle(bqP).fontSize : null,
        bqBeforeContent: bqBefore ? bqBefore.content : null,
        bqBeforeFont: bqBefore ? bqBefore.fontFamily : null,
        // 首字下沉应已移除
        dropCapSize: fl ? fl.fontSize : null,
        dropCapFloat: fl ? fl.float : null,
        // NULL 封面约束：技术文（cover_image=null）不应渲染任何封面 figure
        coverFigure: document.querySelectorAll('article figure.hairline-frame, main figure.hairline-frame').length,
        // hero 收尾细线（--rule）：文章 header 之后、正文之前的那条 hr
        heroRuleColor: (() => {
          const hr = [...document.querySelectorAll('article hr')].find((h) => h.style.borderColor)
          return hr ? getComputedStyle(hr).borderTopColor : null
        })(),
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
      '代码块渲染且圆角恢复（手账风 pre = 14px 圆角，不再是直角）',
      detail.preCount === 2 && detail.preBorderRadius === '14px',
      `pre 数=${detail.preCount} radius=${detail.preBorderRadius}`
    )
    check(
      '代码块内 hljs token 已生成（keyword / string 均存在）',
      detail.hasKw && detail.hasStr,
      `code class="${detail.codeCls}" | ${detail.preHtml}`
    )

    // ---- 手账风元素（真机实测） ----
    console.log('\n--- 轻松手账风：视觉元素真机实测 ---')
    check(
      '① 手写小标注渲染在标题上方（分类名 + ✎ 前缀 + 手写体 + 珊瑚橘）',
      !!detail.kickerText && detail.kickerAboveH1 === true &&
        detail.kickerBeforeContent === '"✎ "' &&
        /KaiTi|STKaiti|Kaiti SC|cursive/.test(detail.kickerFont ?? '') &&
        /rgb\(194, 65, 12\)|rgb\(253, 186, 116\)/.test(detail.kickerColor ?? ''),
      `kicker="${detail.kickerText}" ::before=${detail.kickerBeforeContent} font=${detail.kickerFont} color=${detail.kickerColor} above=${detail.kickerAboveH1}`
    )
    check(
      '② 荧光笔标题：h2 有 linear-gradient 高亮 + 黑体 700 + 26px + 左右 2px 内边距',
      /linear-gradient/.test(detail.h2BgImage ?? '') &&
        detail.h2FontWeight === '700' &&
        detail.h2FontSize === '26px' &&
        /(^|\s)0px 2px(\s|$)/.test(detail.h2Padding ?? ''),
      `bg=${(detail.h2BgImage ?? '').slice(0, 60)} weight=${detail.h2FontWeight} size=${detail.h2FontSize} padding=${detail.h2Padding}`
    )
    check(
      '② 荧光笔只包住文字不通栏（h2 实测宽度 < 正文容器宽度）',
      detail.h2Width > 0 && detail.h2Width < 700,
      `h2 宽=${detail.h2Width?.toFixed?.(1)}px（fit-content 生效）`
    )
    check(
      '③ 首字下沉已移除：第一段 ::first-letter 与正文同字号且不浮动',
      detail.dropCapSize === '16px' && detail.dropCapFloat === 'none',
      `::first-letter size=${detail.dropCapSize} float=${detail.dropCapFloat}`
    )
    check(
      '④ hero 收尾改用 --rule 细线：文章头与正文之间有一条 hr，边框色为结构线色',
      detail.heroRuleColor === 'rgb(216, 208, 194)' || detail.heroRuleColor === 'rgb(62, 56, 48)',
      `hr border-color=${detail.heroRuleColor}`
    )
    check(
      '④ .rule-double / .dbl 双细线在页面上已不存在（上一轮组件已删）',
      (await cdp.evaluate(`document.querySelectorAll('.rule-double, .dbl').length`)) === 0,
      `count=${await cdp.evaluate(`document.querySelectorAll('.rule-double, .dbl').length`)}`
    )
    check(
      '⑤ 手账引文：butter 粉彩底 + 14px 圆角 + 22/26 内边距 + 大引号（CSS \\201C 计算后为 “）',
      detail.bqRadius === '14px' &&
        detail.bqPad === '22px 26px' &&
        detail.bqBeforeContent === '"\u201C"' &&
        /Georgia/.test(detail.bqBeforeFont ?? ''),
      `radius=${detail.bqRadius} bg=${detail.bqBg} padding=${detail.bqPad} ::before=${detail.bqBeforeContent} font=${detail.bqBeforeFont}`
    )
    check(
      '⑤ 引文正文用手写体 20px（不是衬线/黑体）',
      /KaiTi|STKaiti|Kaiti SC|cursive/.test(detail.bqFont ?? '') && detail.bqFontSize === '20px',
      `font=${detail.bqFont} size=${detail.bqFontSize}`
    )
    check(
      '⑤ 元信息行（.t-meta）含阅读时长且渲染在标题 h1 下方（手账 meta 语汇）',
      !!detail.metaText &&
        /分钟阅读|min read/i.test(detail.metaText) &&
        detail.metaBelowH1 === true,
      `meta="${detail.metaText}" below=${detail.metaBelowH1}`
    )
    check(
      '⚠️ NULL 封面约束：cover_image=null 的技术文**不渲染任何封面 figure**（不塌陷、不破图）',
      detail.coverFigure === 0,
      `figure.hairline-frame 数=${detail.coverFigure}`
    )

    // ---- 贴纸标签：粉彩 pill（真实页面取色复测） ----
    console.log('\n--- 贴纸标签：粉彩 pill 真机实测 ---')
    const badges = await cdp.evaluate(`(() => {
      const els = [...document.querySelectorAll('.tag-badge')]
      return els.slice(0, 8).map((el) => {
        const cs = getComputedStyle(el)
        return {
          text: el.textContent.trim(),
          cls: String(el.className),
          bg: cs.backgroundColor,
          fg: cs.color,
          radius: cs.borderRadius,
          borderWidth: cs.borderTopWidth,
        }
      })
    })()`)
    check(
      '文章标签渲染为粉彩 pill（border-radius 999px、无边框、非透明底）',
      badges.length > 0 &&
        badges.every((b) => b.radius === '999px' && b.borderWidth === '0px' && b.bg !== 'rgba(0, 0, 0, 0)'),
      badges.map((b) => `${b.text}:${b.bg}/${b.fg} r=${b.radius}`).join(' | ')
    )

    // 轮换效果要在**多个标签**的页面上看：标签页有 4 个标签，颜色应该不止一种。
    await navigate(cdp, '/tags')
    const cloudBadges = await cdp.evaluate(`(() => {
      const els = [...document.querySelectorAll('.tag-badge')]
      return els.map((el) => {
        const cs = getComputedStyle(el)
        return { text: el.textContent.trim().slice(0, 14), bg: cs.backgroundColor, fg: cs.color, radius: cs.borderRadius }
      })
    })()`)
    check(
      '粉彩取模轮换生效：标签页 4 个标签出现 ≥2 种不同底色（不是一色到底）',
      cloudBadges.length >= 2 && new Set(cloudBadges.map((b) => b.bg)).size >= 2,
      cloudBadges.map((b) => `${b.text}:${b.bg}`).join(' | ')
    )
    check(
      '标签页贴纸同样是 pill + 非透明粉彩底',
      cloudBadges.every((b) => b.radius === '999px' && b.bg !== 'rgba(0, 0, 0, 0)'),
      cloudBadges.map((b) => `${b.text}: r=${b.radius}`).join(' | ')
    )

    // ---- 生活类文章：图集网格（rehypeGallery 从连续图片段落长出） ----
    console.log('\n--- 生活类文章：正文图集网格（不改 schema） ---')
    await navigate(cdp, '/posts/seven-days-in-the-mountains')
    const gallery = await cdp.evaluate(`(() => {
      const grid = document.querySelector('.markdown-body .md-gallery')
      const items = grid ? [...grid.querySelectorAll('.md-gallery-item')] : []
      const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0
      const firstWide = items[0] ? items[0].classList.contains('wide') : false
      const imgs = grid ? [...grid.querySelectorAll('img')].map(i => i.getAttribute('src')) : []
      const bq = document.querySelector('.markdown-body blockquote')
      const firstP = document.querySelector('.markdown-body > p:first-of-type')
      const fl = firstP ? getComputedStyle(firstP, '::first-letter') : null
      const gItem = document.querySelector('.markdown-body .md-gallery-item')
      return {
        gridCount: document.querySelectorAll('.markdown-body .md-gallery').length,
        items: items.length,
        cols,
        firstWide,
        imgs,
        capCount: document.querySelectorAll('.markdown-body .md-gallery-cap').length,
        coverFigure: document.querySelectorAll('article figure.hairline-frame, main figure.hairline-frame').length,
        contentTop: document.querySelectorAll('article > *').length,
        // 首字下沉应已移除
        dropCapSize: fl ? fl.fontSize : null,
        dropCapFloat: fl ? fl.float : null,
        hasQuote: !!bq,
        h2Count: document.querySelectorAll('.markdown-body h2').length,
        // 图集格圆角化（手账风：12px，不再是直角）
        galleryItemRadius: gItem ? getComputedStyle(gItem).borderRadius : null,
        // 荧光笔高亮（手账风行内强调，语法为两个等号包裹）
        markCount: document.querySelectorAll('.markdown-body mark').length,
        markClass: (() => {
          const m = document.querySelector('.markdown-body mark')
          return m ? (m.getAttribute('class') ?? '') : null
        })(),
        markBgImage: (() => {
          const m = document.querySelector('.markdown-body mark')
          return m ? getComputedStyle(m).backgroundImage : null
        })(),
        markColor: (() => {
          const m = document.querySelector('.markdown-body mark')
          return m ? getComputedStyle(m).color : null
        })(),
        // 引文署名：多段引文的最后一段
        attributionSize: (() => {
          const ps = document.querySelectorAll('.markdown-body blockquote > p')
          const last = ps[ps.length - 1]
          return last ? getComputedStyle(last).fontSize : null
        })(),
      }
    })()`)
    check(
      '生活文：5 张连续图片段落被 rehypeGallery 收成 1 个 3 列图集（5 格，首格跨 2 列）',
      gallery.gridCount === 1 && gallery.items === 5 && gallery.cols === 3 && gallery.firstWide === true,
      `grid=${gallery.gridCount} items=${gallery.items} cols=${gallery.cols} firstWide=${gallery.firstWide}`
    )
    check(
      '图集内 5 张图 src 全部指向站内（/img/g1..g5.svg），无破图',
      gallery.imgs.length === 5 && gallery.imgs.every((s) => /^\/img\/g\d\.svg$/.test(s ?? '')),
      `[${gallery.imgs.join(', ')}]`
    )
    check(
      '图注（.md-gallery-cap）渲染 1 条',
      gallery.capCount === 1,
      `cap 数=${gallery.capCount}`
    )
    check(
      '图集格圆角化：.md-gallery-item = 12px 圆角',
      gallery.galleryItemRadius === '12px',
      `radius=${gallery.galleryItemRadius}`
    )
    check(
      '生活文同样受 NULL 封面约束：无封面 figure（正文直接以文字 + 图集开场）',
      gallery.coverFigure === 0,
      `figure.hairline-frame 数=${gallery.coverFigure}`
    )
    check(
      '荧光笔 `==文字==`：生活文正文里的高亮渲染成 <mark class="hl"> 渐变，文字色为 --text',
      gallery.markCount === 1 &&
        gallery.markClass === 'hl' &&
        /linear-gradient/.test(gallery.markBgImage ?? '') &&
        (gallery.markColor === 'rgb(42, 39, 36)' || gallery.markColor === 'rgb(242, 237, 228)'),
      `mark 数=${gallery.markCount} class=${gallery.markClass} bg=${(gallery.markBgImage ?? '').slice(0, 50)} color=${gallery.markColor}`
    )
    check(
      '引文署名约定：多段引文的最后一段渲染为 13px 手写 muted（不是 20px 正文）',
      gallery.attributionSize === '13px',
      `最后一段 font-size=${gallery.attributionSize}`
    )

    // ---- 涂鸦层专项（本次唯一新组件） ----
    console.log('\n--- 涂鸦层 Doodles：pointer-events / aria-hidden / 响应式收敛 ---')
    const doodleBase = await cdp.evaluate(`(() => {
      const layer = document.querySelector('.doodles')
      if (!layer) return { exists: false }
      const cs = getComputedStyle(layer)
      const svgs = [...layer.querySelectorAll('svg')]
      return {
        exists: true,
        pointerEvents: cs.pointerEvents,
        position: cs.position,
        zIndex: cs.zIndex,
        overflow: cs.overflow,
        ariaHidden: layer.getAttribute('aria-hidden'),
        svgCount: svgs.length,
        classes: svgs.map((s) => s.getAttribute('class') ?? ''),
        opacities: svgs.map((s) => getComputedStyle(s).opacity),
        // 涂鸦是否在文档流里占位（fixed 不该影响 scrollWidth）
        offsetHeight: layer.offsetHeight,
      }
    })()`)
    check(
      '涂鸦层存在且 pointer-events:none（不挡任何点击）',
      doodleBase.exists && doodleBase.pointerEvents === 'none',
      `pointer-events=${doodleBase.pointerEvents}`
    )
    check(
      '涂鸦层 position:fixed + z-index:0 + overflow:hidden（不占文档流、不撑宽文档）',
      doodleBase.position === 'fixed' && doodleBase.zIndex === '0' && doodleBase.overflow === 'hidden',
      `position=${doodleBase.position} z-index=${doodleBase.zIndex} overflow=${doodleBase.overflow}`
    )
    check(
      '涂鸦层 aria-hidden="true"（屏幕阅读器完全跳过）',
      doodleBase.ariaHidden === 'true',
      `aria-hidden=${doodleBase.ariaHidden}`
    )
    check(
      '五个内联 SVG 涂鸦齐备（星/心/螺旋/波浪/叶子）',
      doodleBase.svgCount === 5,
      `${doodleBase.svgCount} 个：[${doodleBase.classes.join(', ')}]`
    )
    check(
      '涂鸦透明度 0.42（暗色会降到 0.30，由 CSS 媒体查询外的 .dark 规则负责）',
      doodleBase.opacities.every((o) => o === '0.42'),
      `opacities=[${doodleBase.opacities.join(', ')}]`
    )
    // 点击穿透：在涂鸦所在坐标派发点击，落点必须是下层元素而不是涂鸦
    const clickThrough = await cdp.evaluate(`(() => {
      const star = document.querySelector('.d-star')
      if (!star) return { ok: false, reason: '未找到 .d-star' }
      const r = star.getBoundingClientRect()
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return {
        ok: true,
        hitTag: el ? el.tagName : null,
        hitCls: el ? String(el.className).slice(0, 40) : null,
        isDoodle: !!(el && el.closest('.doodles')),
      }
    })()`)
    check(
      '点击穿透：涂鸦坐标上 elementFromPoint 命中的不是涂鸦层（真的不挡点击）',
      clickThrough.ok && clickThrough.isDoodle === false,
      `命中=${clickThrough.hitTag}.${clickThrough.hitCls} isDoodle=${clickThrough.isDoodle}`
    )

    // 三档响应式下的可见数量
    const doodleResponsive = []
    for (const [w, expectVisible] of [[1440, 5], [1100, 2], [800, 2]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 900,
        deviceScaleFactor: 1,
        mobile: w < 768,
      })
      const r = await cdp.evaluate(`(() => {
        const svgs = [...document.querySelectorAll('.doodles svg')]
        const visible = svgs.filter((s) => getComputedStyle(s).display !== 'none')
        return { total: svgs.length, visible: visible.length }
      })()`)
      doodleResponsive.push(`${w}px→${r.visible}/${r.total}（期望 ${expectVisible}）`)
      check(
        `涂鸦响应式收敛 @ ${w}px：可见 ${expectVisible} 个`,
        r.visible === expectVisible,
        doodleResponsive[doodleResponsive.length - 1]
      )
    }

    // 列表卡：圆角 + 软阴影 + 无封面态
    console.log('\n--- 列表卡片：圆角 / 软阴影 / 无封面降级 ---')
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    await navigate(cdp, '/')
    const cards = await cdp.evaluate(`(() => {
      const els = [...document.querySelectorAll('.card-media')]
      return els.map((el) => {
        const cs = getComputedStyle(el)
        const cover = el.querySelector('.card-cover')
        const tape = el.querySelector('.tape')
        const h2 = el.querySelector('h2')
        return {
          title: h2 ? h2.textContent.trim().slice(0, 20) : null,
          radius: cs.borderRadius,
          shadow: cs.boxShadow,
          hasCover: !!cover,
          hasTape: !!tape,
          height: Math.round(el.getBoundingClientRect().height),
          h2Weight: h2 ? getComputedStyle(h2).fontWeight : null,
          h2Size: h2 ? getComputedStyle(h2).fontSize : null,
        }
      })
    })()`)
    check(
      '列表卡全部为 16px 圆角 + 非 none 软阴影（手账卡，不是直角）',
      cards.length > 0 &&
        cards.every((c) => c.radius === '16px' && c.shadow !== 'none' && c.shadow !== ''),
      cards.map((c) => `${c.title}: r=${c.radius} shadow=${c.shadow.slice(0, 30)}`).join(' | ')
    )
    check(
      '无封面卡（4 篇全是 cover_image=NULL）不渲染封面区也不贴胶带，高度按内容收窄',
      cards.every((c) => c.hasCover === false && c.hasTape === false) &&
        cards.every((c) => c.height > 0 && c.height < 400),
      cards.map((c) => `${c.title}: ${c.height}px cover=${c.hasCover} tape=${c.hasTape}`).join(' | ')
    )
    check(
      '卡片标题字重 700 / 18px（由非分层 CSS 提供，JSX 上无 font-* utility）',
      cards.every((c) => c.h2Weight === '700' && c.h2Size === '18px'),
      cards.map((c) => `${c.h2Weight}/${c.h2Size}`).join(' | ')
    )

    // TOC 点击跳转真实性（回到技术文 —— 上一段把页面切到了生活文）
    await navigate(cdp, '/posts/react-virtual-list')
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
    check('评论区外围有手写眉标标题（手账风框架）', comment.hasEyebrow === true)

    // 404
    await navigate(cdp, '/definitely-not-a-page')
    const nf = await cdp.evaluate(`document.body.innerText.includes('404')`)
    check('未知路由渲染 404 页', nf === true)

    // ---------- §12 #10 无横向滚动 ----------
    console.log('\n--- §12 #10 五档宽度 × 中英双语：scrollWidth <= clientWidth ---')
    // 涂鸦层是 fixed 定位，规格特别要求查它不会把文档撑宽。
    // 单独断言一次：涂鸦层自身的 scrollWidth 不得大于视口。
    // ⚠️ 必须先回到**被 Layout 包裹**的路由：404 页（path="*"）不在 Layout 里，
    //    那里没有涂鸦层，直接测会拿到"无涂鸦层"的假失败。
    await navigate(cdp, '/')
    const doodleOverflow = await cdp.evaluate(`(() => {
      const layer = document.querySelector('.doodles')
      if (!layer) return { ok: false, reason: '无涂鸦层' }
      return {
        ok: true,
        layerScrollWidth: layer.scrollWidth,
        layerClientWidth: layer.clientWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        docClientWidth: document.documentElement.clientWidth,
      }
    })()`)
    check(
      '涂鸦层自身不产生横向溢出（layer.scrollWidth <= layer.clientWidth 且不撑宽文档）',
      doodleOverflow.ok &&
        doodleOverflow.layerScrollWidth <= doodleOverflow.layerClientWidth + 1 &&
        doodleOverflow.docScrollWidth <= doodleOverflow.docClientWidth + 1,
      JSON.stringify(doodleOverflow)
    )
    const widths = [320, 375, 768, 1024, 1440]
    const routes = [
      '/',
      '/archive',
      '/categories',
      '/categories/frontend',
      '/tags',
      '/about',
      '/search?q=虚拟列表',
      '/posts/react-virtual-list',
      '/posts/seven-days-in-the-mountains',
    ]

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
          `${lang} @ ${width}px：9 条路由均无横向滚动`,
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
