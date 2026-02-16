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
# Load environment from .env.local
set -a
source /var/www/burmese-digital-store/.env.local
set +a

# Export Telegram config
export TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
export TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID}"
export MONGODB_URI="${MONGODB_URI}"

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
