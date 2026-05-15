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

# Encrypt if key is provided
if [ -n "${BACKUP_ENCRYPTION_KEY}" ]; then
  ENCRYPTED_FILE="${BACKUP_FILE}.enc"
  openssl enc -aes-256-cbc -salt -pass "pass:${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" -out "${ENCRYPTED_FILE}"
  rm -f "${BACKUP_FILE}"
  BACKUP_FILE="${ENCRYPTED_FILE}"
fi

# Verify backup file exists and has size
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "[$(date -Iseconds)] ERROR: Backup file is empty or missing"
  exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Clean up old backups
DELETED=$(find "${BACKUP_DIR}" -type f -name "postgres_${DB_NAME}_*.sql.gz*" -mtime +"${RETENTION_DAYS}" -delete -print | wc -l)
echo "[$(date -Iseconds)] Cleaned up ${DELETED} old backup(s)"

echo "[$(date -Iseconds)] Backup job finished"
