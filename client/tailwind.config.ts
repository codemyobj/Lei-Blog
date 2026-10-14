import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* ------------------------------------------------------------
         字体族
         - sans：正文 = 系统无衬线栈，零额外请求。
           **刻意删掉 'Inter'**（全库无 @font-face / <link> 加载它，留在栈首
           会让"装了 Inter 的用户"和"没装的用户"看到不同字体）。
         - display：标题/引文/首字下沉 = Newsreader（自托管拉丁衬线）优先，
           CJK 自动落到后面的**系统宋体栈**（思源宋体效果最好，见 font-test.png）。
           中文不引 webfont：正文在 PostgreSQL，构建期拿不到字符集，无法子集化。
           ⚠️ 标题的 font-family 实际由 index.css 的 --font-display 提供（非分层 h1~h4 规则），
              这里的 display 家族只是「JSX 想显式用衬线时」的出口。
         - mono：meta / 编号 / 日期 = 等宽（杂志排版的元信息语汇）
         ------------------------------------------------------------ */
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans CJK SC',
          'sans-serif',
        ],
        display: [
          'Newsreader',
          'Noto Serif SC',
          'Source Han Serif SC',
          'Songti SC',
          'STSong',
          'SimSun',
          'Georgia',
          'serif',
        ],
        mono: ['ui-monospace', 'Cascadia Code', 'Fira Code', 'Consolas', 'monospace'],
      },

      /* ------------------------------------------------------------
         排版尺度：**重定义既有刻度**，而不是新增语义类（post-title 除外）。
         杂志化编辑风的取值来自已批准预览 lei-blog-editorial-preview.html：
         - 文章详情标题 = clamp(34px,5.2vw,60px) / 600 / 1.12 / -0.02em
         - 页面 h1      = 36px
         - 正文 h2      = 27px / 600 / -0.015em
         - 卡片标题     = 19px / 600 / 1.4
         ⚠️ text-4xl 已删除：文章标题改用 text-post-title（clamp）后无消费点。
         ------------------------------------------------------------ */
      fontSize: {
        // [size, { lineHeight, letterSpacing }]
        xs: ['0.75rem', { lineHeight: '1.5' }], // 12px
        sm: ['0.875rem', { lineHeight: '1.6' }], // 14px
        base: ['1rem', { lineHeight: '1.75' }], // 16px 正文（中文行高下限）
        lg: ['1.125rem', { lineHeight: '1.55' }], // 18px
        xl: ['1.1875rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }], // 19px 卡片标题
        '2xl': ['1.6875rem', { lineHeight: '1.28', letterSpacing: '-0.015em' }], // 27px 正文 h2
        '3xl': ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.02em' }], // 36px 页面 h1
        '8xl': ['6rem', { lineHeight: '1' }], // 96px 404
        // 新增语义刻度
        'post-title': [
          'clamp(34px, 5.2vw, 60px)',
          { lineHeight: '1.12', letterSpacing: '-0.02em' },
        ], // 文章详情标题（取自已批准预览）
        eyebrow: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.18em' }], // 11px 全大写 kicker/眉标
        meta: ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0.04em' }], // 13px 元信息（等宽）
      },

      /* ------------------------------------------------------------
         圆角：全部归零。杂志化编辑风继承瑞士风的「线而非圆角」纪律。
         ⚠️ 刻意**不覆盖 `full`** —— rounded-full 的"真圆"语义必须保留
            （.spinner 的 border-radius: 50% 走 CSS，不受影响）。
         ------------------------------------------------------------ */
      borderRadius: {
        none: '0px',
        sm: '0px',
        DEFAULT: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
      },
    },
  },
  plugins: [],
} satisfies Config

/* 已删除的死配置（历次换肤顺带清理）：
   1. `colors.brand.{50..900}` —— 全库 0 处引用，且其中 500/600/400 是旧品牌蓝。
   2. `typography` —— @tailwindcss/typography 从未安装（plugins: []），prose 0 处使用。
   3. `fontFamily.heading`（原 Archivo）—— 杂志化后标题改走 --font-display（衬线），
      全库无 `font-heading` 类消费点，故整个条目删除；Archivo woff2 与 @font-face 一并移除。
   4. `fontSize['4xl']` —— 文章标题改用 text-post-title（clamp）后 0 消费点。 */
