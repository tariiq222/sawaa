#!/bin/sh
# =============================================================================
# MinIO backup script for Sawa production
# Mirrors all buckets to local backup directory
# =============================================================================

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Alert on failure: any non-zero exit posts to BACKUP_ALERT_WEBHOOK_URL.
alert_failure() {
  _code=$?
  [ "${_code}" = "0" ] && return 0
  echo "[$(date -Iseconds)] FAILURE: minio backup exited ${_code}"
  _payload="{\"text\":\"🔴 Sawa MinIO backup FAILED (exit ${_code}) at $(date -Iseconds)\"}"
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

if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
  echo "[$(date -Iseconds)] WARNING: BACKUP_ENCRYPTION_KEY unset — MinIO mirror stored UNENCRYPTED"
fi

for BUCKET in ${BUCKETS}; do
  BUCKET_BACKUP_DIR="${BACKUP_DIR}/${BUCKET}_${TIMESTAMP}"
  echo "[$(date -Iseconds)] Backing up bucket: ${BUCKET}"
  mc mirror "local_minio/${BUCKET}" "${BUCKET_BACKUP_DIR}" >/dev/null 2>&1

  if [ -n "${BACKUP_ENCRYPTION_KEY}" ]; then
    # tar + encrypt the mirror dir (modern KDF: PBKDF2 / 100k iters / SHA-256),
    # then remove the plaintext mirror dir.
    ARCHIVE="${BACKUP_DIR}/${BUCKET}_${TIMESTAMP}.tar.gz.enc"
    tar czf - -C "${BACKUP_DIR}" "${BUCKET}_${TIMESTAMP}" \
      | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 -salt \
          -pass "pass:${BACKUP_ENCRYPTION_KEY}" -out "${ARCHIVE}"

    # Restorability round-trip: decrypt + verify the tar/gzip stream
    if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 \
          -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
          -in "${ARCHIVE}" 2>/dev/null | gunzip -t 2>/dev/null; then
      echo "[$(date -Iseconds)] ERROR: decrypt+gunzip round-trip failed on ${ARCHIVE}"
      rm -f "${ARCHIVE}"
      exit 1
    fi

    rm -rf "${BUCKET_BACKUP_DIR}"
    BUCKET_OUTPUT="${ARCHIVE}"
  else
    BUCKET_OUTPUT="${BUCKET_BACKUP_DIR}"
  fi
  echo "[$(date -Iseconds)] Bucket ${BUCKET} backed up to ${BUCKET_OUTPUT}"

  # Offsite upload (opt-in via env; Google Drive and/or S3 — see offsite-upload.sh)
  sh /scripts/offsite-upload.sh "${BUCKET_OUTPUT}" "minio"
done

# Clean up old backups (both plaintext mirror dirs and encrypted archives)
DELETED_DIRS=$(find "${BACKUP_DIR}" -maxdepth 1 -type d -name "*_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]" -mtime +"${RETENTION_DAYS}" -exec rm -rf {} + -print 2>/dev/null | wc -l)
DELETED_ARCHIVES=$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "*_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9].tar.gz.enc" -mtime +"${RETENTION_DAYS}" -delete -print 2>/dev/null | wc -l)
echo "[$(date -Iseconds)] Cleaned up ${DELETED_DIRS} old backup dir(s) and ${DELETED_ARCHIVES} old archive(s)"

echo "[$(date -Iseconds)] MinIO backup job finished"
