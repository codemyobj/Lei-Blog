// 阅读时长估算：去除 Markdown 语法符号后统计中文字符 + 英文单词
// 中文阅读速度约 300-400 字/分，英文约 200-250 词/分，取折中 200 单位/分钟
export function estimateReadingTime(content: string, wpm = 200): number {
  if (!content) return 1
  // 去除 Markdown 语法符号：# * ` > ( ) [ ] ! ~ _ -
  // 字符类里 `\[` 无需转义（非 u 模式下 `[` 即字面量），但 `\]` 必须转义，
  // 且要放在其它成员之前，否则会提前关闭字符类。`\-` 同样必须转义，
  // 否则 `>-`、`-[` 会被解析成区间，误删 A-Z 等字符。
  const text = content.replace(/[#*`>()[\]!~_-]/g, '')
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length
  const totalUnits = chineseChars + englishWords
  return Math.max(1, Math.ceil(totalUnits / wpm))
}
