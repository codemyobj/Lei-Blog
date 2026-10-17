/**
 * Doodles —— 全站常驻的手绘涂鸦层（轻松手账风的标志性元素）。
 *
 * 设计来源：lei-blog-journal-preview.html 的 .doodles 块（用户已验收）。
 *
 * 硬性约束（逐条对应规格）：
 * 1. **不挡点击**：外层 pointer-events:none，且每个 svg 也不挂交互。
 * 2. **不占文档流**：position:fixed + inset:0，绝不参与布局，
 *    因此不会把文档撑宽（横向滚动验收里专门断言了这一点）。
 * 3. **屏幕阅读器完全跳过**：aria-hidden="true"。
 * 4. **零字节**：五个内联 SVG，不走网络请求。
 * 5. **只在边角留白区**：内容容器有 max-width 且居中，宽屏下左右边距是空的；
 *    窄屏靠媒体查询收敛（1240px 收成 2 个，860px 缩小并移位）。
 * 6. **暗色降透明度**：.42 → .30，避免暗底下抢戏。
 *
 * 为什么是 fixed 而不是 absolute：长文页面滚动时，absolute 的涂鸦会滚走；
 * fixed 让它们成为"常驻点缀"。
 */
export default function Doodles() {
  return (
    <div className="doodles" aria-hidden="true">
      {/* 星星：右上 */}
      <svg
        className="d-star"
        viewBox="0 0 40 40"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M20 4 L24 15 L36 16 L26.5 24 L30 36 L20 29 L10 36 L13.5 24 L4 16 L16 15 Z" />
      </svg>

      {/* 心：左下 */}
      <svg
        className="d-heart"
        viewBox="0 0 40 40"
        fill="none"
        stroke="var(--mint-fg)"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M20 34 C6 25 4 14 12 9 C17 6 20 11 20 14 C20 11 23 6 28 9 C36 14 34 25 20 34 Z" />
      </svg>

      {/* 螺旋：左中 */}
      <svg
        className="d-spiral"
        viewBox="0 0 40 40"
        fill="none"
        stroke="var(--lav-fg)"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M20 20 m-16 0 a16 16 0 1 1 32 0 a13 13 0 1 1 -26 0 a10 10 0 1 1 20 0 a7 7 0 1 1 -14 0" />
      </svg>

      {/* 波浪：右下 */}
      <svg
        className="d-wave"
        viewBox="0 0 40 40"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M4 26 q9 -14 18 0 t18 0" />
        <path d="M4 14 q9 -14 18 0 t18 0" opacity=".55" />
      </svg>

      {/* 叶子：右上偏左 */}
      <svg
        className="d-leaf"
        viewBox="0 0 40 40"
        fill="none"
        stroke="var(--mint-fg)"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M20 36 C8 30 6 16 20 5 C34 16 32 30 20 36 Z" />
        <path d="M20 36 L20 12" />
      </svg>
    </div>
  )
}
