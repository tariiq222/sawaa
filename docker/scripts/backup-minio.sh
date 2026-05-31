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

  # Optional offsite upload (opt-in via env; no-op when unset)
  if [ -n "${BACKUP_S3_BUCKET}" ]; then
    OFFSITE_KEY="minio/$(basename "${BUCKET_OUTPUT}")"
    echo "[$(date -Iseconds)] Offsite upload enabled -> ${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
    if command -v mc >/dev/null 2>&1 && [ -n "${BACKUP_S3_ENDPOINT}" ]; then
      mc alias set offsite "${BACKUP_S3_ENDPOINT}" "${BACKUP_S3_ACCESS_KEY}" "${BACKUP_S3_SECRET_KEY}" >/dev/null 2>&1
      if [ -d "${BUCKET_OUTPUT}" ]; then
        mc mirror "${BUCKET_OUTPUT}" "offsite/${BACKUP_S3_BUCKET}/${OFFSITE_KEY}" >/dev/null 2>&1
      else
        mc cp "${BUCKET_OUTPUT}" "offsite/${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
      fi
      echo "[$(date -Iseconds)] Offsite upload via mc completed"
    elif command -v aws >/dev/null 2>&1; then
      AWS_ENDPOINT_FLAG=""
      [ -n "${BACKUP_S3_ENDPOINT}" ] && AWS_ENDPOINT_FLAG="--endpoint-url ${BACKUP_S3_ENDPOINT}"
      if [ -d "${BUCKET_OUTPUT}" ]; then
        aws ${AWS_ENDPOINT_FLAG} s3 cp --recursive "${BUCKET_OUTPUT}" "s3://${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
      else
        aws ${AWS_ENDPOINT_FLAG} s3 cp "${BUCKET_OUTPUT}" "s3://${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
      fi
      echo "[$(date -Iseconds)] Offsite upload via aws-cli completed"
    else
      echo "[$(date -Iseconds)] ERROR: offsite requested but neither mc(+endpoint) nor aws-cli available"
      exit 1
    fi
  else
    echo "[$(date -Iseconds)] Offsite upload disabled (BACKUP_S3_BUCKET unset) — local-only"
  fi
done

# Clean up old backups (both plaintext mirror dirs and encrypted archives)
DELETED_DIRS=$(find "${BACKUP_DIR}" -maxdepth 1 -type d -name "*_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]" -mtime +"${RETENTION_DAYS}" -exec rm -rf {} + -print 2>/dev/null | wc -l)
DELETED_ARCHIVES=$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "*_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9].tar.gz.enc" -mtime +"${RETENTION_DAYS}" -delete -print 2>/dev/null | wc -l)
echo "[$(date -Iseconds)] Cleaned up ${DELETED_DIRS} old backup dir(s) and ${DELETED_ARCHIVES} old archive(s)"

echo "[$(date -Iseconds)] MinIO backup job finished"
