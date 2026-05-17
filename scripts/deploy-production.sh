#!/usr/bin/env bash
set -euo pipefail

# Production deploy helper for Burmese Digital Store
# USAGE (on the VPS):
#   sudo -i
#   cd /path/to/burmese-digital-store
#   bash scripts/deploy-production.sh
# Adjust REPO_DIR and BRANCH as needed.

REPO_DIR="/var/www/burmese-digital-store"
BRANCH="main"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$REPO_DIR/backups"

echo "Deploy start: $TIMESTAMP"
if [ ! -d "$REPO_DIR" ]; then
  echo "ERROR: repo dir $REPO_DIR does not exist. Update REPO_DIR in this script." >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"
cd "$REPO_DIR"

echo "Creating tar backup..."
tar -czf "$BACKUP_DIR/release-$TIMESTAMP.tar.gz" .
echo "Backup saved to $BACKUP_DIR/release-$TIMESTAMP.tar.gz"

echo "Fetching latest from origin/$BRANCH..."
git fetch origin --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "Installing dependencies..."
if [ -f pnpm-lock.yaml ]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
  else
    echo "pnpm not found — installing dependencies with npm instead. Consider installing pnpm for faster installs."
    npm ci --only=production
  fi
else
  npm ci --only=production
fi

echo "Building project..."
if npm run | grep -q "build"; then
  npm run build
elif pnpm -v >/dev/null 2>&1 && pnpm run | grep -q "build"; then
  pnpm build
else
  echo "No build script found. Skipping build step."
fi

echo "Restarting process manager..."
if command -v pm2 >/dev/null 2>&1; then
  if [ -f ecosystem.config.js ]; then
    pm2 reload ecosystem.config.js --env production || pm2 restart all
  else
    pm2 restart all || true
  fi
else
  echo "pm2 not installed — restart your app/service manually (systemd, docker, etc.)."
fi

echo "Deployment finished. Tail logs with:"
echo "  pm2 logs --lines 200"

exit 0
