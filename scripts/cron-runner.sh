#!/bin/bash
# ==========================================
# Cron Runner - Burmese Digital Store
# Calls internal API cron endpoints with CRON_SECRET
#
# Usage: ./scripts/cron-runner.sh /api/cron/vpn-expiry-reminders
# ==========================================

set -euo pipefail

ENDPOINT="${1:?Usage: $0 /api/cron/endpoint}"
BASE_URL="${APP_BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-$(grep CRON_SECRET /var/www/burmese-digital-store/.env.local 2>/dev/null | cut -d '=' -f2)}"

if [ -z "$CRON_SECRET" ]; then
  echo "[CRON] ERROR: CRON_SECRET not set"
  exit 1
fi

echo "[CRON] $(date '+%Y-%m-%d %H:%M:%S') Running ${ENDPOINT}..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${BASE_URL}${ENDPOINT}" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "[CRON] Success (${HTTP_CODE}): ${BODY}"
else
  echo "[CRON] ERROR (${HTTP_CODE}): ${BODY}"
  exit 1
fi
