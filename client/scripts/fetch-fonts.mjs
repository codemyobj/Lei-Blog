// 步骤 1/2：从 Google Fonts 取 Newsreader 的 latin / latin-ext woff2 原始文件
//
// 用法：node scripts/fetch-fonts.mjs [variable|static]
//   variable（默认）：opsz 6..72 + wght 200..800 全轴可变字体 —— 一个文件覆盖所有字重，
//                     且保留 opsz 轴让浏览器按字号自动选光学尺寸（编辑排版的正解）。
//   static         ：仅 wght 600 的静态实例 —— 体积更小，但失去可变字重与光学尺寸。
// 产物：.fontraw/newsreader-latin.woff2、.fontraw/newsreader-latin-ext.woff2（已 gitignore）
// 之后必须再跑 scripts/subset-fonts.sh 得到最终产物。
//
// ⚠️ Windows 上 curl 会因 schannel 吊销检查离线而失败（CRYPT_E_REVOCATION_OFFLINE），
//    所以这里用 Node 的 https 模块直连。
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'

const MODE = process.argv[2] === 'static' ? 'static' : 'variable'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const OUT_DIR = path.resolve(import.meta.dirname, '../.fontraw')

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': UA } }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`${res.statusCode} for ${url}`))
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
}

// Newsreader 轴：ital 0..1、opsz 6..72、wght 200..800。
// 编辑风标题统一 600，引文/首字下沉也在这个区间，故取覆盖 400..700 的区间最划算；
// 若要"一个文件吃下所有字重"则取 200..800，但体积更大。
const FAMILY_QUERY =
  MODE === 'static'
    ? 'family=Newsreader:opsz,wght@6..72,600'
    : 'family=Newsreader:opsz,wght@6..72,400..700'

const css = (await get(`https://fonts.googleapis.com/css2?${FAMILY_QUERY}&display=swap`)).toString(
  'utf8'
)

fs.mkdirSync(OUT_DIR, { recursive: true })

// 按 /* subset-name */ 注释切块，块内取第一个 woff2 url
const blocks = css.split(/\/\*\s*([a-z0-9-]+)\s*\*\//i).slice(1)
const subsets = {}
for (let i = 0; i < blocks.length; i += 2) {
  const name = blocks[i]
  const body = blocks[i + 1] ?? ''
  const url = body.match(/url\((\S+?\.woff2)\)/)?.[1]
  if (name && url) subsets[name] = url
}

console.log(`模式: ${MODE}   可用子集: ${Object.keys(subsets).join(', ')}`)

for (const [subset, filename] of [
  ['latin', 'newsreader-latin.woff2'],
  ['latin-ext', 'newsreader-latin-ext.woff2'],
]) {
  const url = subsets[subset]
  if (!url) throw new Error(`未找到 ${subset} 子集`)
  const buf = await get(url)
  fs.writeFileSync(path.join(OUT_DIR, filename), buf)
  console.log(`${filename.padEnd(30)} ${(buf.length / 1024).toFixed(1)} KB (原始，待子集化)`)
}
