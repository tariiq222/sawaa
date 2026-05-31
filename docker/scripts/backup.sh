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

# Optional offsite upload (opt-in via env; no-op when unset)
# Triggered when BACKUP_S3_BUCKET is set. Uses mc if available, else aws-cli.
if [ -n "${BACKUP_S3_BUCKET}" ]; then
  OFFSITE_KEY="postgres/$(basename "${BACKUP_FILE}")"
  echo "[$(date -Iseconds)] Offsite upload enabled -> ${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
  if command -v mc >/dev/null 2>&1 && [ -n "${BACKUP_S3_ENDPOINT}" ]; then
    mc alias set offsite "${BACKUP_S3_ENDPOINT}" "${BACKUP_S3_ACCESS_KEY}" "${BACKUP_S3_SECRET_KEY}" >/dev/null 2>&1
    mc cp "${BACKUP_FILE}" "offsite/${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
    echo "[$(date -Iseconds)] Offsite upload via mc completed"
  elif command -v aws >/dev/null 2>&1; then
    if [ -n "${BACKUP_S3_ENDPOINT}" ]; then
      aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 cp "${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
    else
      aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
    fi
    echo "[$(date -Iseconds)] Offsite upload via aws-cli completed"
  else
    echo "[$(date -Iseconds)] ERROR: offsite requested but neither mc(+endpoint) nor aws-cli available"
    exit 1
  fi
else
  echo "[$(date -Iseconds)] Offsite upload disabled (BACKUP_S3_BUCKET unset) — local-only"
fi

# Clean up old backups
DELETED=$(find "${BACKUP_DIR}" -type f -name "postgres_${DB_NAME}_*.sql.gz*" -mtime +"${RETENTION_DAYS}" -delete -print | wc -l)
echo "[$(date -Iseconds)] Cleaned up ${DELETED} old backup(s)"

echo "[$(date -Iseconds)] Backup job finished"
