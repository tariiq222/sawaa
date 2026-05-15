#!/bin/sh
# =============================================================================
# MinIO backup script for Sawa production
# Mirrors all buckets to local backup directory
# =============================================================================

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting MinIO backup"

# Configure mc alias
mc alias set local_minio "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" >/dev/null 2>&1

# Get list of buckets
BUCKETS=$(mc ls local_minio 2>/dev/null | awk '{print $5}' | sed 's|/$||')

if [ -z "${BUCKETS}" ]; then
  echo "[$(date -Iseconds)] WARNING: No buckets found"
  exit 0
fi

for BUCKET in ${BUCKETS}; do
  BUCKET_BACKUP_DIR="${BACKUP_DIR}/${BUCKET}_${TIMESTAMP}"
  echo "[$(date -Iseconds)] Backing up bucket: ${BUCKET}"
  mc mirror "local_minio/${BUCKET}" "${BUCKET_BACKUP_DIR}" >/dev/null 2>&1
  echo "[$(date -Iseconds)] Bucket ${BUCKET} backed up to ${BUCKET_BACKUP_DIR}"
done

# Clean up old backups
DELETED=$(find "${BACKUP_DIR}" -maxdepth 1 -type d -name "*_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]" -mtime +"${RETENTION_DAYS}" -exec rm -rf {} + -print 2>/dev/null | wc -l)
echo "[$(date -Iseconds)] Cleaned up ${DELETED} old backup dir(s)"

echo "[$(date -Iseconds)] MinIO backup job finished"
