# Lei-Blog 视觉主题改造方案：瑞士现代主义 / 国际主义排版

> ## ⚠️ 本文档已被 `DESIGN-SYSTEM-JOURNAL.md`（轻松手账风）取代，仅作历史存档
>
> 用户对瑞士现代主义的反馈是「**太素了**」，第二轮改为杂志化编辑风、第三轮改为轻松手账风。
> 本文档描述的令牌、组件与规格**不再代表当前线上样式**，保留仅为：
> 记录第一轮的决策依据、以及"标题字重单一真源 / 三态防闪白 / TOC 三值联动 /
> 对比度亮暗双测"这批被后续轮次继承的工程纪律。
> **要改样式请以 `DESIGN-SYSTEM-JOURNAL.md` 为准。**
>
> 作者：高见远（架构师） · 面向：雷磊（前端，5 年经验） · 执行：工程师照文档直接落地
> 约束前提：Tailwind **v3**（不升 v4）· 静态 SPA 部署在 2C2G CVM · 不得引入运行时字体 CDN · 不得破坏线上
> 落地后必须 `tsc -b` / `eslint .` / `vite build` 全绿

---

## 0. 结论摘要

| 项 | 结论 |
|---|---|
| 强调色 | **`#E4002B`**（亮）/ **`#FF4D4D`**（暗）。理由：白底 4.85:1 过 AA；纯红 `#FF0000` 只有 3.998:1 不合格 |
| 换肤是否要改 JSX | **颜色与形状：几乎不用**（变量 + theme override）。**认证：有 8 处硬编码 `#fff` 必须改成变量** |
| 标题字体 | **Archivo**（OFL，可变字重，自托管 latin 子集 ~30KB）。正文继续系统栈，**零额外请求** |
| 中文 | **中文标题不换字体**，继续走系统黑体栈，靠 `unicode-range` 让中英自动分流。理由见 §3.3 |
| 圆角 | **全部 0**。不覆盖 `rounded-full`（保留真圆语义），改为**替换 15 处调用点** |
| 阴影 | **全部取消**，"浮起"改为"描边变深" |
| 顺带修掉 | **4 处既有 WCAG AA 违规**（不是本次引入的，见 §1.4）。改造后全站正文/次级/静音/按钮/标签**全部达标** |
| 任务规模 | P0 必需 ~12 个文件；P1 打磨 ~10 个文件；admin **自动跟随，零版面重构** |

---

## 1. 现状核实结论

我逐个读了文件，不是照描述推断。

### 1.1 主题集中化程度（你的前提成立，但有 3 个例外）

**成立**：`index.css` 的 `:root` / `.dark` 两套变量 + `@layer components` 的组件类是真正的单一来源。`tailwind.config.ts` 的 `darkMode: 'class'` 与 `index.html` 内联脚本的契约一致（键名 `theme`，值域 `light|dark|system`，脏数据回落 `system`），且 `ThemeContext.tsx:15,18` 用 `THEME_STORAGE_KEY` / `DARK_MEDIA_QUERY` 两个导出常量把「同一个约定只写一次」落实了 —— 这点做得对，改造时**不要动**。

**例外 1 —— 硬编码 `#fff`（8 处 / 7 个文件）**，全部是「填充色背景 + 白字」，绕过了变量体系：

| 文件:行 | 上下文 |
|---|---|
| `components/LanguageSwitcher.tsx:29` | 选中语言 |
| `components/ThemeSwitcher.tsx:112` | 选中主题段 |
| `components/Pagination.tsx:56` | 当前页码 |
| `components/MarkdownEditor.tsx:139` | 编辑/分栏/预览切换 |
| `pages/admin/AdminPostEditPage.tsx:186,197,222` | 草稿/已发布状态、标签多选 |
| `pages/admin/AdminPostListPage.tsx:66` | 状态筛选 |

亮色下 `#fff` 恰好对，暗色下会错。**必须改成 `var(--brand-fg)` 或 `var(--invert-fg)`。**

**例外 2 —— 代码高亮的变量重复了 4 份**：`:root`(:286-321) / `.dark`(:323-358) / `.light-code`(:363-397) / `.dark-code`(:399-433)，每份 34 个 `--hl-*`。后两份的注释说是「`.dark` 缺失时的兜底」，但 `.dark` 由 `index.html:24` 的 `document.documentElement.classList.toggle('dark', dark)` 无条件写入 `<html>`，兜底永不生效。**这是 136 行纯维护负担，删掉后两份，配色收敛成单一来源。**

**例外 3 —— `--border-light` 是死变量**：全库 `var(--border-light)` 命中 **0 次**。删。

### 1.2 变量真实消费量（决定改造影响面）

| 变量 | 引用数 | 说明 |
|---|---|---|
| `--text` | 55 | 主文字 |
| `--text-muted` | 47 | 元信息 |
| `--border` | 32 | 所有分隔线 |
| `--brand` | 30 | 链接/激活/按钮 |
| `--text-secondary` | 29 | 正文段 |
| `--danger` | 15 | 错误态 |
| `--surface` | 14 | 面板 |
| `--surface-hover` | 11 | 内联代码/表头 |
| `--brand-light` | 8 | 激活底色（语义要改，见 §7.4） |
| `--success` | 6 | 仅 admin |
| `--warning` | 4 | 仅 admin |
| `--brand-soft` | 3 | focus ring / mark |
| `--brand-hover` | **1** | 仅 `.btn-primary:hover` |
| `--border-light` | **0** | **死变量** |

### 1.3 圆角与阴影的调用点（迁移工作量真值）

`rounded-*` 在 TSX 中共 **28 处 / 17 文件**，`border-radius` 在 CSS 中 5 处。其中：

- `rounded-full` **15 处**（CSS 2 处 + TSX 13 处）→ **必须手工替换**，理由见 §7.2
- `rounded-xl` / `rounded-2xl` / `rounded-lg` → **通过 tailwind `borderRadius` override 一次归零，0 处 JSX 改动**
- `.spinner` 的 `border-radius: 50%` 写死在 CSS 里（`index.css:141`），**不受影响，保持圆形**

阴影 3 处（`.card`、`.card-hover:hover`、`Navbar` 的 `backdrop-blur-md`）。

### 1.4 ⚠️ 既有 WCAG AA 违规（本次改造顺带修掉）

我按 WCAG 2.1 相对亮度公式逐个算过，**以下 4 项在改造前就已经不达标**，与本次换肤无关，但既然重做配色就一并修复（否则新方案会把问题带进"看起来更精致"的外壳里）：

| 元素 | 现状值 | 实测对比度 | 要求 | 判定 |
|---|---|---|---|---|
| 正文链接 `.markdown-body a`（`index.css:208`） | `#3377ff` on `#ffffff` | **4.02:1** | 4.5:1 | ❌ 违规 |
| 标签 `.tag-badge` 文字（`index.css:130`） | `#3377ff` on `#eef6ff` | **3.79:1** | 4.5:1 | ❌ 违规 |
| 错误提示文字 `var(--danger)` | `#ef4444` on `#ffffff` | **3.76:1** | 4.5:1 | ❌ 违规（15 处引用） |
| admin 状态胶囊白字 | `#fff` on `--warning` `#f59e0b` | **2.15:1** | 4.5:1 | ❌ 严重违规 |
| admin 状态胶囊白字 | `#fff` on `--success` `#10b981` | **2.54:1** | 4.5:1 | ❌ 严重违规 |
| 搜索命中 `<mark>` | `var(--brand)` on 10% 品牌色洗底 | **4.07:1** | 4.5:1 | ❌ 违规（`index.css:493-500`） |
| 内联代码 | `var(--brand)` on `--surface-hover` | 亮色 4.33:1 | 4.5:1 | ❌ 违规（对 0.875em 小字尤其明显） |

**新方案全部修复，见 §2 与 §3。** 这是本次改造除了「好看」之外的实质收益。

### 1.5 其它需要知道的事实（避免踩坑）

1. **`@tailwindcss/typography` 没装**，但 `tailwind.config.ts:26-32` 有 `typography` 配置，`plugins: []` 也是空的。**该配置是死配置**，`prose` 类不可用。全站正文排版其实是 `index.css:163+` 的 `.markdown-body` 手写规则。
   **不要为了这次改造去装 typography 插件** —— 会引入一套与 `.markdown-body` 并行的第二排版体系，徒增冲突。
2. **`.markdown-body` 的规则会"压过"它内部元素的 utility —— 但靠的是特异性，不是"非分层"**。原表述「非分层 CSS 优先于所有 `@layer` utilities」**在本构建下不成立**：Tailwind v3 会把 `@layer` 展平，`dist` 里没有原生级联层（自证见 §4.4）。真正起作用的是特异性：`.markdown-body h2`(0,1,1) > `.text-2xl`(0,1,0)，所以能给 `.markdown-body` 内部元素加 utility 但可能"不生效"——排查时先看这点。（同一坑在标题元素上更危险，见 §4.4 与 §11。）
3. **`formatDate` 返回 `YYYY-MM-DD`**（`utils/formatDate.ts:10`），与语言无关 ⇒ 中英文案长度差异**不会**造成日期列宽度溢出。
4. **`Inter` 声明了但从未加载**：`tailwind.config.ts:23` 和 `index.css:55` 都把它放在字体栈首位，但全库无 `@font-face`、无 `<link>`、无 CDN。**当前站点实际 100% 用系统字体。** 见 §3.2 的处置。
5. **admin 与前台共用同一套变量与组件类**（`AdminLayout.tsx` 用 `var(--surface)`/`var(--border)`/`.btn`/`.card`/`.input`），所以 admin 会**自动跟随换肤**。
6. `index.html:25` 已设置 `root.style.colorScheme`，原生控件（滚动条、表单）配色正确，改造时保留。

---

## 2. 设计令牌总表（可直接粘贴）

替换 `index.css:9-45` 的两个块。**共用 21 个令牌，亮暗两套同等精细。**

### 2.1 亮色主题（`:root`）

```css
:root {
  /* --- 表面 --- */
  --bg:              #FFFFFF;  /* 页面底 = 纸白。分隔靠线，不靠深浅 */
  --surface:         #FFFFFF;  /* 面板底，与 --bg 同值：Swiss 不用"浮层"深浅差 */
  --surface-hover:   #F2F2F2;  /* 悬停填充、内联代码底、表头底 */

  /* --- 线 --- */
  --border:          #D8D8D8;  /* 常规发丝线：卡片边、表格、输入框 */
  --rule:            #111111;  /* 强调线：标题下划线、页头分隔、hr、footer 上沿 */

  /* --- 文字 --- */
  --text:            #111111;  /* 标题 / 强调 / 正文输入   18.88:1 */
  --text-secondary:  #444444;  /* 正文段落                9.74:1 */
  --text-muted:      #6B6B6B;  /* 元信息 / 时间 / placeholder 5.33:1 */

  /* --- 强调（全站唯一彩色） --- */
  --brand:           #E4002B;  /* 链接 / 焦点 / 激活线      4.85:1 */
  --brand-hover:     #C1001F;  /* 实心按钮悬停 */
  --brand-fg:        #FFFFFF;  /* 强调填充上的文字         4.85:1 */
  --brand-soft:      rgba(228, 0, 43, 0.10); /* 搜索命中底 */

  /* --- 中性色块（原 --brand-light 的新语义，见 §7.4） --- */
  --wash:            #F2F2F2;  /* 引用块底 / 图标底板 —— 中性，不染强调色 */

  /* --- 反相块（选中态 / 激活态） --- */
  --invert-bg:       #111111;
  --invert-fg:       #FFFFFF;

  /* --- 语义色（仅 admin 与错误态使用） --- */
  --danger:          #B3001B;  /* 7.16:1 */
  --danger-soft:     #FBEAEC;
  --warning:         #8A5A00;  /* 5.93:1 */
  --success:         #14663C;  /* 7.01:1 */

  /* --- 代码块 --- */
  --code-bg:         #F4F4F4;
  --code-border:     #D8D8D8;

  /* --- 字体 --- */
  --font-heading: 'Archivo', system-ui, -apple-system, 'Segoe UI', 'PingFang SC',
                  'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
}
```

### 2.2 暗色主题（`.dark`）

```css
.dark {
  --bg:              #0B0B0B;  /* 中性近黑。**不要用 slate/蓝灰**（原 #0f172a 是蓝灰，与 Swiss 的冷峻中立冲突） */
  --surface:         #0B0B0B;
  --surface-hover:   #1A1A1A;

  --border:          #2E2E2E;
  --rule:            #F5F5F5;

  --text:            #F5F5F5;  /* 18.05:1 */
  --text-secondary:  #B8B8B8;  /* 9.92:1 */
  --text-muted:      #8A8A8A;  /* 5.70:1 */

  --brand:           #FF4D4D;  /* 6.02:1 —— 注意它同时也是"填充安全"的，见 §2.4 */
  --brand-hover:     #FF7070;
  --brand-fg:        #0B0B0B;  /* 暗色下强调填充上的字用近黑，不用白，见 §2.4 */
  --brand-soft:      rgba(255, 77, 77, 0.16);

  --wash:            #1A1A1A;

  --invert-bg:       #F5F5F5;
  --invert-fg:       #0B0B0B;

  --danger:          #FF6B6B;  /* 7.09:1 */
  --danger-soft:     #2A1012;
  --warning:         #F5C542;  /* 12.13:1 */
  --success:         #4ADE80;  /* 11.30:1 */

  --code-bg:         #141414;
  --code-border:     #2E2E2E;

  --font-heading: 'Archivo', system-ui, -apple-system, 'Segoe UI', 'PingFang SC',
                  'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;
}
```

同时**删除** `--border-light`（死变量），并加一行兼容别名（见 §7.4）：

```css
:root, .dark { --brand-light: var(--wash); } /* @deprecated 迁移完一轮后删掉 */
```

### 2.3 为什么选 `#E4002B` 做强调色

1. **它是"印刷红"而不是"屏幕红"**。`#E4002B` 是略带冷调的朱红，是瑞士国际主义海报（以及 Bayer / Leica / Müller-Brockmann 系版面）惯用的那个红族；相比之下 `#FF3B30` 偏橙、`#FF0000` 是纯 sRGB 饱和红，两者都更像 UI 警示色而非印刷油墨色。
2. **它白底 4.85:1，卡在 AA 线上方**。这是硬性筛选条件，因为 `--brand` 被用作**正文内链接**颜色（`index.css:208`）。纯红 `#FF0000` 测出来是 **3.998:1**，直接出局。这一点比"审美"更能决定取值空间。
3. **它顺手修掉了现存违规**。现在的 `#3377ff` 是 **4.02:1**（§1.4），已违规。换红不是审美选择，而是修复。
4. **单色强调 + 中性灰** 让整个 UI 的色相数量降到 **1**，符合 Swiss "颜色是稀缺资源"的纪律。蓝色被逐出 UI 调色板，只允许出现在**代码 token** 里（那里功能性优先）。

### 2.4 为什么暗色下 `--brand-fg` 是近黑而非白

这两个约束是**互斥的**，必须用两个值分别满足：

- `--brand` 作**文字**（链接）时，需要 `(L_brand + 0.05) / (L_bg + 0.05) ≥ 4.5`（`L_bg = 0.0033`）⇒ **`L_brand ≥ 0.190`**
- `--brand` 作**填充**且文字为白时，需要 `1.05 / (L_brand + 0.05) ≥ 4.5` ⇒ **`L_brand ≤ 0.183`**

两者不可同时成立。解法：**把填充上的文字改成近黑**。

`#FF4D4D` 的 `L = 0.2710`：
- 作文字 on `#0B0B0B` → `(0.3210)/(0.0533) = **6.02:1**` ✅
- 作填充，文字 `#0B0B0B` → `(0.3210)/(0.0533) = **6.02:1**` ✅

一个值同时满足两种用法，代价只是把那 8 处硬编码 `#fff` 改成 `var(--brand-fg)`。**这 8 处本来就必须改，所以零额外成本。**

---

## 3. 对比度校验表

### 3.1 算式

WCAG 2.1 相对亮度：

```
对每个通道 c ∈ {R,G,B}（归一化到 0..1）：
  c_lin = c / 12.92                     if c ≤ 0.04045
        = ((c + 0.055) / 1.055) ^ 2.4   otherwise
L = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin
对比度 = (L_亮 + 0.05) / (L_暗 + 0.05)      （分子取较大的 L）
```

判定标准（WCAG 2.1 SC 1.4.3）：正文 / 小字 **≥ 4.5:1**；大文本（≥18.66px 粗体 或 ≥24px）**≥ 3:1**。

### 3.2 亮色主题

| 元素 | 前景 | 背景 | L(前景) | L(背景) | 对比度 | 要求 | 判定 |
|---|---|---|---|---|---|---|---|
| 主标题 / 正文强调 | `--text` `#111111` | `--bg` `#FFFFFF` | 0.0056 | 1.0000 | **18.88:1** | 4.5 | ✅ |
| 正文段落 | `--text-secondary` `#444444` | `--bg` `#FFFFFF` | 0.0578 | 1.0000 | **9.74:1** | 4.5 | ✅ |
| 元信息 / 时间 / placeholder | `--text-muted` `#6B6B6B` | `--bg` `#FFFFFF` | 0.1470 | 1.0000 | **5.33:1** | 4.5 | ✅ |
| 正文内链接 | `--brand` `#E4002B` | `--bg` `#FFFFFF` | 0.1667 | 1.0000 | **4.85:1** | 4.5 | ✅ |
| 主按钮文字 | `--brand-fg` `#FFFFFF` | `--brand` `#E4002B` | 1.0000 | 0.1667 | **4.85:1** | 4.5 | ✅ |
| 描边按钮文字 | `--text` `#111111` | `--surface` `#FFFFFF` | 0.0056 | 1.0000 | **18.88:1** | 4.5 | ✅ |
| 幽灵按钮文字 | `--text-secondary` `#444444` | `#FFFFFF` | 0.0578 | 1.0000 | **9.74:1** | 4.5 | ✅ |
| 危险按钮文字 | `--danger` `#B3001B` | `#FFFFFF` | 0.0967 | 1.0000 | **7.16:1** | 4.5 | ✅ |
| 标签文字 | `--text` `#111111` | `--bg` `#FFFFFF`（透明底） | 0.0056 | 1.0000 | **18.88:1** | 4.5 | ✅ |
| 反相块（选中态） | `--invert-fg` `#FFFFFF` | `--invert-bg` `#111111` | 1.0000 | 0.0056 | **18.88:1** | 4.5 | ✅ |
| 内联代码 | `--text` `#111111` | `--surface-hover` `#F2F2F2` | 0.0056 | 0.8879 | **16.87:1** | 4.5 | ✅ |
| 元信息 on 悬停底 | `--text-muted` `#6B6B6B` | `--surface-hover` `#F2F2F2` | 0.1470 | 0.8879 | **4.76:1** | 4.5 | ✅ |
| 表格表头文字 | `--text` `#111111` | `--surface-hover` `#F2F2F2` | 0.0056 | 0.8879 | **16.87:1** | 4.5 | ✅ |
| 搜索命中 `<mark>` | `--text` `#111111` | `--brand-soft` over `#FFF` = `rgb(252,230,234)` | 0.0056 | 0.8322 | **15.87:1** | 4.5 | ✅ |
| 引用块文字 | `--text-secondary` `#444444` | `--wash` `#F2F2F2` | 0.0578 | 0.8879 | **8.29:1** | 4.5 | ✅ |
| 错误提示文字 | `--danger` `#B3001B` | `--bg` `#FFFFFF` | 0.0967 | 1.0000 | **7.16:1** | 4.5 | ✅ |
| admin 成功态文字 | `--success` `#14663C` | `#FFFFFF` | 0.0998 | 1.0000 | **7.01:1** | 4.5 | ✅ |
| admin 成功态文字 on 15% 洗底 | `--success` `#14663C` | `rgb(220,232,226)` | 0.0998 | 0.7842 | **5.57:1** | 4.5 | ✅ |
| admin 警告态文字 | `--warning` `#8A5A00` | `#FFFFFF` | 0.1271 | 1.0000 | **5.93:1** | 4.5 | ✅ |
| admin 警告态文字 on 15% 洗底 | `--warning` `#8A5A00` | `rgb(237,230,217)` | 0.1271 | 0.7960 | **4.78:1** | 4.5 | ✅ |
| 危险态实心填充白字 | `#FFFFFF` | `--danger` `#B3001B` | 1.0000 | 0.0967 | **7.16:1** | 4.5 | ✅ |
| 成功态实心填充白字 | `#FFFFFF` | `--success` `#14663C` | 1.0000 | 0.0998 | **7.01:1** | 4.5 | ✅ |
| 警告态实心填充白字 | `#FFFFFF` | `--warning` `#8A5A00` | 1.0000 | 0.1271 | **5.93:1** | 4.5 | ✅ |

### 3.3 暗色主题

| 元素 | 前景 | 背景 | L(前景) | L(背景) | 对比度 | 要求 | 判定 |
|---|---|---|---|---|---|---|---|
| 主标题 | `--text` `#F5F5F5` | `--bg` `#0B0B0B` | 0.9131 | 0.0033 | **18.05:1** | 4.5 | ✅ |
| 正文段落 | `--text-secondary` `#B8B8B8` | `--bg` `#0B0B0B` | 0.4794 | 0.0033 | **9.92:1** | 4.5 | ✅ |
| 元信息 | `--text-muted` `#8A8A8A` | `--bg` `#0B0B0B` | 0.2542 | 0.0033 | **5.70:1** | 4.5 | ✅ |
| 正文内链接 | `--brand` `#FF4D4D` | `--bg` `#0B0B0B` | 0.2710 | 0.0033 | **6.02:1** | 4.5 | ✅ |
| 主按钮文字 | `--brand-fg` `#0B0B0B` | `--brand` `#FF4D4D` | 0.0033 | 0.2710 | **6.02:1** | 4.5 | ✅ |
| 反相块（选中态） | `--invert-fg` `#0B0B0B` | `--invert-bg` `#F5F5F5` | 0.0033 | 0.9131 | **18.05:1** | 4.5 | ✅ |
| 标签文字 | `--text` `#F5F5F5` | `--bg` `#0B0B0B` | 0.9131 | 0.0033 | **18.05:1** | 4.5 | ✅ |
| 内联代码 | `--text` `#F5F5F5` | `--surface-hover` `#1A1A1A` | 0.9131 | 0.0103 | **15.86:1** | 4.5 | ✅ |
| 搜索命中 `<mark>` | `--text` `#F5F5F5` | `--brand-soft` over `#0B0B0B` = `rgb(50,22,22)` | 0.9131 | 0.0131 | **15.26:1** | 4.5 | ✅ |
| 错误提示 | `--danger` `#FF6B6B` | `--bg` `#0B0B0B` | 0.3284 | 0.0033 | **7.09:1** | 4.5 | ✅ |
| 错误提示 on 危险洗底 | `--danger` `#FF6B6B` | `--danger-soft` `#2A1012` | 0.3284 | 0.0091 | **6.41:1** | 4.5 | ✅ |
| admin 成功态 | `--success` `#4ADE80` | `--bg` `#0B0B0B` | 0.5525 | 0.0033 | **11.30:1** | 4.5 | ✅ |
| admin 警告态 | `--warning` `#F5C542` | `--bg` `#0B0B0B` | 0.5973 | 0.0033 | **12.13:1** | 4.5 | ✅ |

### 3.4 代码 token 配色（收敛到 4 个值）

**设计决定**：把 34 个 `--hl-*` 收敛为**每个主题 4 个颜色**（`fg` / 中性灰 / 红 / 蓝），语义按 token 归类映射。

理由：GitHub 原配色有 5-6 个色相（红/蓝/绿/紫/橙），与 Swiss「单强调色 + 中性灰」直接冲突；但代码 token 需要**语义区分**（关键字≠字符串≠注释），否则可读性受损。取 3 色相 + 灰是我认为的正确折衷 —— IBM Carbon 的代码主题基本就是这个结构。

单元测试级要求：**每个 token 色对 `--code-bg` 的对比度 ≥ 4.5:1**（代码非大文本）。

```css
@layer base {
  :root {
    --hl-fg:      #111111;  /* 默认文本 / 变量 / 参数 / 强调 */
    --hl-muted:   #5A5A5A;  /* 注释 / 引用 / meta          on #F4F4F4 = 6.27:1 ✅ */
    --hl-red:     #B3001B;  /* 关键字 / 类型 / tag / built_in / 删除行  = 6.40:1 ✅ */
    --hl-blue:    #0B5FA5;  /* 字符串 / 数字 / 属性 / 正则 / 链接       = 5.87:1 ✅ */
  }
  .dark {
    --hl-fg:      #F5F5F5;  /* on #141414 = 15.5:1 ✅ */
    --hl-muted:   #9A9A9A;  /* = 6.34:1 ✅ */
    --hl-red:     #FF6B6B;  /* = 6.44:1 ✅ */
    --hl-blue:    #79C0FF;  /* = 9.19:1 ✅ */
  }
}
```

**34 个 token → 4 个值的完整映射**（照抄即可，不再需要 `--hl-keyword` 之类）：

```css
.markdown-body .hljs                    { color: var(--hl-fg); background: transparent; }
.markdown-body .hljs-comment            { color: var(--hl-muted); font-style: italic; }
.markdown-body .hljs-quote              { color: var(--hl-muted); font-style: italic; }
.markdown-body .hljs-meta               { color: var(--hl-muted); }
.markdown-body .hljs-keyword            { color: var(--hl-red); }
.markdown-body .hljs-type               { color: var(--hl-red); }
.markdown-body .hljs-built_in           { color: var(--hl-red); }
.markdown-body .hljs-tag                { color: var(--hl-red); }
.markdown-body .hljs-name               { color: var(--hl-red); }
.markdown-body .hljs-selector-tag       { color: var(--hl-red); }
.markdown-body .hljs-deletion           { color: var(--hl-red); }
.markdown-body .hljs-string             { color: var(--hl-blue); }
.markdown-body .hljs-regexp             { color: var(--hl-blue); }
.markdown-body .hljs-number             { color: var(--hl-blue); }
.markdown-body .hljs-literal            { color: var(--hl-blue); }
.markdown-body .hljs-attr               { color: var(--hl-blue); }
.markdown-body .hljs-attribute          { color: var(--hl-blue); }
.markdown-body .hljs-property           { color: var(--hl-blue); }
.markdown-body .hljs-symbol             { color: var(--hl-blue); }
.markdown-body .hljs-bullet             { color: var(--hl-blue); }
.markdown-body .hljs-section            { color: var(--hl-blue); font-weight: 600; }
.markdown-body .hljs-selector-attr      { color: var(--hl-blue); }
.markdown-body .hljs-selector-class     { color: var(--hl-blue); }
.markdown-body .hljs-selector-id        { color: var(--hl-blue); }
.markdown-body .hljs-link               { color: var(--hl-blue); text-decoration: underline; }
.markdown-body .hljs-function           { color: var(--hl-fg); font-weight: 600; }
.markdown-body .hljs-title              { color: var(--hl-fg); font-weight: 600; }
.markdown-body .hljs-variable           { color: var(--hl-fg); }
.markdown-body .hljs-template-variable  { color: var(--hl-fg); }
.markdown-body .hljs-params             { color: var(--hl-fg); }
.markdown-body .hljs-addition           { color: var(--hl-fg); }
.markdown-body .hljs-emphasis           { color: var(--hl-fg); font-style: italic; }
.markdown-body .hljs-strong             { color: var(--hl-fg); font-weight: 700; }
```

**同时删掉 `.light-code` / `.dark-code` 两个块**（`index.css:363-433`，共 71 行）—— 变量从 `<html>` 继承，两块的兜底作用永不生效（§1.1）。`MarkdownRenderer.tsx` 上的 `light-code`/`dark-code` 类名**保留不动**（不产生任何影响，去掉反而要改 JSX）。

**行内代码**（`index.css:476-480`）：
```css
.markdown-body code.hljs {
  padding: 1px 5px;
  background: var(--surface-hover);
  color: var(--text);          /* ← 原来是 var(--brand)，亮色下 4.33:1 违规 */
  border: 1px solid var(--border);
  border-radius: 0;
}
```

---

## 4. 字体方案

### 4.1 标题字体：**Archivo**

**下载源**：Google Fonts（`Archivo`，Omnibus-Type，**OFL 1.1**）。
**形态**：可变字体（轴 `wght` 100–900、`wdth` 62–125）。
**取用**：`wght 600–700` 区间即可满足本方案的全部标题需求。

**为什么是 Archivo**：

1. **血统正确**。它属于 grotesque（怪诞体）族，字形骨架接的是 Akzidenz-Grotesk → Helvetica 这条线 —— 也就是国际主义排版风格本身的字体史。它不是展示体、不是几何体、不是人文体。
2. **与系统字体栈有真实对比度**。这一点是关键：正文走系统栈，在 macOS 上是 SF Pro。**如果标题选 Inter，与 SF Pro 几乎无法分辨**，那么"只给标题引入一款特色字体"这件事就白做了。Archivo 的字形更方、更宽、字腔开口更大、字距更松，在标题尺寸下一眼能看出是另一个声音。
3. **OFL 1.1 ⇒ 自托管、子集化、再分发全部合法**，无授权风险。（Söhne / Suisse Int'l / Neue Haas Grotesk 这些"最正宗"的选择全是商业授权，自托管要做字体授权采购，不适合本站。）
4. **可变字体 = 一个文件覆盖 600/700**，不必为两个字重各下一份。

**备选（若可变字体子集化遇到障碍）**：下载静态 `Archivo SemiBold (600)` + `Archivo Bold (700)` 两个 woff2，方案其余部分不变。**不要退回到 Inter**（理由 2）。

**否决 `Space Grotesk` / `Bricolage Grotesque`**：字形有个性化的怪点（`Space Grotesk` 的 `g`、`R` 有强烈特征），属于"复古科技感"，与 Swiss 要求的**中性、克制、不表态**相冲突。

### 4.2 中英混排：正面回答「中文怎么办」

> **结论：中文标题不换字体，继续走系统黑体栈。**
> 混合标题（如 `深入理解 React Hooks`）会**自动分流**：拉丁字符用 Archivo，CJK 字符用系统黑体。这不需要任何 JS。

**为什么不给中文配字体** —— 三条独立的、每条都足以否决的理由：

1. **没有符合瑞士风格的开源中文字体。** 中文不存在 Helvetica 的对应物。免费可选的中文字体只有两类：
   - **宋体族**（思源宋体 / Noto Serif SC / 霞鹜文楷）：衬线，笔画有粗细对比和起收笔装饰 —— 与 grotesque 的「等线宽、封闭字腔、去装饰」**方向相反**。
   - **黑体族**（思源黑体 / 阿里巴巴普惠体 / 鸿蒙黑体 / MiSans）：无衬线，但都是**几何/人文取向**的现代 UI 黑体，笔画末端处理、字面率、重心都与印刷式 grotesque 不同。用得最多也只能做到"不冲突"，做不到"契合"。
2. **体积与该项目的硬约束直接冲突。** 思源黑体简体单字重完整版 8–16MB。即使做子集化，也存在一个**结构性障碍**：本站文章内容存在 **PostgreSQL 里**（`posts.content`），不在代码里 —— **构建期拿不到全量字符集**。要正确子集化，就必须引入「每次发布文章后重新扫描全库正文 → 重算字符集 → 重新生成字体文件 → 重新构建前端」的流水线。这是为了一个标题字体去建一条 CI 管线，明显的过度设计，而且**每发一篇文章都可能新增字，子集随时失效**。
3. **系统黑体在中文屏显上质量已经足够。** macOS 的 PingFang SC、Windows 的 Microsoft YaHei、Android 的 Noto Sans CJK 都是经过屏显 hinting 优化的现代黑体。**瑞士风格的核心是版面结构（网格 / 留白 / 字重对比 / 发丝线），不是字体品牌。** 用系统黑体 + 正确的字号、字重、行高、字距，同样能做出瑞士感 —— 事实上瑞士风格在中文语境里的实践（如早期《idea》《Design 360°》的版面）本来就是用当时最好的中文黑体直排，而不是去配一套"瑞士中文"。

**技术实现**：靠 `unicode-range` 让浏览器自动分流，**零 JS、零额外体积**。

```css
/* client/src/styles/fonts.css —— 由 index.css 顶部 @import */
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 600 700;              /* 变量字体：声明字重区间 */
  font-display: swap;
  src: url('../assets/fonts/archivo-latin.woff2') format('woff2');
  /* ⚠️ unicode-range 是分流的关键：只声明拉丁区段，
     浏览器遇到 CJK 字符时直接跳到下一个字体族（PingFang SC 等），
     既不会去"尝试"Archivo，也不会产生豆腐块 */
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
                 U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC,
                 U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD,
                 U+2013-2014, U+2018-201D, U+2026;
}

@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 600 700;
  font-display: swap;
  src: url('../assets/fonts/archivo-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF,
                 U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
```

### 4.3 自托管 + 子集化落地步骤（具体命令）

**不要自己手写子集化。Google Fonts 已经按 `latin` / `latin-ext` 分片并压缩好了。**

**Step 1 —— 取字体文件**（用现代 UA 请求，才会返回 woff2）
```bash
cd "D:/学习/前端/Lei-Blog/client"
mkdir -p src/assets/fonts

# 用 Chrome UA 请求 CSS，拿到 woff2 直链（默认 UA 会给 ttf，体积大 3 倍）
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
(KHTML, like Gecko) Chrome/120.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Archivo:wght@600..700&display=swap"
```

**Step 2 —— 从返回的 CSS 里取两个子集的 `url(...)`，下载并按固定名保存**
```bash
# latin 子集（LATIN 注释块下的那个 url）→ 约 18-22KB
curl -o src/assets/fonts/archivo-latin.woff2     "https://fonts.gstatic.com/s/archivo/<hash1>.woff2"
# latin-ext 子集                                              → 约 8-12KB
curl -o src/assets/fonts/archivo-latin-ext.woff2 "https://fonts.gstatic.com/s/archivo/<hash2>.woff2"
```
**并核对**：`ls -l src/assets/fonts/` 两个文件总和应 **< 40KB**。若拿到 200KB+ 说明下成了 ttf，检查 UA。

**Step 3（可选，仅在需要更小体积时）—— 用 `pyftsubset` 再压一档**
Google 的 latin 子集已包含完整 `U+0000-00FF`（含用不到的 `Þ þ ß` 等）。若要把 latin 压到 ~12KB：
```bash
pip install fonttools brotli zopfli
pyftsubset src/assets/fonts/archivo-latin.woff2 \
  --text-file=<(printf '%s' "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:!?'\"()[]{}<>/\\|-_+=*&^%%$#@~`—–…“”‘’·°±×÷≤≥≠≈→←↑↓") \
  --flavor=woff2 --layout-features=kern,liga,tnum,calt --no-hinting \
  --output-file=src/assets/fonts/archivo-latin.min.woff2
```
**注意**：`--text-file` 方式是「按实际出现的字符」子集化，**本项目只对拉丁字符做**，而拉丁字符集**是可以穷举的**（上表）。这正是它和中文的根本区别 —— **中文做不到，拉丁可以。**
无 Python 环境时可用 `npx subset-font`（纯 Node，Harfbuzz WASM）替代。

**Step 4 —— 产物目录：`client/src/assets/fonts/`，不要用 `public/`**

理由（可验证）：Vite 对 `src/` 下被 CSS `url()` 引用的资源会**加内容哈希并输出到 `dist/assets/`**；而 Nginx 配置已经对 `/assets/` 设了 `Cache-Control: public, immutable` 长缓存。放在 `public/` 则文件名无哈希、无法安全长缓存。**用 `src/assets/` 可以白拿正确的缓存策略。**
（体积 20KB > Vite 默认 `assetsInlineLimit` 4KB，不会被 base64 内联，无需调整配置。）

**Step 5 —— `font-display` 取值：`swap` + `index.html` 预加载**

- **不选 `block`**：会有最长 3s 的不可见文字期（FOIT），标题区空白 —— 直接恶化 LCP 与 CLS。
- **不选 `optional`**：慢网下首次访问**完全不使用** Archivo，只有第二次访问才用，首屏观感不可控。
- **选 `swap`**：立即用系统字体渲染，字体到位后替换。有 FOUT 但无空白。本项目标题字重固定（600/700）、行高在 token 里写死，**替换不会造成块级重排**，CLS 影响受限。
- **叠加预加载**（`index.html` `<head>` 内、防闪白脚本之前）：
```html
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="/assets/archivo-latin.woff2">
```
**⚠️ `crossorigin` 必须加** —— 否则浏览器会发第二次请求（字体走 CORS 模式，缺失属性会导致重复下载）。
**⚠️ 预加载 href 里的哈希**：Vite 会给文件加哈希，静态 `<link>` 无法引用。**处置：把字体放在 `client/public/fonts/` 下用于预加载路径，同时在 `src/assets/` 保留一份由 CSS 引用** —— 这是重复的，不好。
**更干净的处置（推荐）**：不使用 `<link rel=preload>`，改在 **`main.tsx` 里用 `import` 触发**：
```ts
// 让 Vite 把字体纳入模块图，拿到哈希后的真实 URL
```
**最终决定**：**放弃 `<link rel=preload>`**，仅靠 `@font-face` + `font-display: swap`。理由：哈希 URL 与静态预加载不可兼得，而收益（首屏标题早几十毫秒）不值得引入 `public/` 与 `src/assets/` 的双份维护或关闭哈希的代价。**若后续实测 FOUT 明显**（用 DevTools 网络限速 3G + 录屏逐帧），再改用「关掉 assets 哈希的命名方案 + preload」。

### 4.4 与 `fontFamily.sans` 的整合方式

**采用「Tailwind `heading` 家族 + 标题元素默认值（写在 `@layer` 之外）」双轨**：

**① `tailwind.config.ts` 新增 `heading` 家族**（供 JSX 显式调用，以及未来非标题元素）：
```ts
fontFamily: {
  // 正文：系统栈，零请求
  sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto',
         'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
         'Noto Sans CJK SC', 'sans-serif'],
  // 标题：Archivo 优先，CJK 自动落到后面的系统黑体
  heading: ['Archivo', 'system-ui', '-apple-system', 'Segoe UI',
            'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
            'Noto Sans CJK SC', 'sans-serif'],
  mono: ['ui-monospace', 'Cascadia Code', 'Fira Code', 'Consolas', 'monospace'],
},
```
**同时把 `Inter` 从 `sans` 里删掉。** 它从未被加载（§1.5），留在栈首意味着「装了 Inter 的用户看到一种字体，其他用户看到另一种」—— 对以排版为核心的改造来说，**渲染确定性比碰运气更重要**。

**② 标题默认值（写在 `index.css` 的 `@layer` **之外**）**：

⚠️ **重要更正**：「零 JSX 改动」**不是靠 Cascade Layers，而是靠一条约定**。原方案误以为「非分层样式优先于任何 `@layer`」在本构建下成立，**实测不成立**（真实机制见下方注释与 §11）：Tailwind v3 会把 `@layer` **展平**输出，`dist` 产物里没有任何原生级联层，非分层标题规则与 `.font-*` utility 同区，**按特异性决胜 ⇒ utility 赢**。因此真正的护栏是：**标题元素不带字重 utility**。

```css
/* ============================================================
   标题默认排印
   ------------------------------------------------------------
   ⚠️ 真实机制（别再信 "Cascade Layers 非分层优先"）：
   Tailwind **v3** 把 `@layer` 展平后再输出，构建产物 dist/assets/*.css
   里**没有任何原生级联层**（自证：grep -o "@layer" dist/assets/*.css | wc -l → 0）。
   所以下面这段非分层规则与展平后的 .font-bold 等**同处非分层区**，
   胜负只看特异性：.font-bold (0,1,0) > h2 (0,0,1) ⇒ utility 赢、这里被压过。
   ⇒ 本项目**约定**：标题元素（h1~h6）不得携带任何 font-* 字重 utility；
      字重一律由这里单一决定：h1 = 700，h2/h3/h4 = 600。
      改字重改这里，不要在 JSX 上加类；也不要 !important 抢回来。
   ============================================================ */
h1, h2, h3, h4 {
  font-family: var(--font-heading);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--text);
  text-wrap: balance;          /* 标题禁止孤行；不支持时优雅降级 */
}
h1 { font-weight: 700; letter-spacing: -0.03em; }
h2 { letter-spacing: -0.025em; }
```
`.markdown-body h2/h3/h4` 已有**更高特异性**的规则（写在 `@layer` 之外，`index.css:172,177,181`），会正常覆盖上面的 `line-height` 等，**只需给它们补 `font-family` 与 `letter-spacing`**（因为那三条规则里没有声明这两项，会从 `h2` 继承 —— 实际会继承，可不动。但 `line-height: 1.2` 会被 `.markdown-body h2` 的 `@apply text-2xl`（含 lineHeight）覆盖，符合预期）。

**JSX 侧唯一需要加的语义类**（P1，5 处）：`.t-eyebrow`，见 §6.4。

---

## 5. 中文字体排印细则

瑞士风格在中文语境的落点，**全部是「数值」，不是形容词**。以下写进 `index.css` 的非分层区。

### 5.1 行高

| 语境 | 行高 | 理由 |
|---|---|---|
| 中文正文段 | **1.75**（`--text-secondary` 16px → 28px） | 汉字是方块字、无升部降部，行距过紧会"糊成一片"。1.75 是中文屏显的舒适下限区间 |
| 中英混排正文段 | **1.75**（同上，不额外调整） | 拉丁的行内高度由 Archivo/系统字体自身 metric 决定，无需为混排单独调行高 |
| 中文标题 | **1.2**（h1 可到 1.12） | 标题行数少，紧凑才有力度 |
| 元信息（13px） | **1.5** | 小字需要更松的行距才可读 |

**明确不做**：不为中文单独设 `line-height: 2`。很多中文站点这么做，但它会让段落松散、破坏 Swiss 的版面密度。

### 5.2 字距（letter-spacing）

**这是中文排印里最容易做错的一项。**

| 语境 | 值 | 说明 |
|---|---|---|
| 中文正文 | **0** | 汉字字面率高、自带侧边距，**再负字距会粘连**。绝对不要给中文正文加负字距 |
| 中文标题 | **0**（`letter-spacing: normal`） | 同上 |
| 拉丁标题 | 由 `h1..h4` 的 `-0.02em / -0.03em` 提供 | 拉丁字形需要负字距才紧凑 |
| 元信息 / eyebrow | **+0.14em**（eyebrow） | 全大写拉丁小标签需要正字距才透气 |
| 代码 | 0 | — |

**关键矛盾与解法**：`h1..h4` 上必须同时服务拉丁（要负字距）和中文（要零字距），而 CSS 的 `letter-spacing` 作用于整个元素，**无法按字符类型分开**。

**解法：取折衷值并接受拉丁侧略松。** 具体做法是**把负字距控制在小幅**：
- `h1`: `-0.03em` → 对 52px 拉丁标题是很克制的紧排；对中文标题，`-0.03em × 52px ≈ -1.56px`，汉字之间收 1.5px **略紧但不粘连**，可接受。
- `h2..h4`: `-0.02em` ~ `-0.025em`，同理。

**不要**为了"中文完美"把标题字距设成 0 —— 那样拉丁标题会明显松散，而本站中文标题占比高但拉丁标题（`React`、`Vite`、`PostgreSQL`）也不少，**两者都要能看**。小幅负字距是唯一能同时照顾两者的取值。

### 5.3 中英混排间距

> **结论：不做自动中英间距。这是内容规范，不是样式能解决的问题。**

三条理由：

1. **CSS 做不到。** `text-autospace`（自动中英间距）目前仅 Chromium 实验性支持，需 flag；`text-spacing-trim` 是较新的 CSS Text 4 特性，Safari / Chromium 新版本支持、Firefox 不支持。**没有跨浏览器可用的方案。**
2. **用 JS 插空格不可接受。** 会污染 DOM、破坏 `Highlight.tsx` 的高亮区间计算（它按字符 offset 切分）、影响文本复制结果、并与 React 的文本节点 diff 打架。
3. **靠排版本身已经够了。** PingFang SC / Microsoft YaHei 的字形自带侧边距（side bearing），中英之间的视觉间距**本来就是设计过的**，不是零。真正需要微调的场景是「中文紧贴标点或数字」，而这属于内容规范。

**渐进增强（推荐加上，成本 3 行）**：
```css
.markdown-body {
  /* Chromium 新版本会用上；不支持的浏览器静默忽略，无副作用 */
  text-spacing-trim: space-first;
  text-autospace: normal;
}
```

**内容侧的约定（写进后台编辑提示，不是样式）**：中文与英文单词 / 数字之间留**一个半角空格**；中文与中文标点之间不留空格。这是中文技术写作的通行规范，也是唯一能真正解决这个问题的层次。

### 5.4 标点处理

| 项 | 处置 |
|---|---|
| 中文标点 | **保持全角，不做转换** |
| 行首禁则 | 由浏览器默认处理，**不引 `punctuation-trim` 类库** |
| 中英混排的标点归属 | 遵循内容侧书写，样式不干预 |
| 引号 | 现有文章中的 `「」`/`""` 原样保留 |

### 5.5 标题字重

中文系统黑体的字重与拉丁 grotesque **不成比例**：PingFang SC 的 Semibold(600) 视觉重量明显重于 Archivo 的 600。

| 层级 | 字重 | 理由 |
|---|---|---|
| `h1` | **700** | PingFang Bold 略重但标题尺寸下可接受，且 Archivo 700 的力度需要匹配 |
| `h2` / `h3` / `h4` | **600** | 600 是中文标题的甜点值：足够区分层级，又不像 700 那样"喊" |
| 正文加粗 `.markdown-body strong` | **700** | 行内强调需要与周围正文拉开差距 |
| 补位：中文标题若显重 | 可在 `zh.ts` 侧不改，改用 CSS `h1 { font-weight: 650 }`（可变字重支持分数值，PingFang 会吸附到最近的 600/700） | 不建议一开始就调，先按 700/600 落地看效果 |

---

## 6. 排版尺度

### 6.1 策略：**重定义既有 fontSize 刻度值**，而不是新增语义类

这是本次改造里降低风险最关键的一步。

**观察**：`text-3xl` / `text-4xl` / `text-2xl` / `text-8xl` 的**使用位置几乎全部是标题**（`grep` 逐个核对过）：

| 类 | 使用位置 | 例外 |
|---|---|---|
| `text-3xl` | **8 个页面的 `<h1>`**：`HomePage:29`、`ArchivePage:17`、`CategoriesPage:14`、`CategoryDetailPage:56`、`SearchPage:73`、`TagDetailPage:38`、`TagsPage:13`、`PostDetailPage:63`；另 `index.css:169` 的 `.markdown-body h1` | ⚠️ **`CommentSection.tsx:37` 用在了 💬 emoji 上**（非标题） |
| `text-4xl` | 仅 `PostDetailPage.tsx:63`（`sm:text-4xl` 文章标题） | 无 |
| `text-2xl` | `PostDetailPage.tsx:24` 错误 h1、`NotFoundPage.tsx:10` h1、admin 若干标题 | 无 |
| `text-8xl` | 仅 `NotFoundPage.tsx:9` 的 404 大数字 | 无（这是展示型数字，放大是期望效果） |

⇒ **重定义这几个刻度的数值，就等于一次改完所有标题的字号，JSX 一行都不用动。**
⇒ 唯一需要善后的是 `CommentSection.tsx:37` 的 emoji：把 `text-3xl` 改成 `text-2xl`，避免它在改后从 30px 变成 36px（1 处 JSX，已列入 §10.3）。

### 6.2 `tailwind.config.ts` 的 `fontSize` 扩展（替换现有 `extend` 内无 `fontSize` 的状态，即新增整块）

```ts
fontSize: {
  // [size, { lineHeight, letterSpacing }]
  xs:      ['0.75rem',  { lineHeight: '1.5'  }],                                  // 12px
  sm:      ['0.875rem', { lineHeight: '1.6'  }],                                  // 14px
  base:    ['1rem',     { lineHeight: '1.75' }],                                  // 16px 正文
  lg:      ['1.125rem', { lineHeight: '1.55' }],                                  // 18px
  xl:      ['1.25rem',  { lineHeight: '1.35', letterSpacing: '-0.01em' }],        // 20px 卡片标题
  '2xl':   ['1.5rem',   { lineHeight: '1.28', letterSpacing: '-0.02em'  }],       // 24px 正文 h2
  '3xl':   ['2.25rem',  { lineHeight: '1.12', letterSpacing: '-0.03em'  }],       // 36px 页面 h1  ← 原 1.875rem
  '4xl':   ['3.25rem',  { lineHeight: '1.05', letterSpacing: '-0.035em' }],       // 52px 文章标题 ← 原 2.25rem
  '8xl':   ['6rem',     { lineHeight: '1'    }],                                  // 96px 404
  // 新增语义刻度（仅在新写的标记里使用）
  eyebrow: ['0.6875rem',{ lineHeight: '1.4', letterSpacing: '0.14em' }],          // 11px 全大写小标签
  meta:    ['0.8125rem',{ lineHeight: '1.5', letterSpacing: '0'      }],          // 13px 元信息
},
```

**关键跳变**：`text-3xl` 从 30px → **36px**，`text-4xl` 从 36px → **52px**。这是 Swiss 的「大字号标题」来源，也是这次改造视觉变化最明显的地方。

> ⚠️ **风险核对**：`text-3xl` 目前在 admin 页面也用于标题（`AdminDashboardPage` 等）。从 30px 变 36px 会让 admin 标题变大 —— 这是**预期效果**（admin 一并换肤），但要回归确认没有撑破容器（admin 侧边栏 `w-64`，标题在 `max-w-5xl` 内容区里，无溢出风险）。

### 6.3 字号 / 字重 / 行高总表

| 层级 | Tailwind 类 | 实际值 | 字重 | 行高 | 字距 | 应用位置 |
|---|---|---|---|---|---|---|
| Display | `text-4xl` | 52px | 700 | 1.05 | -0.035em | 文章详情标题 |
| Page h1 | `text-3xl` | 36px | 700 | 1.12 | -0.03em | 各页头标题 |
| Section h2 | `text-2xl` | 24px | 600 | 1.28 | -0.02em | 正文 h2、错误页标题 |
| Card title | `text-xl` | 20px | 600 | 1.35 | -0.01em | PostCard / CategoryCard 标题 |
| Lead | `text-lg` | 18px | 400 | 1.55 | 0 | 页面副标题（`.t-lead`） |
| Body | `text-base` | 16px | 400 | 1.75 | 0 | 正文段落 |
| Small | `text-sm` | 14px | 400 | 1.6 | 0 | 摘要、次要 UI |
| Meta | `text-meta` | 13px | 400 | 1.5 | 0 | 时间 / 阅读量 / 浏览量 |
| Eyebrow | `text-eyebrow` | 11px | 600 | 1.4 | +0.14em | 全大写小标签（`uppercase`） |
| Code | `.markdown-body pre code` | 14px | 400 | 1.7 | 0 | 代码块 |

> **字重口径以 §5.5 为准**：`h1` = 700，`h2`/`h3`/`h4` = 600。本表早前把 Section h2 误写为 700（与 §5.5 冲突），已按 CSS 实际值（`index.css` 中 `h1{font-weight:700}`、`h2/h3/h4{font-weight:600}`）收敛为 **600**。表中「字重」列描述的是**标题 CSS 规则的输出**，不是 JSX utility——标题**不得**携带字重 utility（原因见 §4.4）。

### 6.4 `.t-eyebrow` 与 `.t-lead`（加进 `@layer components`）

```css
@layer components {
  /* 全大写小标签：Swiss 版面的"眉标"，用来在标题上方给出分类/日期 */
  .t-eyebrow {
    @apply inline-block text-eyebrow font-semibold uppercase;
    color: var(--text-muted);
  }
  .t-lead {
    @apply text-lg;
    color: var(--text-secondary);
  }
}
```

**需要手工加这两个类的 JSX 位置（P1，共 6 处）**：
| 文件:行 | 改法 |
|---|---|
| `PostDetailPage.tsx:68` | 元信息行 → `className="t-eyebrow flex flex-wrap items-center gap-4"`（去掉 `text-sm`） |
| `HomePage.tsx:32` | 副标题 → `className="t-lead"` |
| `ArchivePage.tsx:20` | 副标题 → `className="t-lead"` |
| `SearchPage.tsx:76` | 副标题 → `className="t-lead"` |
| `CategoriesPage.tsx:17` | 副标题 → `className="t-lead"` |
| `TagsPage.tsx:16` | 副标题 → `className="t-lead"` |
| `TocSidebar.tsx:135` | 目录标题 → `className="t-eyebrow mb-3"`（去掉 `text-xs font-bold uppercase tracking-wide`） |

---

## 7. 形状与质感

### 7.1 圆角：全部 0

在 `tailwind.config.ts` 的 `extend` 中加：

```ts
borderRadius: {
  none: '0px',
  sm: '0px',
  DEFAULT: '0px',
  md: '0px',
  lg: '0px',
  xl: '0px',
  '2xl': '0px',
  '3xl': '0px',
  // ⚠️ 刻意不覆盖 full：rounded-full 的"真圆"语义必须保留
},
```

**这一步让全部 `rounded-xl` / `rounded-2xl` / `rounded-lg`（TSX 中 13 处 + CSS 中 3 处）自动归零，JSX 零改动。**

### 7.2 `rounded-full` 的 15 处：手工替换，不覆盖 `full`

**为什么不在主题里把 `full` 也改成 0**：`rounded-full` 是有明确语义的（"做成正圆/胶囊"）。若把它篡改成 0px，将来任何需要真圆的元素（头像、状态圆点、进度环、`.spinner` 若要改成类）都会**静默变成方块**，且完全无法从类名看出问题。为了省 15 处机械替换而埋这个坑，不划算。

**替换清单（逐个，`rounded-full` → 去掉该类，圆角由 0 承担）**：

| 文件:行 | 元素 | 处置 |
|---|---|---|
| `index.css:67` | `.btn` | `rounded-full` → 删（`borderRadius.DEFAULT: 0` 生效） |
| `index.css:128` | `.tag-badge` | `rounded-full` → 删 |
| `components/Navbar.tsx:54` | 桌面导航链接 | 删 `rounded-full` |
| `components/Navbar.tsx:64` | 搜索图标按钮 | 删 |
| `components/Navbar.tsx:94` | 移动端搜索按钮 | 删 |
| `components/Navbar.tsx:111` | 汉堡按钮 | 删 |
| `components/ThemeSwitcher.tsx:82` | 紧凑主题按钮 | 删 |
| `components/ThemeSwitcher.tsx:96` | 分段控件外框 | 删 |
| `components/ThemeSwitcher.tsx:109` | 分段控件选项 | 删 |
| `components/LanguageSwitcher.tsx:14` | 分段控件外框 | 删 |
| `components/LanguageSwitcher.tsx:26` | 分段控件选项 | 删 |
| `components/Pagination.tsx:53` | 页码按钮 | 删 |
| `components/TagCloud.tsx:32` | 标签云胶囊 | 删 |

上表 13 处 + 上述补记 2 处 = **`rounded-full` 全量 15 处**（`grep -rn "rounded-full" client/src | wc -l` 实测为 15）。

> 注意 `MarkdownEditor.tsx:122,136` 用的是 **`rounded-lg`**，不在本表内 —— 它由 §7.1 的 `borderRadius` override 自动归零，无需手工处理。

**必须保持圆形的唯一样式**：`.spinner`（`index.css:141` 的 `border-radius: 50%`）—— 它不经过 Tailwind，**不动**。

### 7.3 边框与分隔线

| 用途 | 令牌 | 值 |
|---|---|---|
| 卡片 / 输入框 / 表格 / 标签 | `--border` | 1px `#D8D8D8` / `#2E2E2E` |
| 页头分隔、`hr`、footer 上沿、年份分隔 | `--rule` | 1px `var(--text)` |
| 正文 `h2` 下划线 | `--rule` | 1px `var(--rule)`（原为 `--border`，改这里） |
| 表格表头下沿 | `--rule` | 2px `var(--rule)` |
| 引用块左侧 | `--rule` | **4px `var(--text)`**（瑞士式粗竖线） |
| 焦点环 | `--brand` | `outline: 1px solid var(--brand); outline-offset: 0` + `border-color: var(--brand)` ⇒ 视觉上 2px |
| 键盘焦点（全局新增） | `--brand` | `:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px }` |

**新增全局焦点样式**（`index.css` 非分层区，这是无障碍改进，当前 `.btn` 完全没有自定义焦点态）：
```css
:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
  border-radius: 0;
}
```

### 7.4 阴影：全部取消；`--brand-light` 语义改写

**阴影处置**（3 处）：
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0;
  box-shadow: none;                 /* 原 0 1px 2px rgba(0,0,0,.04) */
  transition: border-color .15s;    /* 原 transform + box-shadow */
}
.card-hover:hover {
  transform: none;                  /* 原 translateY(-2px) */
  border-color: var(--rule);        /* 原 box-shadow 浮起 —— 改为"线变深" */
}
.btn-primary:hover:not(:disabled) {
  background: var(--brand-hover);
  transform: none;                  /* 原 translateY(-1px) */
}
```
`Navbar.tsx:35` 的 `backdrop-blur-md` 与 `background: color-mix(in srgb, var(--surface) 85%, transparent)`：**改为不透明** `style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}` 并删掉 `backdrop-blur-md`。理由：Swiss 的导航是一条**实线 + 实底**，半透明毛玻璃属于完全不同的视觉语言。

**`--brand-light` 语义改写（重要）**：原来它是「品牌色浅洗底」，用于激活态背景。新方案里激活态改成 `--invert-*`（反相块）或 `--text` + 线，而 `--brand-light` 剩下的用途（引用块底、admin 图标底板）应该是**中性**的，继续用品牌色会污染"单强调色"纪律。

处置（安全迁移，不破坏任何调用点）：
1. 新增 `--wash`（`#F2F2F2` / `#1A1A1A`）。
2. 保留 `--brand-light: var(--wash)` 作为 **deprecated 别名**，本轮不删。
3. 逐步替换这 8 处（其中 4 处本来就要改）：

| 文件:行 | 改为 |
|---|---|
| `components/Navbar.tsx:30` | `background: isActive ? 'var(--invert-bg)' : 'transparent'`，并把 `color` 改成 `isActive ? 'var(--invert-fg)' : 'var(--text-secondary)'` |
| `components/AdminLayout.tsx:55` | 同上（`--invert-bg` / `--invert-fg`） |
| `components/TocSidebar.tsx:115` | 目录激活项：`background: 'transparent'`、`color: active ? 'var(--text)' : 'var(--text-muted)'`、`borderLeft: active ? '2px solid var(--text)' : '2px solid transparent'`、`fontWeight: active ? 600 : 400` |
| `components/TagCloud.tsx:35` | `background: 'transparent'`、`color: 'var(--text)'`（悬停改 `border-color`，见 §8.5） |
| `index.css:129`（`.tag-badge`） | `background: transparent` |
| `index.css:217`（`blockquote`） | `background: var(--wash)` |
| `pages/admin/AdminDashboardPage.tsx:63,75` | `background: 'var(--wash)'` |

4. 下一轮（或本轮结束）删掉别名。

### 7.5 动效

| 项 | 现状 | 改为 |
|---|---|---|
| `body` 主题过渡 | `background-color .2s, color .2s` | `.15s` |
| `.btn` | `transition-all duration-200` | `transition-colors duration-150` |
| `PostCard` 封面 | `group-hover:scale-105 duration-300` | **删掉**，改 `group-hover:opacity-90` |
| `TagCloud` | `hover:scale-105` | **删掉**，改 `hover:border-[--text]` |
| `.card-hover` | `transform: translateY(-2px)` | 删（§7.4） |
| `.skeleton` shimmer | 保留 | 保留（加载态需要动，与风格无关） |

**原则**：Swiss 的交互反馈靠**线宽、颜色、字重**，不靠位移和缩放。所有 `transform` 微动效全部移除。

---

## 8. 组件层改写清单

全部在 `index.css` 的 `@layer components` 内（替换 `index.css:66-157`）。

### 8.1 `.btn` 族

```css
.btn {
  @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold
         transition-colors duration-150 cursor-pointer
         disabled:opacity-40 disabled:cursor-not-allowed;
  border-radius: 0;
  letter-spacing: 0.01em;
}
.btn-primary            { background: var(--brand); color: var(--brand-fg); }
.btn-primary:hover:not(:disabled)  { background: var(--brand-hover); }
.btn-outline            { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn-outline:hover:not(:disabled)  { border-color: var(--rule); background: var(--surface-hover); }
.btn-danger             { background: transparent; color: var(--danger); border: 1px solid var(--border); }
.btn-danger:hover:not(:disabled)   { border-color: var(--danger); background: var(--danger-soft); }
.btn-ghost              { background: transparent; color: var(--text-secondary); }
.btn-ghost:hover:not(:disabled)    { color: var(--text); background: var(--surface-hover); }
```

**`Navbar.tsx:84` 的 `btn btn-outline ml-2 text-xs`** —— `text-xs`(12px) 会覆盖 `.btn` 的 `text-sm`。Swiss 下按钮统一 14px 更整齐，**建议删掉该处的 `text-xs`**（1 处 JSX 改动）。

### 8.2 `.card` 族

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0;
  box-shadow: none;
  transition: border-color .15s;
}
.card-hover:hover { transform: none; border-color: var(--rule); }

/* 新增：首页/搜索结果的"规则索引"块 —— 只有上边一条强调线，无左右下边框 */
.card-flat {
  border-top: 1px solid var(--rule);
  padding-top: 1.25rem;
  background: transparent;
  transition: none;
}
.card-flat:hover { border-top-color: var(--brand); }
```

**`PostCard.tsx:15`** 从 `className="card card-hover block p-6 group"` 改为 `className="card-flat block pt-5 group"`；
**`PostCard.tsx:19`** 的封面容器 `className="mb-4 -mx-6 -mt-6 overflow-hidden rounded-t-2xl"` → `className="mb-4 -mt-5 overflow-hidden"`（去掉负侧边距与圆角，因为 `.card-flat` 无侧边框）；
**`PostCard.tsx:23`** 删 `transition-transform duration-300 group-hover:scale-105`；
**`SearchPage.tsx:154`** 的 `className="card card-hover block p-5"` → `"card-flat block pt-5"`。

**效果**：首页 9 张卡片从"浮起白盒子"变成**带强调上线的规则索引**，这是本次改造对"设计感"贡献最大的一处。

### 8.3 `.input`

```css
.input {
  @apply w-full px-3.5 py-3 text-sm;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
  transition: border-color .15s, outline-color .15s;
}
.input::placeholder { color: var(--text-muted); }
.input:focus {
  outline: 1px solid var(--brand);
  outline-offset: 0;
  border-color: var(--brand);
  box-shadow: none;              /* 原 0 0 0 4px var(--brand-soft) 光晕 —— Swiss 不要光晕 */
}
/* 新增：下划线式输入（搜索页用，Swiss 表单语汇） */
.input-line {
  @apply w-full px-0 py-3 text-base bg-transparent;
  color: var(--text);
  border: 0;
  border-bottom: 2px solid var(--border);
  border-radius: 0;
}
.input-line:focus { outline: none; border-bottom-color: var(--brand); }
```

**`SearchPage.tsx:90`**：`className="input flex-1"` → `className="input-line flex-1"`（1 处，显著提升"设计感"）。

### 8.4 `.tag-badge`

```css
.tag-badge {
  @apply inline-flex items-center px-2.5 py-0.5 text-xs font-medium transition-colors;
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
}
.tag-badge:hover { border-color: var(--rule); background: var(--surface-hover); }
```

从「品牌色浅底胶囊」变为「中性描边方签」—— 这是单强调色纪律的直接体现，也顺手修掉 §1.4 的违规。

### 8.5 `.spinner` 与 `.skeleton`

```css
.spinner {
  width: 32px; height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--brand);
  border-radius: 50%;                 /* 保持真圆，Don't touch */
  animation: spin .7s linear infinite;
}
.skeleton { border-radius: 0; }       /* 其余保持 */
```

### 8.6 `.markdown-body`（正文排版）

替换 `index.css:163-270`，**保持写在 `@layer` 之外**（高特异性 `.markdown-body xxx` 压过 utility，见 §1.5）：

```css
.markdown-body {
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.75;
  max-width: 68ch;                    /* 新增：瑞士式的舒适行宽 */
  text-spacing-trim: space-first;      /* 渐进增强，见 §5.3 */
  text-autospace: normal;
}
.markdown-body h1 { @apply mb-4 mt-10; font-size: 2.25rem; }
.markdown-body h2 {
  @apply mb-3 mt-12 pb-2;
  font-size: 1.5rem;
  border-bottom: 1px solid var(--rule);   /* ← 强调线，原为 --border */
}
.markdown-body h3 { @apply mb-3 mt-8;  font-size: 1.1875rem; }
.markdown-body h4 { @apply mb-2 mt-6;  font-size: 1rem; }
.markdown-body p  { @apply mb-5; color: var(--text-secondary); }
.markdown-body ul { @apply mb-5 pl-6 list-disc;   color: var(--text-secondary); }
.markdown-body ol { @apply mb-5 pl-6 list-decimal; color: var(--text-secondary); }
.markdown-body li { @apply mb-1.5; }
.markdown-body strong { color: var(--text); font-weight: 700; }
.markdown-body em { font-style: italic; }
.markdown-body a { color: var(--brand); text-decoration: underline; text-underline-offset: 2px; }
.markdown-body a:hover { color: var(--brand-hover); }
.markdown-body blockquote {
  @apply my-6 pl-5 py-3;
  border-left: 4px solid var(--rule);      /* ← 黑粗竖线 */
  background: var(--wash);                 /* ← 中性洗底，非品牌色 */
  border-radius: 0;
  color: var(--text-secondary);
}
.markdown-body blockquote p { margin-bottom: 0; }
.markdown-body code {
  font-family: theme('fontFamily.mono');
  font-size: 0.875em;
  padding: 1px 5px;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--text);                      /* ← 修 4.33:1 违规 */
}
.markdown-body pre {
  @apply my-6 p-5 overflow-x-auto;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  border-radius: 0;
}
.markdown-body pre code { background: transparent; border: 0; padding: 0; color: var(--hl-fg); font-size: 0.875rem; line-height: 1.7; }
.markdown-body img { @apply max-w-full my-6; border-radius: 0; }
.markdown-body table { @apply w-full my-6 border-collapse; }
.markdown-body th, .markdown-body td { @apply px-3 py-2 text-left; border: 1px solid var(--border); }
.markdown-body th { background: var(--surface-hover); font-weight: 700; color: var(--text); border-bottom: 2px solid var(--rule); }
.markdown-body td { color: var(--text-secondary); }
.markdown-body hr { @apply my-8 border-0; border-top: 1px solid var(--rule); }
.markdown-body input[type="checkbox"] { @apply mr-2; }
```

**注意 `pre` 的 `rounded-xl` → `border-radius: 0`**，以及 `img` 的 `rounded-xl` → 0。

### 8.7 `mark`（搜索命中）

```css
.markdown-body mark,
mark.search-hit {
  background: var(--brand-soft);
  color: var(--text);          /* ← 原 var(--brand)，亮色 4.07:1 违规 */
  border-radius: 0;
  padding: 0 2px;
  font-weight: 600;
}
```

### 8.8 TOC 滚动偏移（保持）

```css
.markdown-body h2[id], .markdown-body h3[id], .markdown-body h4[id] { scroll-margin-top: 88px; }
```
`Navbar` 高度 `h-16`(64px) 不变 ⇒ `88px` 仍然正确。**若调整了 Navbar 高度，这里必须同步改**（否则锚点跳转会被导航栏盖住）—— 列入回归点。

---

## 9. 视觉节奏

「设计感」不能只靠换色。以下是三处的**具体**留白与分隔策略。

### 9.1 全局外壳

`Layout.tsx:9`：
```
main: max-w-5xl mx-auto px-4 sm:px-6 py-8
   →  max-w-6xl mx-auto px-6 sm:px-10 py-12 sm:py-16
```
理由：Swiss 需要更宽的**外边距**来承托内容块。`max-w-6xl`(72rem) 给三列网格更多呼吸位，同时 `px-6/px-10` 让内容不贴边。

`Footer.tsx:8-9`：`border-t` 颜色改 `var(--rule)`，内边距 `py-8` → `py-12`。

### 9.2 首页（`HomePage.tsx`）

```
[页头区]
  最新文章                    ← text-3xl, 700
  分享技术学习笔记与思考        ← .t-lead
  ────────────────────────  ← 1px var(--rule)，紧贴页头下方
[间距]  mb-12 sm:mb-16        ← 原 mb-8
[文章网格]
  grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12   ← 原 gap-6
```
页头改为「标题 + 副标题 + 通栏强调线」的结构：`HomePage.tsx:28` 的 `<div className="mb-8">` → `<div className="mb-12 sm:mb-16 pb-6 border-b" style={{ borderColor: 'var(--rule)' }}>`。

**留白原则**：页头之后、分页之前用大留白；卡片之间用 `gap-y-12`（48px）拉开，靠上强调线建立纵向韵律。

### 9.3 文章详情（`PostDetailPage.tsx`）

```
┌─ 眉标行（.t-eyebrow）──────────────────────────┐
│ 2026-08-12 · 8 分钟阅读 · 1.2k 次阅读 · 📁 前端 │
└──────────────────────────────────────────────┘
深入理解 React 虚拟列表原理        ← text-4xl(52px) / 700
────────────────────────────────  ← 1px var(--rule)
[封面图，无边距圆角]
[正文：max-w-[68ch]，h2 带强调下划线]
────────────────────────────────  ← hr
[返回列表]
COMMENTS                            ← .t-eyebrow
[评论区]
```

**改动**：
1. **把元信息行移到标题上方**（Swiss 的 kicker/eyebrow 模式）。`PostDetailPage.tsx:62-113` 的 `<header>` 内，先渲染元信息 `<div>`（`className="t-eyebrow flex flex-wrap items-center gap-4 mb-4"`），再渲染 `<h1>`。这是**唯一一处结构性 JSX 调序**，收益明确。
2. `<h1>` 保留 `text-3xl sm:text-4xl`（改后即 36px → 52px），**删掉 `font-bold`**（字重由标题 CSS 规则接管；留着会误导，且在本构建下 utility 会真的赢——见 §4.4）。
3. `<header>` 加 `pb-8 border-b` + `style={{ borderColor: 'var(--rule)' }}`。
4. 评论区标题（`:136`）`text-xl font-bold` → `className="t-eyebrow mb-4"`。
5. 封面图容器（`:117`）`rounded-2xl` → 删。

### 9.4 归档页（`ArchivePage.tsx`）

改成**左侧大号年份 + 右侧规则行**的两列索引：
```
2026                                        24 篇
────────────────────────────────────────────────
08-12   深入理解 React 虚拟列表原理
08-03   Vite 构建优化笔记
────────────────────────────────────────────────
2025                                        31 篇
...
```
**改动**：
- `:44` 年份 `<h2>` 从 `text-xl` → `text-2xl`，并加 `tabular-nums`；年份块与条目列表用 `grid lg:grid-cols-[10rem_1fr] gap-8` 分列（`:40` 的 `<section>`）。
- 每个 `<li>`（`:55`）加 `border-b py-3`，`borderColor: var(--border)`；最后一项去边框（用 `[&:last-child]:border-0` 或 CSS）。
- 日期列宽 `5.5rem` 保持（`formatDate` 返回固定宽度 `YYYY-MM-DD`，不会溢出，见 §1.5）。

### 9.5 其它页面

| 页面 | 页头结构 |
|---|---|
| `TagsPage` / `CategoriesPage` | `mb-8 text-center` → 与首页一致的非居中左对齐页头 + 通栏强调线。**去掉 `text-center`**（Swiss 版面以左对齐栅格为基础，居中标题是另一种语言） |
| `SearchPage` | 页头 + 下划线输入框（`.input-line`）+ 结果用 `.card-flat` |
| `TagDetailPage` / `CategoryDetailPage` | 同 SearchPage 结构 |
| `NotFoundPage` | `text-8xl` → 颜色改 `var(--text)`，上方加 `border-t-4` + `var(--rule)` 的短横线；`btn-primary` 不变 |
| `EmptyState` | `h3` 保留，`icon` emoji 保留（emoji 与 Swiss 不完全一致，但换成图标要动 i18n 与 7 处调用，本轮不动，列为可选后续） |

---

## 10. 精确文件清单

### 10.1 新增（3 个）

| 绝对路径 | 内容 |
|---|---|
| `D:\学习\前端\Lei-Blog\client\src\assets\fonts\archivo-latin.woff2` | Archivo latin 子集，~20KB |
| `D:\学习\前端\Lei-Blog\client\src\assets\fonts\archivo-latin-ext.woff2` | Archivo latin-ext 子集，~10KB |
| `D:\学习\前端\Lei-Blog\client\src\styles\fonts.css` | 两个 `@font-face`（§4.2），由 `index.css` 顶部 `@import './styles/fonts.css';` 引入 |

### 10.2 修改 —— P0（必需，共 13 个）

| 绝对路径 | 改动要点 |
|---|---|
| `client\src\index.css` | **主战场**：① 替换 `:root`/`.dark` 令牌（§2）② 删 `--border-light`、加 `--brand-light` 别名 ③ `@import './styles/fonts.css'` ④ 加非分层标题默认值（§4.4）⑤ 改 `@layer components` 全部组件类（§8.1-8.5）⑥ 重写 `.markdown-body`（§8.6）⑦ 删 `.light-code`/`.dark-code` 两块（71 行）⑧ hl token 收敛到 4 值（§3.4）⑨ 修 `mark`（§8.7）⑩ 加全局 `:focus-visible`（§7.3） |
| `client\tailwind.config.ts` | ① `fontFamily`：新增 `heading`、`sans` 删 `Inter` ② 新增 `fontSize` 扩展（§6.2）③ 新增 `borderRadius` override（§7.1）④ **删掉死配置 `typography`**（未装插件） |
| `client\src\components\Navbar.tsx` | :30（激活态改 `--invert-*`）、:35-36（去毛玻璃改不透明）、:43（SVG `rx="8"` → `rx="0"`，`fill` 改 `var(--brand)`）、:54/64/94/111（删 `rounded-full`）、:84（删 `text-xs`）、:142/151（移动端 `rounded-xl` 自动归零，激活态改 `--invert-*`） |
| `client\src\components\AdminLayout.tsx` | :40-41（SVG `rx="8"` → 0、`fill` 改 `var(--brand)`）、:55（激活态改 `--invert-*`）、:67（可见菜单项同改） |
| `client\src\components\PostCard.tsx` | :15 `card card-hover p-6` → `card-flat pt-5`、:19 封面容器、:23 删 scale、:30 标题 `text-xl` 保留但删 `font-bold`（字重由 CSS 接管）、:51 `text-xs` → `text-meta` |
| `client\src\components\Pagination.tsx` | :53 删 `rounded-full`、:56 `'#fff'` → `'var(--brand-fg)'`、:48 `...` 省略号颜色改 `--text-muted` |
| `client\src\components\TagCloud.tsx` | :32 删 `rounded-full hover:scale-105`、:35-36 `--brand-light`/`--brand` → 透明底/`--text`、加 `hover:border-[color:var(--rule)]` |
| `client\src\components\TocSidebar.tsx` | :108 删 `rounded-lg`、:114-117 激活态改 `--text` + 2px `--text` 左线、:135 `t-eyebrow`、:145 移动端 `.card` 保留 |
| `client\src\components\ThemeSwitcher.tsx` | :82/96/109 删 `rounded-full`、:112 `'#fff'` → `'var(--brand-fg)'` |
| `client\src\components\LanguageSwitcher.tsx` | :14/26 删 `rounded-full`、:29 `'#fff'` → `'var(--brand-fg)'` |
| `client\src\pages\PostDetailPage.tsx` | :62-113 header 调序（元信息到标题上方 + eyebrow 类）、:63 删 `font-bold`、:117 删 `rounded-2xl`、:126 hr 颜色改 `--rule`、:136 评论标题改 `t-eyebrow`、:24 错误 h1 |
| `client\src\pages\HomePage.tsx` | :28 页头加底线、:32 `t-lead`、:54 `gap-x-8 gap-y-12` |
| `client\src\pages\ArchivePage.tsx` | :16 页头加底线、:20 `t-lead`、:40 两列 grid、:44 年份 `text-2xl tabular-nums`、:55 条目加底边框 |

### 10.3 修改 —— P1（打磨，共 12 个）

| 绝对路径 | 改动要点 |
|---|---|
| `client\src\pages\SearchPage.tsx` | :90 `.input` → `.input-line`、:154 `card-flat`、:73 页头、:76 `t-lead` |
| `client\src\pages\TagsPage.tsx` | :12 去 `text-center` + 页头加底线、:16 `t-lead` |
| `client\src\pages\CategoriesPage.tsx` | :13 去 `text-center` + 页头加底线、:17 `t-lead`、:40 `card-flat` |
| `client\src\pages\TagDetailPage.tsx` | 页头结构统一 |
| `client\src\pages\CategoryDetailPage.tsx` | 页头结构统一 |
| `client\src\pages\AboutPage.tsx` | :39 footer 边框改 `--rule`、`text-xs` → `text-meta` |
| `client\src\pages\NotFoundPage.tsx` | :9 颜色改 `var(--text)`，加 `--rule` 短横线 |
| `client\src\components\EmptyState.tsx` | :11 `text-lg` → `text-xl`；emoji 可选替换 |
| `client\src\components\Footer.tsx` | :8 边框改 `--rule`、:9 `py-12`、:10 `text-meta` |
| `client\src\components\Layout.tsx` | :9 `max-w-6xl px-6 sm:px-10 py-12 sm:py-16` |
| `client\public\favicon.svg` | `rx="8"` → `rx="0"`、`#3377ff` → `#E4002B` |
| `client\src\components\CommentSection.tsx` | :34 `rounded-2xl border-dashed` 保留 dashed、圆角归零；**:37 emoji 的 `text-3xl` → `text-2xl`**（见 §6.1 例外）；建议在 `PostDetailPage` 侧加 eyebrow 标题（已在 P0 覆盖） |

### 10.4 修改 —— admin 收尾（4 个，只改令牌引用，不做版面重构）

| 绝对路径 | 改动要点 |
|---|---|
| `client\src\pages\admin\AdminPostEditPage.tsx` | :186/197/222 `'#fff'` → `'var(--brand-fg)'`／状态填充改用 `--invert-bg`+`--invert-fg`、:104 alert 圆角归零 |
| `client\src\pages\admin\AdminPostListPage.tsx` | :66 `'#fff'` → `'var(--invert-fg)'`、:100 删 `rounded-full`、:102-103 状态色 |
| `client\src\pages\admin\AdminDashboardPage.tsx` | :63/75 `--brand-light` → `--wash`、:45 圆角归零（自动） |
| `client\src\pages\admin\AdminLoginPage.tsx` / `AdminTagListPage.tsx` / `AdminAboutEditPage.tsx` | 圆角自动归零，仅回归验证 |

> **admin 的范围决定**：admin 与前台共用 `--*` 变量与 `.btn/.card/.input/.tag-badge`，因此**换肤自动生效，不做版面重构**。额外工作仅限上表的硬编码色修复（这些本来就是违规项）。理由：admin 是单人使用的工具界面，为它重做 Swiss 版面没有用户收益，反而是回归风险。
> **唯一的例外**：admin 的**中文/英文 label 与状态胶囊**必须回归验证（见 §11）。

### 10.5 明确**不需要修改**的文件（避免无谓改动）

| 路径 | 为什么不用动 |
|---|---|
| `client\src\App.tsx`、`main.tsx` | 纯路由/挂载，无视觉 |
| `client\index.html` | 防闪白脚本契约不变；主题切换机制（`html.dark` + `color-scheme`）不涉及本次改造。**除非**采用 §4.3 的 preload 方案（已否决） |
| `client\vite.config.ts` | 字体放 `src/assets/` 由 Vite 自动处理，无需改配置（不调 `assetsInlineLimit`） |
| `client\postcss.config.js`、`eslint.config.js`、`tsconfig*.json` | 无涉及 |
| `client\src\context\*`（`ThemeContext` / `ThemeProvider` / `AuthContext` / `AuthProvider`） | 主题机制不动，`resolvedTheme` 继续供 Giscus 使用 |
| `client\src\hooks\*`（9 个） | 纯数据逻辑 |
| `client\src\api\index.ts`、`types\index.ts`、`utils\*`（3 个） | 纯逻辑 |
| `client\src\i18n\**` | **本轮不加新文案**，`.t-eyebrow`/`.t-lead` 是纯样式类，不需要 i18n key |
| `client\src\components\Highlight.tsx` | 逻辑正确（无 `dangerouslySetInnerHTML`），配色由 CSS 的 `mark` 规则接管 |
| `client\src\components\MarkdownRenderer.tsx` | `light-code`/`dark-code` 类名保留（无副作用），`rehypePlugins` 不动 |
| `client\src\utils\extractToc.ts` | slug 算法不动（改动会破坏锚点） |
| `client\src\components\ProtectedRoute.tsx`、`Spinner.tsx`（逻辑） | 无视觉逻辑 |
| `server\**` | 纯前端改造 |
| `deploy\nginx.conf.example` | `/assets/` 的 immutable 缓存已就位，字体正好受益，无需改 |

---

## 11. 风险与回归点

### 11.1 最容易出回归的 3 个点（按风险排序）

**① 标题字重：非分层标题规则**不**能压过 utilities —— 挡板只有"标题不带字重 utility"这条约定**

⚠️ **更正**：原表述「非分层规则优先于 `@layer utilities`」**在本构建下不成立**。Tailwind v3 会把 `@layer` **展平**，`dist` 产物里**没有任何原生级联层**（自证：`grep -o "@layer" dist/assets/*.css | wc -l` → 0）。因此 `index.css` 里那段 `h1,h2,h3,h4 { … font-weight: 600 }` 与 `.font-bold` **同处非分层区**，胜负只由**特异性**决定：`.font-bold`(0,1,0) > `h2`(0,0,1) ⇒ **utility 赢、CSS 被压过**。后果：
- **标题上若带 `font-bold`/`font-semibold`，它会**真的生效**并静默偏离设计系统**（例：admin 的 `<h2 class="font-bold">` 会渲染成 700，而设计是 600 —— 这正是本次收口修掉的那处）。
- 所以护栏是**约定**，不是机制保证：**标题元素（h1~h6）不得携带任何字重 utility**。审计命令：`grep -rn "<h[1-6][^>]*font-" client/src`（预期 0 命中）。
- `.markdown-body h2/h3/h4` 的既有规则因为**特异性更高**（0,1,1 vs utility 0,1,0）仍然生效，行为正确。
- 只想改某级标题字重 → 改 `index.css` 的标题规则，**不要**在 JSX 上加 `font-*` 类。
- **回归验证**：打开 6 个前台页面 + 4 个 admin 页面，逐个确认标题字体、字重（h1=700、h2/h3/h4=600）、无溢出。

**② 暗色下 `--brand-fg` 是近黑而非白 —— 漏改任何一处 `#fff` 就报错色**

暗色主题的 `--brand: #FF4D4D` 是浅红，`#fff` 在其上只有 **3.27:1**（不达标）。而**亮色下 `#fff` 恰好是对的**（4.85:1）—— 这意味着**在亮色下测不出问题，只有切到暗色才暴露**。8 处硬编码 `#fff`（§1.1 表）必须逐处改掉。
- **回归验证**：切到暗色（或 `system` + 系统深色），逐个页面/控件检查：语言切换、主题切换、分页当前页、Markdown 编辑器模式切换、后台状态筛选、后台标签多选、后台发布状态按钮。**用取色器实测对比度 ≥ 4.5:1。**

**③ 防闪白内联脚本 / 主题契约被无意破坏**

`index.html:9-30` 的同步内联脚本与 `ThemeContext.tsx` 的 `THEME_STORAGE_KEY`(`'theme'`)、`DARK_MEDIA_QUERY`、合法值域（`light|dark|system`）、脏数据回落 `system` 四点必须完全一致。本次改造**不需要改这两个文件中的任何一行**，但如果有人为了"顺手优化"改动其中之一（例如把 88% 透明度改成 100% 时误删脚本，或调整断点），就会立刻出现首屏闪白/闪黑。
- **回归验证**：三种主题态（`light`/`dark`/`system`）× 刷新页面，用 DevTools Performance 录制，**逐帧检查第一帧 `<html>` 是否已带 `dark` class**、首帧背景色是否正确。同时测 `localStorage.theme` 写入非法值（如 `"darkk"`）时是否回落 `system` 而非闪白。

### 11.2 其余回归点

| # | 风险 | 应对 |
|---|---|---|
| 1 | **Giscus 评论外框与瑞士风冲突** | Giscus 是跨域 iframe，**外部 CSS 无法穿透**。处置：① **P1 —— 保留 Giscus 内置 `light`/`dark` 主题**，在其外围加瑞士式框架（`PostDetailPage.tsx:135` 的区块加 `border-t` + `.t-eyebrow` 标题）；② **P2（可选）—— 用 Giscus 自定义主题**：`theme={`${location.origin}/giscus/swiss-{light\|dark}.css`}`，把 CSS 放 `client/public/giscus/`（`public/` 不加哈希 ⇒ URL 稳定，这里正好需要）。**必须先验证 CSS 可取到**，因为 Giscus 若拉取失败可能渲染成无样式，风险高于收益 —— 因此**默认不做**，仅在你确认可回滚时再上 |
| 2 | **TOC 侧栏激活态与滚动偏移** | `TocSidebar.tsx` 的 IntersectionObserver `rootMargin: '-88px 0px -60% 0px'` 与 `.markdown-body hN[id]` 的 `scroll-margin-top: 88px` **成对依赖 Navbar 的 64px 高度**。本次不改 Navbar 高度 ⇒ 保持 88。**若调整了 `Navbar` 的 `h-16`，这两处必须同步改**（3 个位置：JSX `rootMargin`、CSS `scroll-margin-top`、`.sticky top-24`） |
| 3 | **代码高亮配色可读性** | 从 5-6 色相收敛到 3 色相 + 灰，**必须实测**：暗色下打开一篇含 JS/SQL/CSS/Bash 代码块的文章，逐个 token 类型确认可分辨（关键字 vs 字符串 vs 注释 vs 函数名）。断言 `--hl-*` 四值与 `--code-bg` 的对比度全部 ≥ 4.5:1 |
| 4 | **i18n 中英文案长度导致溢出** | 全部 `formatDate` 返回 `YYYY-MM-DD`（§1.5），日期列不溢出。**真正的风险点**：<br>• **Navbar**：`hidden sm:flex` 在 **640px** 下要放下 5 个链接 + 搜索 + 语言 + 主题 + 登录按钮，英文 label（`Home/Archive/Categories/Tags/About`）明显长于中文。**处置：断点从 `sm` 提升到 `lg`**（1 处 JSX，`Navbar.tsx:49`），并把容器改为 `max-w-6xl`。**这条建议无论是否换肤都该做**<br>• **admin 移动端底部导航**：`text-[10px]` 的 `Dashboard/Posts/Tags/Edit About` 在 4 列 flex 中，「Edit About」可能换行 → 加 `whitespace-nowrap` + 缩小内边距<br>• **`SearchPage` 未配置评论的引导文案**（`comment.setupHint`）英文很长 → 在容器内正常折行，无溢出风险<br>**验证**：中英各切一次，在 375 / 640 / 768 / 1024 / 1440px 五档宽度下截图对比，确认无横向滚动条（`document.documentElement.scrollWidth <= clientWidth`） |
| 5 | **`.card` 改 `card-flat` 后首页观感** | 卡片去掉四边框后，9 个卡片的区分**完全依赖上强调线**。需确认三列网格下纵向节奏是否清晰；若觉得散，退路是把 `card-flat` 的上线改为 `var(--border)` 而非 `var(--rule)`（弱化）。**这是唯一一处「效果需目视确认」的地方，其余都有硬指标** |
| 6 | **字体未加载时的降级一致性** | Archivo 拉取失败/慢时，`font-family: 'Archivo', system-ui, ...` 会自动落到系统栈，标题仍是黑体、无豆腐块。**但要确认 `unicode-range` 写对**（写错会让 CJK 也走 Archivo → 豆腐块）。**验证**：DevTools 断网 + 清空缓存，确认标题正常显示为系统字体而非方块 |
| 7 | **构建体积回归** | 新增 2 个 woff2 约 30KB。`vite build` 后对比 `dist/assets/` 总体积，确认**增量 < 40KB**。若字体被内联成 base64（说明 `assetsInlineLimit` 被调过），需检查配置 |
| 8 | **`--brand-light` 别名忘记删** | 本轮保留 `--brand-light: var(--wash)` 别名是为了安全迁移。**遗留风险是有朝一日没人记得删**。处置：在 `index.css` 该行上加 `/* @deprecated SWISS-MIGRATION: 迁移完成后删除 */` 注释，并写进本文件的 §7.4 |

### 11.3 施工顺序（降低返工）

```
S1  tailwind.config.ts（fontSize / borderRadius / fontFamily）    ← 先做，改动面最大但最独立
S2  字体资产（下载 + 子集 + fonts.css）                             ← 可与 S1 并行
S3  index.css 令牌层（:root / .dark / 别名 / 删 --border-light）    ← 此时全站颜色已变
S4  index.css 排版层（非分层标题规则 + .markdown-body + code token）
S5  index.css 组件层（@layer components 全部）
S6  16 处 rounded-full 清理 + 8 处 #fff → 变量                     ← 机械替换，脚本化
S7  Navbar / AdminLayout / PostCard / TocSidebar / Pagination / TagCloud / ThemeSwitcher / LanguageSwitcher
S8  页面层：PostDetail（含调序）→ Home → Archive → Search → Tags/Categories → About / 404
S9  admin 收尾（4 个文件的硬编码色）
S10 favicon.svg
S11 三绿验收：tsc -b / eslint . / vite build
S12 双主题 × 中英 × 5 档宽度的视觉回归
```

**每一步之后都跑一次 `npm run build`**，避免把编译错误累积到最后。

---

## 12. 验收标准（可机械执行）

| # | 项 | 判定 |
|---|---|---|
| 1 | 构建 | `cd client && npx tsc -b && npx eslint . && npx vite build` 全部退出码 0 |
| 2 | 字体体积 | `ls -l client/src/assets/fonts/` 两文件合计 **< 40KB** |
| 3 | 无圆角残留 | `grep -rn "rounded-full" client/src` 结果中**只允许**出现在 `.spinner` 无关位置（应为 0 处，`.spinner` 用 CSS `border-radius: 50%`） |
| 4 | 无硬编码白字 | `grep -rn "'#fff'\|#ffffff" client/src` 中**只允许** `index.css` 的 `--brand-fg` / `--invert-fg` 定义行 |
| 5 | 强调色唯一 | `grep -rn "#3377ff\|#1f57f5\|#599fff" client/src client/public` 返回 0 处（旧蓝色已清除，含 favicon） |
| 6 | 对比度 | 用 §3.1 公式对 §3.2/§3.3 表格的每一行复算，全部 ≥ 4.5:1 |
| 7 | 代码 token | 4 个 `--hl-*` 对 `--code-bg` 均 ≥ 4.5:1，两套主题各测一次 |
| 8 | 双主题 | `light` / `dark` 各逐页检查，无元素沿用另一主题的颜色 |
| 9 | 三态 + 防闪白 | `light`/`dark`/`system` × 刷新，首帧无闪白；系统深色切换实时跟随 |
| 10 | 无横向滚动 | 375/640/768/1024/1440px × 中英，`scrollWidth <= clientWidth` |
| 11 | 功能无损 | 文章列表/详情/TOC 锚点跳转/搜索（含中文命中）/归档/分类/标签/后台登录+发布+改标签，全部通过 |
| 12 | 线上 | 部署后 `https://<域名>` 首页、详情、后台均正常；`index.html` 仍 `no-cache`，`/assets/*` 仍 `immutable` |
