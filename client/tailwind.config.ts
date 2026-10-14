import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* ------------------------------------------------------------
         字体族
         - sans：正文 = 系统栈，零额外请求；**刻意删掉 'Inter'**
           （全库无 @font-face / <link> 加载它，留在栈首会让"装了 Inter 的用户"
             和"没装的用户"看到不同字体 —— 排版改造里渲染确定性优先）
         - heading：标题 = Archivo 优先，CJK 自动落到后面的系统黑体
           （靠 fonts.css 的 unicode-range 分流，零 JS）
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
        heading: [
          'Archivo',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans CJK SC',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'Cascadia Code', 'Fira Code', 'Consolas', 'monospace'],
      },

      /* ------------------------------------------------------------
         排版尺度：**重定义既有刻度**，而不是新增语义类。
         text-3xl / text-4xl / text-2xl 的使用位置几乎全是标题，
         改这里的数值 = 一次改完全站标题字号，JSX 零改动。
         关键跳变：text-3xl 30px→36px，text-4xl 36px→52px。
         ------------------------------------------------------------ */
      fontSize: {
        // [size, { lineHeight, letterSpacing }]
        xs: ['0.75rem', { lineHeight: '1.5' }], // 12px
        sm: ['0.875rem', { lineHeight: '1.6' }], // 14px
        base: ['1rem', { lineHeight: '1.75' }], // 16px 正文（中文行高下限）
        lg: ['1.125rem', { lineHeight: '1.55' }], // 18px Lead
        xl: ['1.25rem', { lineHeight: '1.35', letterSpacing: '-0.01em' }], // 20px 卡片标题
        '2xl': ['1.5rem', { lineHeight: '1.28', letterSpacing: '-0.02em' }], // 24px 正文 h2
        '3xl': ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.03em' }], // 36px 页面 h1
        '4xl': ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.035em' }], // 52px 文章标题
        '8xl': ['6rem', { lineHeight: '1' }], // 96px 404
        // 新增语义刻度（仅在新写的标记里使用）
        eyebrow: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.14em' }], // 11px 全大写眉标
        meta: ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0' }], // 13px 元信息
      },

      /* ------------------------------------------------------------
         圆角：全部归零。Swiss 用线而非圆角来做分隔与层级。
         ⚠️ 刻意**不覆盖 `full`** —— rounded-full 的"真圆"语义必须保留
            （.spinner 的 border-radius: 50% 走 CSS，不受影响）。
            剩下 15 处 rounded-full 调用点改为手工删除。
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

/* 已删除的死配置（本次换肤顺带清理）：
   1. `colors.brand.{50..900}` —— 全库 0 处引用（grep 'brand-[0-9]' 无命中），
      且其中 500/600/400 就是本次要清除的旧品牌蓝。
   2. `typography` —— @tailwindcss/typography 从未安装（plugins: []），
      `prose` 类全库 0 处使用；全站正文排版是 index.css 的 .markdown-body 手写规则。
      装上插件会引入第二套并行排版体系。 */
