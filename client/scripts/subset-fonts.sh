#!/usr/bin/env bash
# 步骤 2/2：把 Newsreader 加工成可自托管的 woff2（预算 ≤ 45KB，本任务新增字体的全部体积）
#
# 用法：bash scripts/subset-fonts.sh   （先跑 node scripts/fetch-fonts.mjs）
# 输入：.fontraw/newsreader-{latin,latin-ext}.woff2（Google Fonts 原始分片，~97KB）
# 产物：src/assets/fonts/newsreader-latin.woff2、newsreader-latin-ext.woff2
#
# 两步加工，缺一不可：
#   1) varLib.instancer 把 **opsz 轴实例化到 72**（显示光学尺寸切）。
#      实测：保留 opsz 轴的子集 = 71.2KB（**超预算**）；实例化到 72 后 = 25.9KB。
#      代价：放弃"按字号自动选光学尺寸"，所有衬线文本（含 23px 引文）都用
#      显示切字形 —— 对比度偏高、更锐，正是编辑风标题想要的效果。
#      wght 轴在 fetch 阶段已由 CSS2 API 钉死为 600（静态实例），故 @font-face
#      只声明 font-weight: 600，衬线场景一律用 600。
#   2) pyftsubset 只保留**拉丁**字符 —— 拉丁可穷举，中文不可（中文走系统宋体栈，
#      靠 @font-face 的 unicode-range 让浏览器自动分流）。
#
# ⚠️ 这里用到的 unicode 范围必须与 src/styles/fonts.css 里声明的 unicode-range 完全一致。
set -euo pipefail

cd "$(dirname "$0")/.."

RAW_DIR=".fontraw"
OUT_DIR="src/assets/fonts"
OPSZ=72

# 拉丁基础：ASCII 可见字符 + Latin-1 常用符号/字母 + 排版标点
LATIN="U+0020-007E,U+00A0-00A9,U+00AB-00B1,U+00B4,U+00B7,U+00BB,U+00BF,U+00C0-00FF,U+2013-2014,U+2018-201D,U+2026"
# 拉丁扩展-A（欧洲语字母）
LATIN_EXT="U+0100-017F"

mkdir -p "$OUT_DIR" .fontwork

# pyftsubset / fonttools 的可执行目录不在 PATH 上（pip 装在 Python 的 Scripts/），
# 统一用 `python -m` 入口，跨机器稳定。
PY="${PY:-python}"

for SUB in latin latin-ext; do
  if [ "$SUB" = "latin" ]; then UNI="$LATIN"; else UNI="$LATIN_EXT"; fi

  # 1) 实例化 opsz → 静态显示切
  "$PY" -m fontTools.varLib.instancer \
    "$RAW_DIR/newsreader-$SUB.woff2" "opsz=$OPSZ" \
    -o ".fontwork/newsreader-$SUB-opsz$OPSZ.woff2" > /dev/null

  # 2) 拉丁子集化
  "$PY" -m fontTools.subset \
    ".fontwork/newsreader-$SUB-opsz$OPSZ.woff2" \
    --unicodes="$UNI" \
    --layout-features=kern \
    --no-hinting \
    --flavor=woff2 \
    --output-file="$OUT_DIR/newsreader-$SUB.woff2"
done

rm -rf .fontwork

echo "=== 产物 ==="
ls -l "$OUT_DIR"
node -e "
const fs=require('fs');
const d='src/assets/fonts';
const files=fs.readdirSync(d).filter(f=>f.startsWith('newsreader-'));
const bytes=files.reduce((s,f)=>s+fs.statSync(d+'/'+f).size,0);
console.log('Newsreader 两文件合计 '+(bytes/1024).toFixed(2)+' KiB ('+bytes+' bytes) — 预算 ≤ 45KB: '+(bytes<=45*1024));
"
