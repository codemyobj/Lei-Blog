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
    whiteFrames: window.__frames.filter(f => f.bg === 'rgb(251, 249, 246)').length,
    blackFrames: window.__frames.filter(f => f.bg === 'rgb(14, 13, 12)').length,
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
      'theme=dark：DCL 时 body 背景即为暗色 #0e0d0c（暖近黑，非瑞士冷黑）',
      dark.atDCL?.bg === 'rgb(14, 13, 12)',
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
      !(light.atDCL?.cls ?? '').includes('dark') && light.atDCL?.bg === 'rgb(251, 249, 246)',
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
      (sysDark.atDCL?.cls ?? '').includes('dark') && sysDark.atDCL?.bg === 'rgb(14, 13, 12)',
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
      !(sysLight.atDCL?.cls ?? '').includes('dark') && sysLight.atDCL?.bg === 'rgb(251, 249, 246)',
      `class="${sysLight.atDCL?.cls}" bg=${sysLight.atDCL?.bg}`
    )

    const dirty = await themeProbe(cdp, 'darkk', 'light')
    check(
      "脏数据 theme='darkk' 回落到 system（跟随系统亮色），首帧亮色",
      !(dirty.atDCL?.cls ?? '').includes('dark') && dirty.atDCL?.bg === 'rgb(251, 249, 246)',
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

    // ---------- 标题字体（杂志化：显示衬线，Archivo 已移除） ----------
    console.log('\n--- 标题字体：显示衬线生效 / Archivo 已退场 ---')
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
      'h1 computed font-family 以 Newsreader 开头（杂志化显示衬线，取代 Archivo）',
      (fontInfo.h1Family ?? '').startsWith('Newsreader'),
      fontInfo.h1Family
    )
    check(
      '显示衬线栈含中文系统宋体回退（Noto Serif SC / SimSun，中文零字节方案）',
      /Noto Serif SC/.test(fontInfo.h1Family ?? '') && /SimSun/.test(fontInfo.h1Family ?? ''),
      fontInfo.h1Family
    )
    check(
      'Archivo 已彻底退场：document.fonts 中不再注册 Archivo（上一轮 38752 B 的资产已删）',
      fontInfo.fonts.every((f) => !f.startsWith('Archivo')),
      fontInfo.fonts.join(' | ') || '（无自托管字体条目）'
    )
    check(
      '标题负字距生效（h1 letter-spacing 为负值）',
      parseFloat(fontInfo.h1LetterSpacing) < 0,
      `letter-spacing=${fontInfo.h1LetterSpacing}`
    )
    check(
      '标题字重由标题 CSS 规则决定：h1=600（杂志化统一 600，层级靠字号不靠字重）',
      fontInfo.h1Weight === '600',
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
      '标题 CSS 规则生效：纯 <h1> / <h2> / <h3> 均为 600（杂志化统一字重）',
      cascade.plainH2 === '600' && cascade.plainH3 === '600' && cascade.plainH1 === '600',
      `h1=${cascade.plainH1} h2=${cascade.plainH2} h3=${cascade.plainH3}`
    )
    check(
      '<h2 class="font-bold"> 实测 700 —— 证伪"非分层护栏"：utility 在标题上真的会赢（故须靠约定禁用）',
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
      '真实 admin 页（你点名的 AdminDashboardPage）<h2 class="text-lg"> 实测字重 = 600',
      adminH.path === '/admin' && adminH.h2Weight === '600',
      `path=${adminH.path} h2="${adminH.h2Text}" class="${adminH.h2Class}" weight=${adminH.h2Weight}`
    )
    check(
      '真实 admin 页 <h1> 实测字重 = 600（与 CSS 一致，无 utility 干扰）',
      adminH.h1Weight === '600',
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
      '分类详情页渲染该分类下的文章卡片（杂志卡片 .card-media）',
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
      // 开场红色 kicker（分类，含右侧延伸细线）
      const kicker = document.querySelector('.t-kicker')
      // 元信息行 = 含"分钟阅读/min read"的 .t-meta（不是 TOC 的 "On this page"）
      const metaRow = [...document.querySelectorAll('.t-meta')]
        .find((e) => /分钟阅读|min read/i.test(e.textContent))
      // 首字下沉：读第一段的 ::first-letter 计算样式
      const firstP = document.querySelector('.markdown-body > p:first-of-type')
      const fl = firstP ? getComputedStyle(firstP, '::first-letter') : null
      // 编号章节：读 h2 的 ::before 生成内容
      const h2El = document.querySelector('.markdown-body h2')
      const h2Before = h2El ? getComputedStyle(h2El, '::before') : null
      // 红边引文
      const bq = document.querySelector('.markdown-body blockquote')
      return {
        h2, h3, tocLinks,
        preCount: document.querySelectorAll('.markdown-body pre').length,
        preBorderRadius: pre ? getComputedStyle(pre).borderRadius : null,
        hasKw: !!kw, hasStr: !!str,
        preHtml: pre ? pre.outerHTML.slice(0, 400) : null,
        codeCls: pre ? (pre.querySelector('code')?.className ?? null) : null,
        h1Text: h1 ? h1.textContent.trim().slice(0, 40) : null,
        // 杂志化元素
        kickerText: kicker ? kicker.textContent.trim() : null,
        kickerColor: kicker ? getComputedStyle(kicker).color : null,
        kickerAfterBg: kicker ? getComputedStyle(kicker, '::after').backgroundColor : null,
        kickerAboveH1: kicker && h1 ? top(kicker) < top(h1) : false,
        metaText: metaRow ? metaRow.textContent.trim().slice(0, 60) : null,
        metaBelowH1: metaRow && h1 ? top(metaRow) > top(h1) : false,
        ruleDoubleCount: document.querySelectorAll('.rule-double').length,
        ruleDoubleTop: (() => {
          const rd = document.querySelector('.rule-double')
          return rd ? getComputedStyle(rd).borderTopWidth : null
        })(),
        dropCapFont: fl ? fl.fontFamily : null,
        dropCapSize: fl ? fl.fontSize : null,
        dropCapFloat: fl ? fl.float : null,
        h2NumberContent: h2Before ? h2Before.content : null,
        h2NumberColor: h2Before ? h2Before.color : null,
        bqBorderLeft: bq ? getComputedStyle(bq).borderLeftColor : null,
        bqBorderWidth: bq ? getComputedStyle(bq).borderLeftWidth : null,
        bqFont: bq ? getComputedStyle(bq).fontFamily : null,
        // NULL 封面约束：技术文（cover_image=null）不应渲染任何封面 figure
        coverFigure: document.querySelectorAll('article figure.hairline-frame, main figure.hairline-frame').length,
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
      '代码块渲染且圆角归零（杂志化同样零圆角）',
      detail.preCount === 2 && detail.preBorderRadius === '0px',
      `pre 数=${detail.preCount} radius=${detail.preBorderRadius}`
    )
    check(
      '代码块内 hljs token 已生成（keyword / string 均存在）',
      detail.hasKw && detail.hasStr,
      `code class="${detail.codeCls}" | ${detail.preHtml}`
    )

    // ---- 杂志化 8 元素（真机实测） ----
    console.log('\n--- 杂志化编辑风：8 个视觉元素真机实测 ---')
    check(
      '① 红色 kicker 渲染在标题上方（分类名 + 强调色 #E4002B 系）',
      !!detail.kickerText && detail.kickerAboveH1 === true &&
        /rgb\(228, 0, 43\)|rgb\(255, 77, 77\)/.test(detail.kickerColor ?? ''),
      `kicker="${detail.kickerText}" color=${detail.kickerColor} above=${detail.kickerAboveH1}`
    )
    check(
      '① kicker ::after 延伸细线存在（background 非 transparent）',
      !!detail.kickerAfterBg && detail.kickerAfterBg !== 'rgba(0, 0, 0, 0)',
      `::after bg=${detail.kickerAfterBg}`
    )
    check(
      '② 双细线（.rule-double）渲染，上边 3px 强调线，位于正文之前',
      detail.ruleDoubleCount === 1 && detail.ruleDoubleTop === '3px',
      `count=${detail.ruleDoubleCount} border-top=${detail.ruleDoubleTop}`
    )
    check(
      '③ 编号章节：h2 的 ::before 生成 counter 编号且为强调色',
      /counter\(section/.test(detail.h2NumberContent ?? '') &&
        /rgb\(228, 0, 43\)|rgb\(255, 77, 77\)/.test(detail.h2NumberColor ?? ''),
      `content=${detail.h2NumberContent} color=${detail.h2NumberColor}`
    )
    check(
      '④ 首字下沉：正文第一段 ::first-letter 为衬线 64px 且 float:left',
      /Newsreader/.test(detail.dropCapFont ?? '') &&
        detail.dropCapSize === '64px' &&
        detail.dropCapFloat === 'left',
      `font=${detail.dropCapFont} size=${detail.dropCapSize} float=${detail.dropCapFloat}`
    )
    check(
      '⑤ 红边引文：blockquote 左 3px 强调色 + 衬线字体',
      detail.bqBorderWidth === '3px' &&
        /rgb\(228, 0, 43\)|rgb\(255, 77, 77\)/.test(detail.bqBorderLeft ?? '') &&
        /Newsreader/.test(detail.bqFont ?? ''),
      `border-left=${detail.bqBorderWidth} ${detail.bqBorderLeft} font=${detail.bqFont}`
    )
    check(
      '⑤ 元信息行（.t-meta）含阅读时长且渲染在标题 h1 下方（杂志 meta 语汇）',
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
      return {
        gridCount: document.querySelectorAll('.markdown-body .md-gallery').length,
        items: items.length,
        cols,
        firstWide,
        imgs,
        capCount: document.querySelectorAll('.markdown-body .md-gallery-cap').length,
        coverFigure: document.querySelectorAll('article figure.hairline-frame, main figure.hairline-frame').length,
        contentTop: document.querySelectorAll('article > *').length,
        hasDropCap: fl ? fl.float === 'left' : false,
        hasQuote: !!bq,
        h2Count: document.querySelectorAll('.markdown-body h2').length,
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
      '生活文同样受 NULL 封面约束：无封面 figure（正文直接以文字 + 图集开场）',
      gallery.coverFigure === 0,
      `figure.hairline-frame 数=${gallery.coverFigure}`
    )
    check(
      '生活文首字下沉 + 红边引文 + 编号章节同样生效（编辑风跨文章类型一致）',
      gallery.hasDropCap === true && gallery.hasQuote === true && gallery.h2Count === 2,
      `dropCap=${gallery.hasDropCap} quote=${gallery.hasQuote} h2=${gallery.h2Count}`
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
    check('评论区外围有 eyebrow 标题（编辑风框架）', comment.hasEyebrow === true)

    // 404
    await navigate(cdp, '/definitely-not-a-page')
    const nf = await cdp.evaluate(`document.body.innerText.includes('404')`)
    check('未知路由渲染 404 页', nf === true)

    // ---------- §12 #10 无横向滚动 ----------
    console.log('\n--- §12 #10 五档宽度 × 中英双语：scrollWidth <= clientWidth ---')
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
