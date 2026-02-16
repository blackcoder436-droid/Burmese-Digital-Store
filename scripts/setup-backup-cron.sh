#!/bin/bash
# ============================================
# Setup Backup Cron Job
# Burmese Digital Store
#
# Run on VPS: bash scripts/setup-backup-cron.sh
# ============================================

set -euo pipefail

APP_DIR="/var/www/burmese-digital-store"
SCRIPT="${APP_DIR}/scripts/backup-to-telegram.sh"
LOG="/var/log/mongo-backup.log"

echo "=========================================="
echo "  Setting up MongoDB Backup Cron Job"
echo "=========================================="

# Step 1: Make backup script executable
chmod +x "${SCRIPT}"
echo "[✓] Script permissions set"

# Step 2: Create log file
touch "${LOG}"
echo "[✓] Log file: ${LOG}"

# Step 3: Check mongodump
if ! command -v mongodump &> /dev/null; then
  echo ""
  echo "[!] mongodump not found. Install mongodb-database-tools:"
  echo "    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -"
  echo "    echo 'deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse' | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list"
  echo "    sudo apt update && sudo apt install -y mongodb-database-tools"
  echo ""
fi

# Step 4: Load environment variables from .env.local
if [ -f "${APP_DIR}/.env.local" ]; then
  echo "[✓] Found .env.local"
else
  echo "[!] WARNING: ${APP_DIR}/.env.local not found"
  echo "    Make sure MONGODB_URI, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID are set"
fi

# Step 5: Create cron wrapper that loads env
CRON_WRAPPER="${APP_DIR}/scripts/run-backup.sh"
cat > "${CRON_WRAPPER}" << 'WRAPPER'
#!/bin/bash
# Extract only the variables we need from .env.local
# Uses sed to handle special chars in MongoDB URIs (?, &, +, $, etc.)
ENV_FILE="/var/www/burmese-digital-store/.env.local"

extract_env() {
  local val
  val=$(sed -n "s/^${1}=//p" "${ENV_FILE}" 2>/dev/null | head -1 | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//")
  echo "$val"
}

export MONGODB_URI="$(extract_env MONGODB_URI)"
export TELEGRAM_BOT_TOKEN="$(extract_env TELEGRAM_BOT_TOKEN)"
export TELEGRAM_CHAT_ID="$(extract_env TELEGRAM_CHAT_ID)"

# Debug: verify extraction worked (masked)
if [ -z "$MONGODB_URI" ]; then
  echo "[ERROR] MONGODB_URI extraction failed from ${ENV_FILE}" >> /var/log/mongo-backup.log
  echo "[DEBUG] File exists: $(test -f ${ENV_FILE} && echo yes || echo no)" >> /var/log/mongo-backup.log
  echo "[DEBUG] MONGODB_URI line: $(grep -c '^MONGODB_URI=' ${ENV_FILE} 2>/dev/null) matches" >> /var/log/mongo-backup.log
  exit 1
fi

# Run backup
/var/www/burmese-digital-store/scripts/backup-to-telegram.sh >> /var/log/mongo-backup.log 2>&1
WRAPPER

chmod +x "${CRON_WRAPPER}"
echo "[✓] Cron wrapper created: ${CRON_WRAPPER}"

# Step 6: Install cron job (midnight Myanmar Time = 17:30 UTC)
# Myanmar is UTC+6:30, so midnight MMT = 17:30 UTC
CRON_LINE="30 17 * * * ${CRON_WRAPPER}"

# Check if already exists
if crontab -l 2>/dev/null | grep -q "run-backup.sh"; then
  echo "[✓] Cron job already exists (skipping)"
else
  (crontab -l 2>/dev/null; echo "${CRON_LINE}") | crontab -
  echo "[✓] Cron job installed: ${CRON_LINE}"
fi

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "  Schedule: Every day at midnight (MMT)"
echo "  Script:   ${SCRIPT}"
echo "  Wrapper:  ${CRON_WRAPPER}"
echo "  Log:      ${LOG}"
echo ""
echo "  To test manually:"
echo "    bash ${CRON_WRAPPER}"
echo ""
echo "  To check cron:"
echo "    crontab -l"
echo ""
