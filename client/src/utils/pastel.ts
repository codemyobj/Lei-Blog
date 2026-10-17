/**
 * 粉彩贴纸轮换工具。
 *
 * 手账风的标签不用中性描边，而是六组粉彩「贴纸」。颜色按 id 取模轮换，
 * 保证同一个标签在任何页面、任何语言下颜色稳定（不靠 DOM 顺序 ——
 * 列表顺序一变颜色就跳，观感会很乱）。
 *
 * 底/字成对定义在 index.css 的 .pastel-* 里（单一来源），
 * 六组的文字对比度均已实测 ≥4.5:1，见 scripts/verify-contrast.mjs。
 */

export const PASTEL_KEYS = ['peach', 'mint', 'lav', 'sky', 'rose', 'butter'] as const

export type PastelKey = (typeof PASTEL_KEYS)[number]

/** 由稳定 id 取模得到粉彩组名（id 缺失时退回 peach） */
export function pastelKey(id: number | string | undefined): PastelKey {
  const n = typeof id === 'number' ? (Number.isFinite(id) ? id : hashString(String(id))) : typeof id === 'string' ? hashString(id) : 0
  return PASTEL_KEYS[Math.abs(n) % PASTEL_KEYS.length]
}

/** 返回形如 "pastel-mint" 的类名，直接拼在 className 上 */
export function pastelClass(id: number | string | undefined): string {
  return `pastel-${pastelKey(id)}`
}

/** 字符串稳定哈希（FNV-1a 变体）：用于只有 slug 没有数字 id 的场景 */
function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
