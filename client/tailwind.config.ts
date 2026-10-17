import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* ------------------------------------------------------------
         字体族
         - sans：正文 = 中文优先的系统无衬线栈（PingFang / HarmonyOS / MiSans /
           Microsoft YaHei），零额外请求。手账风的中文正文手感优先。
         - display：**与 sans 同族** —— 手账风的标题就是黑体，不再用衬线。
           实际 font-family 由 index.css 的 --font-display 提供（非分层 h1~h4 规则），
           这里只是「JSX 想显式用衬线时」的出口（当前无消费点，保留以备不时之需）。
         - hand：手写体（系统楷体，零字节）—— 小标注 / 引文 / 图注。
         - mono：meta / 编号 / 日期 = 等宽。
         ⚠️ 全站**没有任何自托管字体**：Newsreader（26,428 B）与 Archivo（38,752 B）
            已在视觉方向变更中全部移除，dist 里 woff2 数量为 0。
         ------------------------------------------------------------ */
      fontFamily: {
        sans: [
          'PingFang SC',
          'HarmonyOS Sans SC',
          'MiSans',
          'Microsoft YaHei',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        display: [
          'PingFang SC',
          'HarmonyOS Sans SC',
          'MiSans',
          'Microsoft YaHei',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        hand: ['KaiTi', 'STKaiti', 'Kaiti SC', 'Baskerville', 'cursive'],
        mono: ['ui-monospace', 'Cascadia Code', 'Fira Code', 'Consolas', 'monospace'],
      },

      /* ------------------------------------------------------------
         排版尺度
         - 文章详情标题 = clamp(32px, 5vw, 54px)（预览 h1.hero）
         - 页面 h1      = 36px
         - 正文 h2      = 26px（荧光笔标题，见 index.css）
         - 卡片标题     = 18px
         ------------------------------------------------------------ */
      fontSize: {
        // [size, { lineHeight, letterSpacing }]
        xs: ['0.75rem', { lineHeight: '1.5' }], // 12px
        sm: ['0.875rem', { lineHeight: '1.6' }], // 14px
        base: ['1rem', { lineHeight: '1.75' }], // 16px 正文（中文行高下限）
        lg: ['1.125rem', { lineHeight: '1.6' }], // 18px
        xl: ['1.25rem', { lineHeight: '1.45', letterSpacing: '-0.01em' }], // 20px
        '2xl': ['1.5rem', { lineHeight: '1.3' }], // 24px
        '3xl': ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.02em' }], // 36px 页面 h1
        '8xl': ['6rem', { lineHeight: '1' }], // 96px 404
        // 语义刻度
        'post-title': ['clamp(32px, 5vw, 54px)', { lineHeight: '1.18', letterSpacing: '-0.02em' }],
        hand: ['0.875rem', { lineHeight: '1.6', letterSpacing: '0.02em' }], // 14px 手写标注
        meta: ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0.04em' }], // 13px 元信息（等宽）
      },

      /* ------------------------------------------------------------
         圆角：**恢复有圆角的体系**（手账感的核心）。
         取值与 lei-blog-journal-preview.html 一致：
         卡片 16 / 代码块·表格·引文 14 / 输入框 10 / 图集格 12 / 标签按钮全圆角。
         ------------------------------------------------------------ */
      borderRadius: {
        none: '0px',
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '14px',
        '2xl': '16px',
        '3xl': '20px',
        full: '9999px',
      },

      /* ------------------------------------------------------------
         阴影：手账卡的"贴上去"质感。默认阴影从 1 层加到 2 层，
         工具类名不变（shadow / shadow-lg 等仍可继续用）。
         ------------------------------------------------------------ */
      boxShadow: {
        DEFAULT:
          '0 1px 2px rgba(42,39,36,.05), 0 8px 24px -12px rgba(42,39,36,.14)',
        md: '0 1px 2px rgba(42,39,36,.05), 0 8px 24px -12px rgba(42,39,36,.14)',
        lg: '0 2px 4px rgba(42,39,36,.05), 0 18px 40px -16px rgba(42,39,36,.20)',
        xl: '0 2px 4px rgba(42,39,36,.05), 0 24px 48px -18px rgba(42,39,36,.24)',
        '2xl': '0 4px 8px rgba(42,39,36,.05), 0 32px 64px -20px rgba(42,39,36,.28)',
        inner: 'inset 0 0 0 1px var(--border)',
        none: 'none',
      },
    },
  },
  plugins: [],
} satisfies Config
