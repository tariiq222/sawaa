#!/bin/sh
# =============================================================================
# PostgreSQL backup script for Sawa production
# Run via cron in the backup container
# =============================================================================

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DB_NAME="${POSTGRES_DB}"

# Alert on failure: any non-zero exit before the explicit success trap fires
# posts to BACKUP_ALERT_WEBHOOK_URL (no-op when unset).
alert_failure() {
  _code=$?
  [ "${_code}" = "0" ] && return 0
  echo "[$(date -Iseconds)] FAILURE: postgres backup exited ${_code}"
  _payload="{\"text\":\"🔴 Sawa postgres backup FAILED (exit ${_code}) at $(date -Iseconds)\"}"
  if [ -n "${BACKUP_ALERT_WEBHOOK_URL}" ]; then
    if command -v curl >/dev/null 2>&1; then
      curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
        -d "${_payload}" "${BACKUP_ALERT_WEBHOOK_URL}" >/dev/null 2>&1 || \
        echo "[$(date -Iseconds)] WARNING: alert webhook POST failed"
    elif command -v wget >/dev/null 2>&1; then
      wget -q -T 10 -O /dev/null --header='Content-Type: application/json' \
        --post-data="${_payload}" "${BACKUP_ALERT_WEBHOOK_URL}" 2>/dev/null || \
        echo "[$(date -Iseconds)] WARNING: alert webhook POST failed"
    else
      echo "[$(date -Iseconds)] WARNING: no curl/wget — cannot send alert"
    fi
  fi
}
trap alert_failure EXIT

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Dump the database
BACKUP_FILE="${BACKUP_DIR}/postgres_${DB_NAME}_${TIMESTAMP}.sql.gz"
echo "[$(date -Iseconds)] Starting backup: ${BACKUP_FILE}"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-privileges \
  | gzip > "${BACKUP_FILE}"

# Restorability check: confirm the gzip stream is intact before going further
if ! gunzip -t "${BACKUP_FILE}" 2>/dev/null; then
  echo "[$(date -Iseconds)] ERROR: gzip integrity check failed on ${BACKUP_FILE}"
  rm -f "${BACKUP_FILE}"
  exit 1
fi
echo "[$(date -Iseconds)] gzip integrity check passed"

# Encrypt if key is provided (modern KDF: PBKDF2 / 100k iters / SHA-256)
if [ -n "${BACKUP_ENCRYPTION_KEY}" ]; then
  ENCRYPTED_FILE="${BACKUP_FILE}.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 -salt \
    -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
    -in "${BACKUP_FILE}" -out "${ENCRYPTED_FILE}"

  # Restorability round-trip: decrypt with the SAME flags and re-test the gzip stream
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 \
        -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
        -in "${ENCRYPTED_FILE}" 2>/dev/null | gunzip -t 2>/dev/null; then
    echo "[$(date -Iseconds)] ERROR: decrypt+gunzip round-trip failed on ${ENCRYPTED_FILE}"
    rm -f "${ENCRYPTED_FILE}"
    exit 1
  fi
  echo "[$(date -Iseconds)] decrypt+gunzip round-trip check passed"

  rm -f "${BACKUP_FILE}"
  BACKUP_FILE="${ENCRYPTED_FILE}"
else
  echo "[$(date -Iseconds)] WARNING: BACKUP_ENCRYPTION_KEY unset — dump stored UNENCRYPTED"
fi

# Verify backup file exists and has size
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "[$(date -Iseconds)] ERROR: Backup file is empty or missing"
  exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Offsite upload (opt-in via env; Google Drive and/or S3 — see offsite-upload.sh)
sh /scripts/offsite-upload.sh "${BACKUP_FILE}" "postgres"

# Clean up old backups
DELETED=$(find "${BACKUP_DIR}" -type f -name "postgres_${DB_NAME}_*.sql.gz*" -mtime +"${RETENTION_DAYS}" -delete -print | wc -l)
echo "[$(date -Iseconds)] Cleaned up ${DELETED} old backup(s)"

echo "[$(date -Iseconds)] Backup job finished"
