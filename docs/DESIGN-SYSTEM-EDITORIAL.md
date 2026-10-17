# Lei-Blog 设计系统 —— 杂志化编辑风（Editorial / Magazine）

> ## ⚠️ 本文档已被 `DESIGN-SYSTEM-JOURNAL.md`（轻松手账风）取代，仅作历史存档
>
> 用户对杂志化编辑风的反馈是「**有点太正式了**」，第三轮方向已改为**轻松手账风**。
> 本文档描述的令牌、组件与规格**不再代表当前线上样式**，保留仅为：
> 记录第二轮的决策依据、被继承的工程纪律、以及对比度实测方法论。
> **要改样式请以 `DESIGN-SYSTEM-JOURNAL.md` 为准。**
>
> 状态（存档）：第二轮「杂志化编辑风」已落地，commit `2f9be97`。
> 上一版《瑞士现代主义》（`DESIGN-SYSTEM-SWISS.md`）已被本方向取代，
> 仅保留其被继承的工程纪律（令牌单一来源、标题字重单一真源、三态防闪白契约、TOC 三值联动、对比度实测）。
>
> 视觉基准：`C:\Users\雷磊\WorkBuddy\2026-10-06-00-34-50\lei-blog-editorial-preview.html`
> （用户已验收）。本文件是把该预览翻译成项目真实 token / 组件的规格。

---

## 0. 为什么换方向

瑞士现代主义（`08249c2` + `6dc1974`）通过了 QA 与无障碍验收，但用户反馈 **「太素了」**，
并补了一条改变设计目标的信息：**这个博客不只写技术，还要记录生活**。

因此本轮不是修 bug，是**换视觉语言**：

- 继承：令牌架构、标题字重单一真源、三态防闪白、TOC 三值联动、对比度实测方法、零圆角纪律。
- 更换：冷纸白 → **暖纸**；无衬线标题 → **衬线标题**；中性强调 → **强调红 kicker**；
  增加杂志排版的 8 个视觉元素。

---

## 1. 设计令牌（`src/index.css` 的 `:root` / `.dark`）

语义名**刻意沿用瑞士风那套**，只换值 —— 保住已验证的 a11y 结论与全部调用点。

| 令牌 | 亮色 | 暗色 | 对比度（亮 / 暗） | 用途 |
|---|---|---|---|---|
| `--bg` | `#FBF9F6` | `#0E0D0C` | — | 页面底（暖纸） |
| `--surface` | `#FFFFFF` | `#171513` | — | 卡片 / 面板底 |
| `--surface-hover` | `#F4F0E9` | `#221E1B` | — | 悬停填充 / 行内代码底 / 表头 |
| `--border` | `#E4DFD8` | `#2E2A26` | — | 装饰性发丝线（不受 1.4.11 约束） |
| **`--border-strong`** | `#857E74` | `#6E6862` | **3.82 / 3.53** | **表单控件边界**（WCAG 1.4.11 ≥3:1） |
| `--rule` | `#111111` | `#F5F3F0` | — | 结构线（页头分隔 / h2 上沿 / hr） |
| `--text` | `#111111` | `#F5F3F0` | 17.97 / 17.53 | 标题 / 强调 |
| `--text-secondary` | `#444444` | `#B8B3AD` | 9.27 / 9.33 | 正文段落 |
| `--text-muted` | `#6B6B6B` | `#8A857E` | 5.07 / 5.30 | 元信息 / placeholder |
| `--brand` | `#E4002B` | `#FF4D4D` | 4.61 / 5.94 | kicker / 链接 / 编号 / 焦点 |
| `--brand-hover` | `#C1001F` | `#FF7070` | — | 实心按钮悬停 |
| `--brand-fg` | `#FFFFFF` | `#0B0B0B` | 4.85 / 6.02 | 强调填充上的文字 |
| `--wash` | `#F1EDE6` | `#1F1C1A` | — | 图片占位底 / 图集空态底 |
| `--invert-bg` / `--invert-fg` | `#111` / `#FFF` | `#F5F3F0` / `#0B0B0B` | — | 导航激活 / 反相块 |
| `--danger` | `#B3001B` | `#FF6B6B` | 7.55 / 7.28 | **仅作文字色** |
| `--warning` | `#8A5A00` | `#F5C542` | 6.05 / 12.42 | 仅作文字色 |
| `--success` | `#14663C` | `#4ADE80` | 7.15 / 11.51 | 仅作文字色 |
| `--code-bg` | `#F3F0EB` | `#1B1917` | — | 代码块底 |
| `--hl-fg / muted / red / blue` | `#111 / #5A5A5A / #B3001B / #0B5FA5` | `#F5F3F0 / #9A948C / #FF6B6B / #79C0FF` | 最低 5.78 / 5.83 | 代码 token（各对 `--code-bg` ≥4.5:1） |

**约束**：`--danger / --warning / --success` **只当文字色**，不当填充色。
全项目无把它们当背景的调用点；`verify-contrast.mjs` 保留了「白字压语义填充」的反例
（暗色 2.78 / 1.62:1）作为回归护栏。

实测命令：`node scripts/verify-contrast.mjs` → **60 条对比度断言 + 25 项亮暗差异断言，全部通过**。

---

## 2. 字体

| 用途 | 方案 | 字节 |
|---|---|---|
| 中文标题 | **系统衬线栈**（零字节） | 0 |
| 拉丁显示衬线 | **Newsreader** 自托管，仅 600 / opsz=72 一个静态切 | **26,428 B（25.81 KiB）** |
| 正文 | 系统无衬线栈（不变） | 0 |

```css
--font-display: 'Newsreader', 'Noto Serif SC', 'Source Han Serif SC',
  'Songti SC', 'STSong', 'SimSun', Georgia, serif;
```

**中文为什么不自托管**：正文字符集存在 PostgreSQL，构建期拿不到，无法子集化；
自托管中文 webfont 要么几十 MB 要么漏字。**系统栈是唯一的零字节正解**。
（`font-test.png` 显示思源宋体效果最佳、SimSun 兜底、楷体排除 —— 已按此排序。）

**Newsreader 为什么是单一切**：`opsz` 变轴保持 6..72 时文件 71.2 KB（超预算）；
用 `fontTools.varLib.instancer` 把 `opsz` 钉到 72、`wght` 钉到 600 后再子集化 → 25.9 KB。
代价：衬线场景必须显式写 `font-weight: 600`（已写进 `index.css` 的 `h1~h4`、
`blockquote`、首字下沉规则里）。

**Archivo 去留结论：删除。** 杂志化后标题全部改走衬线，Archivo 是上一轮的**无衬线标题字**，
全库检索后**零消费点**（仅 `fontFamily.heading` 定义 + 旧 `--font-heading`）。
连同 `src/assets/fonts/archivo-*.woff2`（38,752 B）、`styles/fonts.css` 的 @font-face、
`tailwind.config.ts` 的 `fontFamily.heading` 一并移除 → **净减 38,752 B**。

---

## 3. 排印尺度（`tailwind.config.ts` → `fontSize`）

| 刻度 | 值 | 用途 |
|---|---|---|
| `text-xl` | 19px / 1.4 / -0.01em | 卡片标题 |
| `text-2xl` | 27px / 1.28 / -0.015em | 正文 h2 |
| `text-3xl` | 36px / 1.12 / -0.02em | 页面 h1 |
| `text-post-title` | `clamp(34px, 5.2vw, 60px)` / 1.12 / -0.02em | 文章详情标题 |
| `text-eyebrow` | 11px / +0.18em（大写） | kicker / 眉标 |
| `text-meta` | 13px / +0.04em（等宽） | 日期 / 阅读时长 / 编号 |

`text-4xl` 已删除（文章标题改用 clamp 后零消费点）。

---

## 4. 标题字重（唯一真源，仍是硬约束）

Tailwind **v3** 会把 `@layer` 展平，产物 CSS 里 **0 个原生级联层** ⇒ 具体度决胜
⇒ `.font-bold`(0,1,0) 压过 `h2`(0,0,1)。所以：

> **标题元素（h1~h6）不得携带任何 `font-{bold,semibold,medium,…}` utility。**
> 字重一律由 `index.css` 的非分层 `h1,h2,h3,h4 { font-weight: 600 }` 单一决定。

杂志化统一 600：层级靠**字号与颜色**区分，不靠字重（预览 `h1.hero` 也是 600）。

审计：`grep -rnE "<h[1-6][^>]*font-" src` → **0 命中**（运行时亦有 70 项断言覆盖）。

---

## 5. 八个杂志化视觉元素

| # | 元素 | 类 / 选择器 | 关键规格 |
|---|---|---|---|
| 1 | 红色小标 kicker | `.t-kicker` | 11px/600/大写/+0.18em，`--brand`；`::after` 自动伸展 1px `--border` 细线 |
| 2 | 双细线 | `.rule-double` | 上 3px `--rule` + 5px 间距 + 1px `--rule`，宽由调用处给（`w-16`） |
| 3 | 编号章节 | `.markdown-body h2` | 上沿 1px `--rule` + `counter(section, decimal-leading-zero)` 红色等宽编号（`::before`） |
| 4 | 首字下沉 | `.markdown-body > p:first-of-type::first-letter` | 衬线 / 64px / line-height .82 / float:left / 右 12px。**只对第一段** |
| 5 | 红边引文 | `.markdown-body blockquote` | 左 3px `--brand` + 左内边距 22px + 衬线 23px/1.6；`small`/`cite` 走等宽署名 |
| 6 | 封面大图 16:8.2 | `figure.hairline-frame.aspect-[16/8.2]` | `--wash` 底 + `inset 0 0 0 1px --border` 内描边（**box-shadow 非 border**，避免尺寸跳动） |
| 7 | 图集网格（3 列） | `.md-gallery` / `.md-gallery-item` | `repeat(3,1fr)` gap 10px；首张 `.wide` 跨 2 列 2:1，其余 1:1；每格内描边；`≤760px` 降 2 列 |
| 8 | 列表卡片 3:2 | `.card-media` | `--surface` + 1px `--border`；封面 `aspect-[3/2]`；hover `translateY(-3px)` |

内描边统一用 `.hairline-frame::after` + `box-shadow: inset`（不占布局、不与邻格叠加变粗）。

---

## 6. ⚠️ 无封面图状态（最关键的工程约束）

**生产库 4 篇文章的 `cover_image` 全为 `NULL`**（`VARCHAR(500)` nullable，未改 schema）。
所以版式**绝不能依赖封面图**：

- **列表卡片**：`cover_image` 为假 → **整块封面区不渲染**（不留空高框）。
  网格容器用 `items-start`，让每张卡按自身内容取高，行内不被拉高。
- **文章详情**：无封面 → 不渲染 `figure.hairline-frame`，标题下直接接「双细线」，
  文章以文字 + 首字下沉开场。
- **外链图加载失败**：`img onError` 把 `img` 隐藏（`visibility:hidden`），
  由 `--wash` 底色 + 内描边兜底，**不出现浏览器破图图标**。

三处（详情 / 卡片 / 归档）均已覆盖，并有截图与运行时断言（`figure.hairline-frame 数=0`）作证。

---

## 7. 图集从何而来（不改 schema）

数据库没有「图集」字段，本次禁止改 schema。于是新增一个 rehype 插件
`src/utils/rehypeGallery.ts`，把正文里**连续的纯图片段落**收成杂志图集：

- 连续 1 张 → `<figure class="md-figure">`（+ `<figcaption>`）
- 连续 ≥2 张 → `<div class="md-gallery">`，≥3 张时首张加 `wide`
- ⚠️ 实现要点：`remark-rehype` 会在块级元素之间插入 `\n` 文本节点，
  收集连续段落时**必须跳过这些空白文本节点**，否则每张图各成一组、永远退化成单图。

---

## 8. 不可破坏的契约

| 契约 | 位置 | 要求 |
|---|---|---|
| 防闪烁内联脚本 | `client/index.html` | **diff 为空** |
| 主题上下文 | `src/context/ThemeContext.tsx` | **diff 为空** |
| 导航栏高度 | `Navbar.tsx` `h-16` | 保持 64px |
| TOC 三值联动 | `TocSidebar` `rootMargin: '-88px 0px -60% 0px'` / `.markdown-body h2[id]{scroll-margin-top:88px}` / Navbar `h-16` | 三处**成对**改动 |
| 标题字重 | 见 §4 | 标题不带 font-* utility |
| schema / i18n | — | 不改 schema、不新增 i18n key |

---

## 9. 验证入口

```bash
cd client
npm run build                 # 三绿之一：tsc -b && vite build
npx eslint .                  # 三绿之二
node scripts/verify-contrast.mjs    # 60 对比度 + 25 差异断言
node scripts/verify-runtime.mjs     # 70 项真机断言（含防闪白逐帧 / 无横向滚动 / 8 元素 / 图集 / NULL 封面）
node scripts/screenshot.mjs [outdir] # 6 张真实构建产物截图
```
