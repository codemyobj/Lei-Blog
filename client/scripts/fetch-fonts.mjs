// 步骤 1/2：从 Google Fonts 取 Archivo 600..700 的 latin / latin-ext woff2 原始文件
//
// 用法：node scripts/fetch-fonts.mjs
// 产物：.fontraw/archivo-latin.woff2、.fontraw/archivo-latin-ext.woff2（已 gitignore）
// 之后必须再跑 scripts/subset-fonts.sh 得到最终产物（原始文件 66KB，超出 40KB 预算）。
//
// ⚠️ Windows 上 curl 会因 schannel 吊销检查离线而失败（CRYPT_E_REVOCATION_OFFLINE），
//    所以这里用 Node 的 https 模块直连。
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'

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

const css = (
  await get('https://fonts.googleapis.com/css2?family=Archivo:wght@600..700&display=swap')
).toString('utf8')

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

console.log('可用子集:', Object.keys(subsets).join(', '))

for (const [subset, filename] of [
  ['latin', 'archivo-latin.woff2'],
  ['latin-ext', 'archivo-latin-ext.woff2'],
]) {
  const url = subsets[subset]
  if (!url) throw new Error(`未找到 ${subset} 子集`)
  const buf = await get(url)
  fs.writeFileSync(path.join(OUT_DIR, filename), buf)
  console.log(`${filename.padEnd(26)} ${(buf.length / 1024).toFixed(1)} KB (原始，待子集化)`)
}
