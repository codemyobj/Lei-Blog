# Lei-Blog 设计系统 —— 轻松手账风（Journal）

> 状态：**已落地**。本文件是当前生效的视觉规范（第三轮方向）。
>
> 前两轮（`DESIGN-SYSTEM-SWISS.md` 瑞士现代主义、`DESIGN-SYSTEM-EDITORIAL.md`
> 杂志化编辑风）均已**被本方向取代**，文件头部已加存档说明，仅作历史交付物保留。
>
> 视觉基准：`C:\Users\雷磊\WorkBuddy\2026-10-06-00-34-50\lei-blog-journal-preview.html`
> （用户已验收）。本文件是把该预览翻译成项目真实 token / 组件的规格。

---

## 0. 为什么换方向

| 轮次 | 方向 | 用户反馈 |
|---|---|---|
| 1 | 瑞士现代主义（`08249c2` + `6dc1974`） | 「太素了」+ 博客不只技术，还要记录生活 |
| 2 | 杂志化编辑风（`2f9be97`） | 「有点太正式了」 |
| 3 | **轻松手账风（本版）** | 已验收 |

**继承的工程纪律**（三轮共用，不要丢）：

- 令牌单一来源（`src/index.css` 的 `:root` / `.dark`）
- 标题字重单一真源 + 「标题不带 font-* utility」约定
- 三态主题防闪白契约（`index.html` 内联脚本 + `ThemeContext.tsx`，diff 必须为空）
- TOC 三值联动：`rootMargin: '-88px 0px -60% 0px'` / `scroll-margin-top: 88px` / Navbar `h-16`
- 对比度**亮暗双测**（只测亮色会掩盖暗色缺陷，前两轮都踩过）
- 零圆角 → **本轮恢复圆角**（见 §4）

**更换的视觉语言**：冷/暖纸 → 暖纸；衬线标题 → **黑体标题**；编号章节 / 首字下沉 / 双细线
→ **全部移除**；新增涂鸦层、和纸胶带、荧光笔、粉彩贴纸。

---

## 1. 设计令牌（`src/index.css` 的 `:root` / `.dark`）

语义名沿用前两轮，只换值 + 新增。

### 亮色

| 令牌 | 值 | 对比度 | 用途 |
|---|---|---|---|
| `--bg` | `#FBF8F3` | — | 暖纸底（不再有点阵背景，涂鸦层取而代之） |
| `--surface` | `#FFFFFF` | — | 卡片底 |
| `--surface-hover` | `#F7F3EC` | — | 悬停填充 / 表头底 / 行内代码底 |
| `--border` | `#EDE7DC` | — | 装饰发丝线（不受 1.4.11 约束） |
| `--border-strong` | `#948B7E` | **3.17 / 3.36** | 表单控件边界（WCAG 1.4.11 ≥3:1） |
| `--rule` | `#D8D0C2` | — | 结构线：hr、footer 上沿、归档年份分隔 |
| `--text` | `#2A2724` | 14.02 | 标题 / 强调 |
| `--text-secondary` | `#5C564E` | 6.84 | 正文段落 |
| `--text-muted` | `#766E64` | 4.74 | 元信息 / placeholder |
| `--brand` | `#C2410C` | 4.89 / 5.18 | 珊瑚橘：手写标注 / 链接 / 焦点 |
| `--brand-hover` | `#9A3412` | — | 悬停加深 |
| `--brand-fg` | `#FFFFFF` | 5.18 | 实心按钮上的字 |
| `--brand-soft` | `#FFEADB` | — | 选中底 / 搜索命中底 / 表头底 |
| `--wash` | `#F7F3EC` | — | 图片占位底 / 图集空态底 |
| `--mark` | `#FBE9B8` | 12.34 | 荧光笔：黄油 |
| `--shadow` / `--shadow-lg` | 两层软阴影 | — | 卡片 / hover |

### 暗色主令牌

| 令牌 | 值 | 对比度 |
|---|---|---|
| `--bg` | `#17140F` | — |
| `--surface` | `#221E18` | — |
| `--surface-hover` | `#2A251E` | — |
| `--border` | `#322C24` | — |
| `--border-strong` | `#6F685C` | **3.33（bg）/ 3.01（surface）** |
| `--rule` | `#3E3830` | — |
| `--text` | `#F2EDE4` | 15.75 |
| `--text-secondary` | `#BDB5A8` | 9.04 |
| `--text-muted` | `#A49C8C` | 6.75（bg） |
| `--brand` | `#FDBA74` | 10.89 |
| `--brand-fg` | `#17140F` | 6.02 |
| `--brand-soft` | `#3D2A1D` | — |
| `--wash` | `#241F19` | — |
| `--code-bg` | `#1B1813` | — |
| `--mark` | `#4A3A1C` | 9.41 |

**⚠️ 两处偏离规格原值**（都是实测后调的，规格也要求"不达标就调"）：

1. **暗色 `--text-muted`**：规格值 `#8F877A` 只在对 `--bg` 时达标（5.17:1）。
   但它还会出现在 `--surface-hover`（**4.28:1 不达标**）与引文块 `--butter`
   （**3.62:1 不达标**）上。已提亮到 `#A49C8C`：butter 4.73 / wash 6.00 /
   surface-hover 5.58 / bg 6.75，全部达标，且与 `--text-secondary` 仍有 1.39 的
   相对亮度层级差。这正是「只在一个底色上测会掩盖暗色缺陷」的活例。
2. **暗色 `--border-strong`**：规格值 `#6F685C`，实测 **3.008:1**（对 `--surface`）
   —— 达标但只剩 0.008 余量。若想留余量，`#7A736C` 为 3.55/3.93。

### 六组粉彩（贴纸标签 / 引文底）

| 名称 | 亮底 | 亮字 | 亮对比度 | 暗底 | 暗字 | 暗对比度 |
|---|---|---|---|---|---|---|
| peach | `#FFEADB` | `#9A3412` | 6.28 | `#3D2A1D` | `#FDBA74` | 8.05 |
| mint | `#DCF5E8` | `#065F46` | 6.68 | `#16332A` | `#5EEAD4` | 9.21 |
| lav | `#EAE4FA` | `#5B21B6` | 7.26 | `#2A2450` | `#C4B5FD` | 7.76 |
| sky | `#DDEBFB` | `#1E40AF` | 7.21 | `#1B2C48` | `#93C5FD` | 7.76 |
| rose | `#FDE3E7` | `#9F1239` | 6.61 | `#3F1E24` | `#FDA4AF` | 7.81 |
| butter | `#FBF3D3` | `#854D0E` | 6.15 | `#3A3117` | `#FCD34D` | 8.93 |

**粉彩一律不透明（alpha=1）**：`verify-contrast.mjs` 对每组都加了一条
「底不透明」断言 —— 半透明粉彩会让文字色随底层底色漂移，是经典陷阱。
贴纸因此只放在 `--surface` / `--bg` 实底上，**不叠在图片上**。

实测命令：`node scripts/verify-contrast.mjs` → **94 条对比度断言 + 39 项亮暗差异断言，全部通过**。

---

## 2. 字体（**全站零自托管字体**）

| 用途 | 方案 | 字节 |
|---|---|---|
| 中文（正文 + 标题） | 系统黑体栈：PingFang SC / HarmonyOS Sans SC / MiSans / Microsoft YaHei | **0** |
| 手写标注 / 引文 / 图注 | 系统楷体栈：KaiTi / STKaiti / Kaiti SC / Baskerville | **0** |
| 等宽 meta | 系统等宽栈 | **0** |
| 自托管 webfont | **无** | **0** |

```css
--font-sans:    'PingFang SC','HarmonyOS Sans SC','MiSans','Microsoft YaHei',system-ui,-apple-system,'Segoe UI',sans-serif;
--font-display: 同上;                          /* 标题与正文同族：手账风的标题就是黑体 */
--font-hand:    'KaiTi','STKaiti','Kaiti SC','Baskerville',cursive;
--font-mono:    ui-monospace,'Cascadia Code',Consolas,monospace;
```

**中文为什么零字节**：正文存在 PostgreSQL，构建期拿不到字符集，无法子集化；
自托管中文 webfont 要么几十 MB 要么漏字。三轮都已验证这个结论。

**字体资产清理**：Newsreader（26,428 B）与 Archivo（38,752 B）**全部删除**，
`src/styles/fonts.css`、`scripts/fetch-fonts.mjs`、`scripts/subset-fonts.sh`
一并移除。**净减 65,180 B**，dist 里 woff2 数量为 **0**。

---

## 3. 标题字重（唯一真源，仍是硬约束）

Tailwind **v3** 会把 `@layer` 展平，产物 CSS 里 **0 个原生级联层** ⇒ 具体度决胜
⇒ `.font-bold`(0,1,0) 压过 `h2`(0,0,1)。所以：

> **标题元素（h1~h6）不得携带任何 `font-{bold,semibold,medium,…}` utility。**
> 字重一律由 `index.css` 的非分层 `h1,h2,h3,h4 { font-weight: 700 }` 单一决定。

手账风统一 **700**，层级区分靠字号、颜色与荧光笔高亮，不靠字重。

审计：`grep -rnE "<h[1-6][^>]*font-" src` → **0 命中**；运行时另注入
`<h2 class="font-bold">` 反面用例实测（700，与 CSS 同值，仍证明 utility 会赢）。

---

## 4. 圆角体系（本轮恢复）

瑞士风那轮把 `borderRadius` 全设成 0，手账感完全不成立。本轮恢复：

| 对象 | 圆角 | Tailwind 刻度 |
|---|---|---|
| 卡片 | 16px | `rounded-2xl` |
| 代码块 / 表格 / 引文 | 14px | `rounded-xl` |
| 图集格 / 单图 | 12px | `rounded-lg` |
| 输入框 | 10px | `rounded-md` |
| 行内代码 / 荧光笔标题 | 6px / 3px | `rounded` / `rounded-sm` |
| 标签 / 按钮 | 999px（pill） | `rounded-full` |

`tailwind.config.ts` 的 `borderRadius` 与 `boxShadow` 都已显式定义（含暗色阴影差异
由 `--shadow` 变量承担，工具类只作兜底）。

---

## 5. 组件清单

| 类 / 组件 | 文件 | 关键规格 |
|---|---|---|
| `.t-kicker` | `index.css` | 手写小标注：`--font-hand` + `--brand` + 14px + `::before{content:'✎ '}` |
| `.t-eyebrow` | `index.css` | 中性眉标（TOC / 评论区标题），手写体 + `--text-muted` |
| `.t-meta` | `index.css` | 等宽 13px 元信息 |
| `.t-lead` | `index.css` | 导语 18px / 1.85 |
| `.card` / `.card-hover` | `index.css` | 16px 圆角 + `--shadow` + 1px `--border`；hover `translateY(-4px)` + `--shadow-lg` |
| `.card-media` | `index.css` | 封面图卡；**不设 `overflow:hidden`**（和纸胶带在 `top:-9px`） |
| `.card-cover` | `index.css` | 卡封面：`--wash` 底 + 上圆角 16px |
| `.tape` / `.tape.mint` / `.tape.lav` | `index.css` | 和纸胶带：`color-mix(brand 20%, transparent)` 斜贴 |
| `.pastel-*` | `index.css` | 六组粉彩底/字成对 |
| `.tag-badge` | `index.css` | 贴纸 pill：999px + 粉彩（JS 取模加上） |
| `.hairline-frame` | `index.css` | 大封面：`--wash` + 16px 圆角 + inset 1px `--border` |
| `Doodles` | `components/Doodles.tsx` | 涂鸦层，见 §6 |
| `.md-gallery` / `-item` | `index.css` | 3 列图集，首格 `.wide` 跨 2 列 2:1，格圆角 12px |

### Markdown 正文（`.markdown-body`）

| 元素 | 规格 |
|---|---|
| 容器 | 16px / 1.75，`max-width: 66ch` |
| `h2` | 26px / 700 / **荧光笔高亮**（`linear-gradient(transparent 58%, var(--mark) 58%, var(--mark) 94%, transparent 94%)`），`width:fit-content` 让高亮只包住文字，`padding:0 2px`，`border-radius:3px` |
| `h3` / `h4` | 19px / 16px，700 |
| `blockquote` | `--butter` 底 + 14px 圆角 + `padding:22px 26px` + 左上 Georgia 52px 35% 透明大引号；正文 `--font-hand` 20px；`small`/`cite` 手写 13px `--text-muted` |
| `pre` | `--code-bg` + 14px 圆角 + 1px `--code-border` |
| `table` | `border-collapse:separate` + `border-spacing:0` + 14px 圆角 + `overflow:hidden`；表头 `--brand-soft` 底 |
| `.md-figure` / `.md-gallery-item` | 16px / 12px 圆角 + inset 1px `--border` + `--wash` 兜底 |
| `hr` | 1px `--rule` **虚线** |
| `mark` / `.hl` | 荧光笔渐变 + `--text` 字 + `font-weight:600` |
### Markdown 扩展约定

正文里用 `==要强调的文字==` 得到荧光笔效果，由 `src/utils/remarkHighlight.ts`
在 **mdast 层**转成 `<mark class="hl">`（`data.hName='mark'`，语义正确）。

> **⚠️ 为什么不是 `<mark>文字</mark>`（原方案）**
> **react-markdown v10 默认不渲染原始 HTML**，`remark-rehype` 会把行内 HTML 标签
> **直接剥掉**（连 raw 节点都不留，只留下纯文本）。实测：写 `<mark>空白</mark>`
> 渲染出来就是"空白"两个字，页面上 **0 个 `<mark>`**。
> 要让 `<mark>` 生效必须引 `rehype-raw`，那等于允许正文写任意 HTML（含 `<script>`）——
> 为一个高亮效果打开存储型 XSS 面，不值得。所以改用在 mdast 层转换的纯 Markdown 语法，
> 零新依赖、零安全变化。

**限制**：高亮内部**不再解析行内 Markdown**，所以 `==含 **粗体** 的文字==` 里的
`**` 会原样显示；需要混排时把粗体放到高亮外面。内容里不能含单个 `=`。

**引文署名**：同样因为原始 HTML 不可用，署名改用**位置约定** —— 引文的**最后一段**
（且引文至少两段）渲染为 13px 手写 `--text-muted`（CSS `:not(:only-child):last-child`）。
单一引文不受影响，仍是 20px 手写正文。

**搜索页的高亮**是另一套（`Highlight.tsx` 用 React 节点拼 `<mark class="search-hit">`，
天然免疫 XSS），与本规则共用同一段样式。

**文字色保持 `--text` 而不是 `--brand`** —— 荧光底上压品牌色会掉对比度。

---

## 6. 涂鸦层 `Doodles.tsx`（本轮唯一新组件）

挂在 `Layout.tsx` 里，全站生效。

**硬性约束**：

- 外层 `position:fixed; inset:0; pointer-events:none; z-index:0; overflow:hidden`
- **必须是内容层的兄弟，不是父子**：内容层 `position:relative; z-index:1`。
  若塞进内容层内部，内容层自身的 z-index 会形成层叠上下文，涂鸦（z-0）会盖在
  正常流文本之上 —— 那是 bug 不是装饰。
- `aria-hidden="true"`：屏幕阅读器完全跳过
- 五个内联 SVG（星 / 心 / 螺旋 / 波浪 / 叶子），**零字节**，不走网络
- 颜色用粉彩令牌（`--brand` / `--mint-fg` / `--lav-fg`），两主题自动适配
- `opacity:.42`，暗色 `.30`
- 响应式：`≤1240px` 隐藏螺旋/波浪/叶子（只留星和心）；`≤860px` 星缩 34px 右移 4%、
  心缩 30px 左下移

**为什么 fixed 而不是 absolute**：长文滚动时 absolute 的涂鸦会滚走；
fixed 让它们成为"常驻点缀"，且永远只在屏幕边角的留白区（内容容器 max-width 居中）。

---

## 7. ⚠️ 无封面图状态（生产库 4 篇 `cover_image` 全是 `NULL`）

- **列表卡**：无封面 → **整块封面区不渲染 + 不贴胶带**，卡片从标题开始，
  顶部多留 8px 气口；网格容器 `items-start` 保证每张卡按自身内容取高。
- **文章详情**：无封面 → 不渲染 `figure.hairline-frame`，标题下直接接一条
  `--rule` 细线，文章以文字开场。
- **外链图会挂**：`img onError` 隐藏 img，由 `--wash` 底色 + 圆角兜底，无破图图标。
- 三处（详情 / 卡片 / 归档）均已覆盖，有截图 + 运行时断言（`figure.hairline-frame 数=0`）作证。

---

## 8. 不可破坏的契约

| 契约 | 位置 | 要求 |
|---|---|---|
| 防闪烁内联脚本 | `client/index.html` | **diff 必须为空** |
| 主题上下文 | `src/context/ThemeContext.tsx` / `ThemeProvider.tsx` | **diff 必须为空** |
| 导航栏高度 | `Navbar.tsx` `h-16` | 保持 64px |
| TOC 三值联动 | `TocSidebar` `rootMargin` / `.markdown-body h2[id]{scroll-margin-top}` / Navbar `h-16` | 三处**成对**改动 |
| 标题字重 | 见 §3 | 标题不带 font-* utility |
| schema / i18n | — | 不改 schema、不新增 i18n key |

---

## 9. 验证入口

```bash
cd client
npm run build                    # 三绿之一：tsc -b && vite build
npx eslint . --max-warnings=0    # 三绿之二
node scripts/verify-contrast.mjs    # 94 对比度 + 39 差异断言
node scripts/verify-runtime.mjs     # 真机断言（防闪白逐帧 / 无横向滚动 / 手账元素 /
                                     #  涂鸦层 pointer-events+aria-hidden+响应式 / 无封面 / 标题字重）
node scripts/screenshot.mjs [outdir] # 6 张真实构建产物截图
```
