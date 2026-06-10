#!/bin/bash
set -euo pipefail

BACKUP_DIR="/root/backup-xui"
LOG_FILE="/var/log/backup-xui.log"
SRC_DB="/etc/x-ui/x-ui.db"
TIMESTAMP="$(date '+%Y%m%d_%H%M')"
DEST_DB="${BACKUP_DIR}/x-ui-${TIMESTAMP}.db"
DEST_ARCHIVE="${BACKUP_DIR}/x-ui-${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

{
  echo "[${TIMESTAMP}] Starting x-ui backup"
  DB_TYPE="sqlite"
  if [ -f /etc/default/x-ui ]; then
    DB_TYPE="$(grep -E '^XUI_DB_TYPE=' /etc/default/x-ui | tail -1 | cut -d= -f2- || true)"
  fi
  DB_TYPE="${DB_TYPE:-sqlite}"

  if [ "${DB_TYPE}" = "postgres" ]; then
    if [ ! -f /etc/default/x-ui ]; then
      echo "[${TIMESTAMP}] ERROR: /etc/default/x-ui missing for PostgreSQL backup"
      exit 1
    fi

    set -a
    # shellcheck disable=SC1091
    . /etc/default/x-ui
    set +a

    if [ -z "${XUI_DB_DSN:-}" ]; then
      echo "[${TIMESTAMP}] ERROR: XUI_DB_DSN missing for PostgreSQL backup"
      exit 1
    fi

    if ! command -v pg_dump >/dev/null 2>&1; then
      echo "[${TIMESTAMP}] ERROR: pg_dump missing; install postgresql-client"
      exit 1
    fi

    WORKDIR="$(mktemp -d)"
    trap 'rm -rf "${WORKDIR}"' EXIT
    pg_dump --format=custom --no-owner --no-privileges --dbname="${XUI_DB_DSN}" --file="${WORKDIR}/x-ui-postgres.dump"
    cp /etc/default/x-ui "${WORKDIR}/x-ui-default.env"
    tar -czf "${DEST_ARCHIVE}" \
      -C "${WORKDIR}" x-ui-postgres.dump x-ui-default.env \
      $([ -d /root/cert ] && echo "-C / root/cert") \
      $([ -d /root/.acme.sh ] && echo "-C / root/.acme.sh")
    chmod 600 "${DEST_ARCHIVE}"
    echo "[${TIMESTAMP}] PostgreSQL backup saved: ${DEST_ARCHIVE}"
  elif [ -f "${SRC_DB}" ]; then
    cp "${SRC_DB}" "${DEST_DB}"
    chmod 600 "${DEST_DB}"
    echo "[${TIMESTAMP}] Backup saved: ${DEST_DB}"
  else
    echo "[${TIMESTAMP}] WARNING: source file not found: ${SRC_DB}"
  fi
  echo "[${TIMESTAMP}] Pruning old backups older than 30 days"
  find "${BACKUP_DIR}" -type f -name 'x-ui-*.db' -mtime +30 -delete
  find "${BACKUP_DIR}" -type f -name 'x-ui-*.tar.gz' -mtime +30 -delete
  echo "[${TIMESTAMP}] Backup complete"
} >> "${LOG_FILE}" 2>&1
