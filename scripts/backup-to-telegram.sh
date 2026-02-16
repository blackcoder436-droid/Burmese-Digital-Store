#!/bin/bash
# ============================================
# MongoDB Backup → Telegram
# Burmese Digital Store
#
# Runs nightly via cron, dumps MongoDB,
# compresses, and sends to Telegram group.
# ============================================

set -euo pipefail

# ── Config (from environment or defaults) ──
MONGODB_URI="${MONGODB_URI:?MONGODB_URI is not set}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is not set}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID is not set}"
DB_NAME="${DB_NAME:-burmese-digital-store}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/mongo-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# ── Timestamp ──
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_DISPLAY=$(date +"%Y-%m-%d %H:%M:%S %Z")
BACKUP_NAME="backup_${DB_NAME}_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
ARCHIVE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# ── Ensure backup dir exists ──
mkdir -p "${BACKUP_DIR}"

# ── Logging helper ──
log() {
  echo "[$(date '+%H:%M:%S')] $1"
}

# ── Send Telegram message ──
send_message() {
  local text="$1"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d parse_mode="HTML" \
    -d text="${text}" > /dev/null 2>&1
}

# ── Send Telegram document ──
send_document() {
  local file="$1"
  local caption="$2"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" \
    -F chat_id="${TELEGRAM_CHAT_ID}" \
    -F document=@"${file}" \
    -F caption="${caption}" \
    -F parse_mode="HTML" > /dev/null 2>&1
}

# ── Cleanup old backups ──
cleanup_old() {
  log "Cleaning up backups older than ${RETENTION_DAYS} days..."
  find "${BACKUP_DIR}" -name "backup_${DB_NAME}_*.tar.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
}

# ── Main ──
main() {
  log "Starting MongoDB backup..."

  # Step 1: mongodump
  log "Running mongodump..."
  if ! mongodump --uri="${MONGODB_URI}" --db="${DB_NAME}" --out="${BACKUP_PATH}" --gzip --quiet 2>/tmp/mongodump_err.txt; then
    ERROR=$(cat /tmp/mongodump_err.txt)
    send_message "❌ <b>Backup FAILED</b>
🕐 ${DATE_DISPLAY}
📛 Database: ${DB_NAME}
💥 Error: <code>${ERROR}</code>"
    log "ERROR: mongodump failed - ${ERROR}"
    rm -rf "${BACKUP_PATH}"
    exit 1
  fi

  # Step 2: Compress
  log "Compressing backup..."
  tar -czf "${ARCHIVE}" -C "${BACKUP_DIR}" "${BACKUP_NAME}"
  rm -rf "${BACKUP_PATH}"

  # Step 3: Get file size
  FILE_SIZE=$(du -sh "${ARCHIVE}" | cut -f1)

  # Step 4: Get collection counts
  COLLECTION_COUNT=$(find "${BACKUP_DIR}/${BACKUP_NAME}" -name "*.bson.gz" 2>/dev/null | wc -l || echo "N/A")

  log "Backup complete: ${ARCHIVE} (${FILE_SIZE})"

  # Step 5: Send to Telegram
  # Telegram Bot API limit: 50MB per sendDocument call
  # (Telegram app supports 4GB, but Bot API is capped at 50MB)
  # DB backup should be well under 1MB for this store — no issue in practice
  ARCHIVE_SIZE_BYTES=$(stat -c%s "${ARCHIVE}" 2>/dev/null || stat -f%z "${ARCHIVE}" 2>/dev/null || echo 0)
  MAX_SIZE=$((50 * 1024 * 1024))

  if [ "${ARCHIVE_SIZE_BYTES}" -gt "${MAX_SIZE}" ]; then
    send_message "⚠️ <b>Backup Too Large</b>
🕐 ${DATE_DISPLAY}
📛 Database: ${DB_NAME}
📦 Size: ${FILE_SIZE}
❗ File exceeds Telegram Bot API 50MB limit. Backup saved locally at:
<code>${ARCHIVE}</code>"
    log "WARNING: Backup too large for Telegram Bot API (${FILE_SIZE})"
  else
    log "Sending to Telegram..."
    send_document "${ARCHIVE}" "🗄 <b>DB Backup</b>
📅 ${DATE_DISPLAY}
📦 ${FILE_SIZE}
🗃 ${DB_NAME}"

    log "Sent to Telegram successfully"
  fi

  # Step 6: Cleanup old backups
  cleanup_old

  # Step 7: Success notification
  send_message "✅ <b>Backup Complete</b>
🕐 ${DATE_DISPLAY}
📛 Database: <code>${DB_NAME}</code>
📦 Size: ${FILE_SIZE}
🗂 Retained: ${RETENTION_DAYS} days"

  log "All done!"
}

main "$@"
