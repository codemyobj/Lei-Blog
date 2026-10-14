#!/usr/bin/env bash
# 步骤 2/2：用 pyftsubset 把 Archivo 可变字体子集化到 < 40KB 预算（文档 §4.3 Step 3）
#
# 用法：bash scripts/subset-fonts.sh   （先跑 node scripts/fetch-fonts.mjs）
# 输入：.fontraw/*.woff2（Google Fonts 原始分片，66KB）
# 产物：src/assets/fonts/archivo-latin.woff2、archivo-latin-ext.woff2
#
# 只对**拉丁字符**做子集化 —— 拉丁字符集可以穷举，中文不行（中文由系统黑体栈承担，
# 靠 @font-face 的 unicode-range 让浏览器自动分流）。
#
# ⚠️ 这里用到的 unicode 范围必须与 src/styles/fonts.css 里声明的 unicode-range 一致。
set -euo pipefail

cd "$(dirname "$0")/.."

RAW_DIR=".fontraw"
OUT_DIR="src/assets/fonts"

# 拉丁基础：ASCII 可见字符 + Latin-1 常用符号/字母 + 排版标点
LATIN="U+0020-007E,U+00A0-00A9,U+00AB-00B1,U+00B4,U+00B7,U+00BB,U+00BF,U+00C0-00FF,U+2013-2014,U+2018-201D,U+2026"
# 拉丁扩展-A（欧洲语字母）
LATIN_EXT="U+0100-017F"

mkdir -p "$OUT_DIR"

pyftsubset "$RAW_DIR/archivo-latin.woff2" \
  --unicodes="$LATIN" \
  --layout-features=kern \
  --no-hinting \
  --flavor=woff2 \
  --output-file="$OUT_DIR/archivo-latin.woff2"

pyftsubset "$RAW_DIR/archivo-latin-ext.woff2" \
  --unicodes="$LATIN_EXT" \
  --layout-features=kern \
  --no-hinting \
  --flavor=woff2 \
  --output-file="$OUT_DIR/archivo-latin-ext.woff2"

echo "=== 产物 ==="
ls -l "$OUT_DIR"
node -e "
const fs=require('fs');
const d='$OUT_DIR';
const files=fs.readdirSync(d);
const bytes=files.reduce((s,f)=>s+fs.statSync(d+'/'+f).size,0);
console.log('两文件合计 '+(bytes/1024).toFixed(1)+' KiB ('+bytes+' bytes) — 预算 < 40KB');
"
