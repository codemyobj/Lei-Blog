#!/bin/bash
# ============================================================
# Lei-Blog — PostgreSQL 备份脚本
#
# - 用 pg_dump -Fc（自定义格式）：自带压缩，且支持 pg_restore 选择性恢复表
# - 本机保留 7 天
# - 可选异地同步到腾讯云 COS（配好 REMOTE 变量即启用）
#
# 安装：
#   cp deploy/backup.sh /opt/lei-blog/scripts/backup.sh
#   chmod +x /opt/lei-blog/scripts/backup.sh
#   crontab -e
#   0 3 * * * /opt/lei-blog/scripts/backup.sh >> /var/log/lei-blog/backup.log 2>&1
#
# 手动验证：
#   /opt/lei-blog/scripts/backup.sh
#   pg_restore -l /data/backup/blog-*.dump.gz | head    # 能读出内容才算成功
# ============================================================

set -euo pipefail

# ---------- 可配置项（可用环境变量覆盖）----------
CONTAINER="${PG_CONTAINER:-blog-pg}"
PG_USER="${PG_USER:-blog}"
PG_DB="${PG_DB:-blog}"
BACKUP_DIR="${BACKUP_DIR:-/data/backup}"
KEEP_DAYS="${KEEP_DAYS:-7}"
DATE_STAMP="$(date +%Y%m%d-%H%M)"
OUT_FILE="${BACKUP_DIR}/blog-${DATE_STAMP}.dump.gz"

# ---------- 异地同步（留空则跳过）----------
# 示例（腾讯云 COS，需先 coscli config init）：
#   REMOTE="cos://backup-125xxxxxxx/lei-blog/"
#   REMOTE_CMD="coscli sync"
# 示例（rclone 到任意对象存储）：
#   REMOTE="myoss:backup/lei-blog/"
#   REMOTE_CMD="rclone copy"
REMOTE="${REMOTE:-}"
REMOTE_CMD="${REMOTE_CMD:-}"

mkdir -p "${BACKUP_DIR}"

# ---------- 1. 备份 ----------
echo "[$(date '+%F %T')] 开始备份 ${PG_DB} ..."
# shellcheck disable=SC2086
docker exec "${CONTAINER}" pg_dump -U "${PG_USER}" -Fc "${PG_DB}" | gzip > "${OUT_FILE}"
SIZE="$(du -h "${OUT_FILE}" | cut -f1)"
echo "[$(date '+%F %T')] 备份完成：${OUT_FILE} (${SIZE})"

# ---------- 2. 清理本机过期备份 ----------
find "${BACKUP_DIR}" -name 'blog-*.dump.gz' -type f -mtime "+${KEEP_DAYS}" -delete
echo "[$(date '+%F %T')] 已清理 ${KEEP_DAYS} 天前的备份"

# ---------- 3. 异地同步（可选）----------
if [[ -n "${REMOTE}" && -n "${REMOTE_CMD}" ]]; then
  echo "[$(date '+%F %T')] 同步到异地：${REMOTE}"
  ${REMOTE_CMD} "${OUT_FILE}" "${REMOTE}" || {
    echo "[$(date '+%F %T')] ⚠️  异地同步失败（本机备份仍然有效）" >&2
    exit 1
  }
  echo "[$(date '+%F %T')] 异地同步完成"
else
  echo "[$(date '+%F %T')] 未配置 REMOTE/REMOTE_CMD，跳过异地同步"
fi

echo "[$(date '+%F %T')] ✅ 备份流程结束"
