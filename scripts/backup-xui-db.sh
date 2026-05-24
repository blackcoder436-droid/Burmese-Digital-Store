#!/bin/bash
set -euo pipefail

BACKUP_DIR="/root/backup-xui"
LOG_FILE="/var/log/backup-xui.log"
SRC_DB="/etc/x-ui/x-ui.db"
TIMESTAMP="$(date '+%Y%m%d_%H%M')"
DEST_DB="${BACKUP_DIR}/x-ui-${TIMESTAMP}.db"

mkdir -p "${BACKUP_DIR}"

{
  echo "[${TIMESTAMP}] Starting x-ui backup"
  if [ -f "${SRC_DB}" ]; then
    cp "${SRC_DB}" "${DEST_DB}"
    chmod 600 "${DEST_DB}"
    echo "[${TIMESTAMP}] Backup saved: ${DEST_DB}"
  else
    echo "[${TIMESTAMP}] WARNING: source file not found: ${SRC_DB}"
  fi
  echo "[${TIMESTAMP}] Pruning old backups older than 30 days"
  find "${BACKUP_DIR}" -type f -name 'x-ui-*.db' -mtime +30 -delete
  echo "[${TIMESTAMP}] Backup complete"
} >> "${LOG_FILE}" 2>&1
