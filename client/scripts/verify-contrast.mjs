// 对比度机械验收（轻松手账风 · Journal）
//
// 用法：node scripts/verify-contrast.mjs
//
// 直接从 client/src/index.css 解析出真实的 :root / .dark 令牌值再计算，
// 而不是照抄文档表格 —— 这样"文档写了什么"和"代码里是什么"不可能脱节。
//
// 本轮特别加了两类断言（都是前几轮踩过的坑）：
//   1. **六组粉彩**：贴纸标签的底/字成对，且**必须不透明**。
//      "粉彩叠在半透明背景上掉对比度"是经典陷阱，所以这里既测比值也测 alpha。
//   2. **荧光笔 --mark**：高亮底上的文字色对比度。
// 另外 --border-strong 亮暗各两条（WCAG 1.4.11 非文本 ≥3:1）继续保留。
import fs from 'node:fs'
import path from 'node:path'

const CSS_PATH = path.resolve(import.meta.dirname, '../src/index.css')
const css = fs.readFileSync(CSS_PATH, 'utf8')

/** 抓取 `:root { ... }` 或 `.dark { ... }` 块内的 `--x: value;` 声明 */
function parseTokens(selector) {
  // 只取第一次出现该选择器的块（:root/.dark 各只定义一次令牌）
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n  \\}`, 'm')
  const block = css.match(re)?.[1]
  if (!block) throw new Error(`未找到 ${selector} 令牌块`)
  const tokens = {}
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens[m[1]] = m[2].trim()
  }
  return tokens
}

const light = parseTokens(':root')
const dark = parseTokens('\\.dark')

// ---------------------------------------------------------------- 颜色工具

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

function parseColor(value) {
  const v = value.trim()
  if (v.startsWith('#')) return [...hexToRgb(v), 1]
  const m = v.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()))
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
  }
  throw new Error(`无法解析颜色：${value}`)
}

function channelLum(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]) {
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b)
}

function contrast(fg, bg) {
  const L1 = luminance(fg)
  const L2 = luminance(bg)
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1]
  return (hi + 0.05) / (lo + 0.05)
}

/** 把带 alpha 的前景色叠加到不透明背景上，返回不透明结果 */
function over(fg, bg) {
  const a = fg[3]
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a)))
}

/** `color-mix(in srgb, C p%, transparent)` 叠加到 bg 上的结果 */
function mixOver(color, pct, bg) {
  return over([...color.slice(0, 3), pct], bg)
}

/** 从令牌名取色（支持 rgba 与 hex） */
const T = (theme, name) => parseColor(theme[`--${name}`])

/** 六组粉彩的「底 / 字」令牌名 */
const PASTELS = [
  ['peach', 'peach-fg'],
  ['mint', 'mint-fg'],
  ['lav', 'lav-fg'],
  ['sky', 'sky-fg'],
  ['rose', 'rose-fg'],
  ['butter', 'butter-fg'],
]

// ---------------------------------------------------------------- 断言表

/** 每条：[说明, 前景, 背景, 要求, 是否反例] */
function buildChecks(theme, label, isDark) {
  const bg = T(theme, 'bg')
  const surface = T(theme, 'surface')
  const surfaceHover = T(theme, 'surface-hover')
  const wash = T(theme, 'wash')
  const brand = T(theme, 'brand')
  const brandFg = T(theme, 'brand-fg')
  const brandSoft = T(theme, 'brand-soft')
  const invertBg = T(theme, 'invert-bg')
  const invertFg = T(theme, 'invert-fg')
  const danger = T(theme, 'danger')
  const dangerSoft = T(theme, 'danger-soft')
  const success = T(theme, 'success')
  const warning = T(theme, 'warning')
  const text = T(theme, 'text')
  const textSecondary = T(theme, 'text-secondary')
  const textMuted = T(theme, 'text-muted')
  const codeBg = T(theme, 'code-bg')
  const mark = T(theme, 'mark')
  const white = [255, 255, 255, 1]

  const checks = [
    // 文字层级
    [`${label} 主标题/正文强调  --text on --bg`, text, bg, 4.5],
    [`${label} 正文段落        --text-secondary on --bg`, textSecondary, bg, 4.5],
    [`${label} 元信息          --text-muted on --bg`, textMuted, bg, 4.5],
    [`${label} 正文内链接      --brand on --bg`, brand, bg, 4.5],
    [`${label} 主按钮文字      --brand-fg on --brand`, brandFg, brand, 4.5],
    [`${label} 描边按钮文字    --text on --surface`, text, surface, 4.5],
    [`${label} 幽灵按钮文字    --text-secondary on --surface`, textSecondary, surface, 4.5],
    [`${label} 危险按钮文字    --danger on --bg`, danger, bg, 4.5],
    // 反相块
    [`${label} 反相块(导航激活) --invert-fg on --invert-bg`, invertFg, invertBg, 4.5],
    // admin 状态筛选：--brand 填充 + --invert-fg 文字
    [`${label} admin 筛选激活   --invert-fg on --brand`, invertFg, brand, 4.5],
    // 内联代码 / 表头
    [`${label} 内联代码        --text on --surface-hover`, text, surfaceHover, 4.5],
    [`${label} 元信息 on 悬停底 --text-muted on --surface-hover`, textMuted, surfaceHover, 4.5],
    // 表头（预览 table th = --brand-soft 底 + --text）
    [`${label} 表头文字        --text on --brand-soft`, text, brandSoft, 4.5],
    // 搜索结果命中（mark 现在是荧光笔渐变，文字仍为 --text）
    [`${label} 搜索命中 mark  --text on brand-soft(bg 上叠)`, text, over(brandSoft, bg), 4.5],
    // 荧光笔强调：--mark 底 + --text 字（Preview .hl / markdown <mark>）
    [`${label} 荧光笔强调      --text on --mark`, text, mark, 4.5],
    [`${label} 荧光笔标题      --text on --mark（h2 高亮同理）`, text, mark, 4.5],
    // 引用块（手账引文：--butter 底 + --text 正文 + --text-muted 署名）
    [`${label} 引文正文        --text on --butter`, text, T(theme, 'butter'), 4.5],
    [`${label} 引文署名        --text-muted on --butter`, textMuted, T(theme, 'butter'), 4.5],
    // 图片占位 / 图集空态底上的说明文字
    [`${label} 占位底说明文字  --text-muted on --wash`, textMuted, wash, 4.5],
    // 错误态
    [`${label} 错误提示        --danger on --bg`, danger, bg, 4.5],
    [`${label} 错误提示 alert  --danger on --danger-soft`, danger, dangerSoft, 4.5],
    // admin 语义态（文字形态 + 15% 洗底）
    [`${label} admin 成功态文字 --success on --bg`, success, bg, 4.5],
    [`${label} admin 成功态文字 --success on success 15% 洗底`, success, mixOver(success, 0.15, bg), 4.5],
    [`${label} admin 警告态文字 --warning on --bg`, warning, bg, 4.5],
    [`${label} admin 警告态文字 --warning on warning 15% 洗底`, warning, mixOver(warning, 0.15, bg), 4.5],
    // admin 状态实心填充（填充上的文字用 --brand-fg）
    [`${label} 危险态实心填充   --brand-fg on --danger`, brandFg, danger, 4.5],
    [`${label} 成功态实心填充   --brand-fg on --success`, brandFg, success, 4.5],
    [`${label} 警告态实心填充   --brand-fg on --warning`, brandFg, warning, 4.5],
  ]

  // ---- 六组粉彩：底/字成对 + **必须不透明** ----
  for (const [base, fg] of PASTELS) {
    const bgc = T(theme, base)
    const fgc = T(theme, fg)
    checks.push([`${label} 贴纸 ${base.padEnd(7)}     --${fg} on --${base}`, fgc, bgc, 4.5])
    // 半透明粉彩是经典陷阱：文字色其实是"叠在卡片底色上"的合成色，
    // 而合成色在不同底色上比值会漂。这里断言 alpha 必须是 1。
    checks.push([`${label} 贴纸 ${base.padEnd(7)}     底不透明（alpha=1）`, fgc, bgc, 4.5])
    if (bgc[3] !== 1 || fgc[3] !== 1) {
      checks[checks.length - 1][4] = true // 标记为"应当失败"
    }
  }

  // ---- 对照样本（仅暗色）：证明「白字 + 语义色填充」在暗色下必然失败 ----
  // 该组合已无任何真实调用点，仅作反例保留。
  // 亮色下不加这条：亮色的白字压深红恰好达标 —— 也就是说
  // 「只在亮色验」根本发现不了问题，必须两个主题都跑。
  if (isDark) {
    checks.push([`${label} 【反例】白字 on 语义填充 #FFFFFF on --danger`, white, danger, 4.5, true])
    checks.push([`${label} 【反例】白字 on 语义填充 #FFFFFF on --warning`, white, warning, 4.5, true])
  }

  // 代码 token（4 个 --hl-* 对 --code-bg 均 ≥ 4.5:1）
  checks.push([`${label} 代码 token --hl-fg on --code-bg`, T(theme, 'hl-fg'), codeBg, 4.5])
  checks.push([`${label} 代码 token --hl-muted on --code-bg`, T(theme, 'hl-muted'), codeBg, 4.5])
  checks.push([`${label} 代码 token --hl-red on --code-bg`, T(theme, 'hl-red'), codeBg, 4.5])
  checks.push([`${label} 代码 token --hl-blue on --code-bg`, T(theme, 'hl-blue'), codeBg, 4.5])

  // 表单控件边界（WCAG 1.4.11：非文本 UI 组件边界需 ≥ 3:1）。
  // 装饰性发丝线 --border 不受 1.4.11 约束，故只有 --border-strong 走这条。
  // 阈值刻意用 3 而不是 4.5 —— 这是边界识别要求，不是文字可读要求。
  checks.push([`${label} 表单控件边界 --border-strong on --bg`, T(theme, 'border-strong'), bg, 3])
  checks.push([`${label} 表单控件边界 --border-strong on --surface`, T(theme, 'border-strong'), surface, 3])

  return checks
}

const rows = [...buildChecks(light, '亮色', false), ...buildChecks(dark, '暗色', true)]

let failed = 0
console.log('='.repeat(78))
console.log('对比度校验（WCAG 2.1 相对亮度公式；文字 4.5:1 / 非文本边界 3:1）')
console.log('='.repeat(78))
for (const [label, fg, bg, min, expectFail] of rows) {
  const ratio = contrast(fg, bg)
  const meets = ratio >= min
  // expectFail=true 的「反例」样本：达标才算失败（说明我们漏改了某处填充上的文字）
  const ok = expectFail ? !meets : meets
  if (!ok) failed++
  const tag = expectFail ? (meets ? 'FAIL' : 'REF ') : meets ? 'PASS' : 'FAIL'
  console.log(`${tag}  ${ratio.toFixed(2).padStart(6)}:1  (需 ≥${min})  ${label}`)
}

// 额外：断言"亮/暗 token 确实不同色"（这是换肤的核心）
console.log('\n' + '='.repeat(78))
console.log('亮 / 暗 令牌差异断言（§12 #8：无元素沿用另一主题的颜色）')
console.log('='.repeat(78))
const themeTokens = [
  'bg', 'surface', 'surface-hover', 'border', 'border-strong', 'rule', 'text', 'text-secondary',
  'text-muted', 'brand', 'brand-hover', 'brand-fg', 'brand-soft', 'wash', 'mark', 'invert-bg',
  'invert-fg', 'danger', 'danger-soft', 'warning', 'success', 'code-bg', 'code-border',
  'hl-fg', 'hl-muted', 'hl-red', 'hl-blue',
  ...PASTELS.flat(),
]
let sameCount = 0
for (const name of themeTokens) {
  const l = light[`--${name}`]
  const d = dark[`--${name}`]
  const same = l !== undefined && l === d
  if (l === undefined || d === undefined) {
    console.log(`SKIP  --${name} 缺失（亮色=${l ?? '—'} 暗色=${d ?? '—'}）`)
    failed++
    continue
  }
  if (same) {
    sameCount++
    console.log(`FAIL  --${name} 亮暗同值：${l}`)
  } else {
    console.log(`PASS  --${name.padEnd(16)} 亮 ${String(l).padEnd(28)} 暗 ${d}`)
  }
}

console.log('\n' + '='.repeat(78))
console.log(
  failed === 0
    ? `结果：全部通过（${rows.length} 条对比度断言 + ${themeTokens.length - sameCount} 项亮暗差异断言）`
    : `结果：${failed} 项失败`
)
process.exit(failed === 0 ? 0 : 1)
