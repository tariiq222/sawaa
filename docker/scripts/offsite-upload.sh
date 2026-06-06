#!/bin/sh
# =============================================================================
# Offsite upload helper for Sawa backups
# Usage: offsite-upload.sh <local-path> <remote-subdir>
#   <local-path>   file OR directory to push offsite
#   <remote-subdir> logical prefix, e.g. "postgres" or "minio"
#
# Destinations are opt-in and independent — both can be enabled at once:
#   • Google Drive (rclone)  — set BACKUP_GDRIVE_FOLDER (+ rclone config below)
#   • S3 / MinIO   (mc/aws)  — set BACKUP_S3_BUCKET
# Exits non-zero if a destination is configured but its upload fails, so the
# calling cron job records the failure instead of silently going local-only.
# =============================================================================

set -e

SRC="$1"
REMOTE_SUBDIR="$2"

if [ -z "${SRC}" ] || [ -z "${REMOTE_SUBDIR}" ]; then
  echo "[$(date -Iseconds)] offsite-upload: missing args (src='${SRC}' subdir='${REMOTE_SUBDIR}')"
  exit 2
fi

BASE="$(basename "${SRC}")"
UPLOADED_ANY=0

# ── Google Drive via rclone ─────────────────────────────────────────────────
# Auth is provided to rclone entirely through env vars so no interactive
# `rclone config` is needed in the container:
#   RCLONE_CONFIG_GDRIVE_TYPE=drive
#   RCLONE_CONFIG_GDRIVE_SERVICE_ACCOUNT_FILE=/secrets/gdrive-sa.json
#   RCLONE_CONFIG_GDRIVE_SCOPE=drive
#   RCLONE_CONFIG_GDRIVE_TEAM_DRIVE=<shared-drive-id>   (if using a Shared Drive)
# BACKUP_GDRIVE_FOLDER is the destination folder/path inside that remote.
if [ -n "${BACKUP_GDRIVE_FOLDER}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "[$(date -Iseconds)] ERROR: BACKUP_GDRIVE_FOLDER set but rclone not installed"
    exit 1
  fi
  DEST="gdrive:${BACKUP_GDRIVE_FOLDER}/${REMOTE_SUBDIR}"
  echo "[$(date -Iseconds)] Google Drive upload enabled -> ${DEST}/${BASE}"
  if [ -d "${SRC}" ]; then
    rclone copy "${SRC}" "${DEST}/${BASE}"
  else
    rclone copyto "${SRC}" "${DEST}/${BASE}"
  fi
  echo "[$(date -Iseconds)] Google Drive upload completed"
  UPLOADED_ANY=1
fi

# ── S3 / MinIO via mc or aws-cli ────────────────────────────────────────────
if [ -n "${BACKUP_S3_BUCKET}" ]; then
  OFFSITE_KEY="${REMOTE_SUBDIR}/${BASE}"
  echo "[$(date -Iseconds)] S3 upload enabled -> ${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
  if command -v mc >/dev/null 2>&1 && [ -n "${BACKUP_S3_ENDPOINT}" ]; then
    mc alias set offsite "${BACKUP_S3_ENDPOINT}" "${BACKUP_S3_ACCESS_KEY}" "${BACKUP_S3_SECRET_KEY}" >/dev/null 2>&1
    if [ -d "${SRC}" ]; then
      mc mirror "${SRC}" "offsite/${BACKUP_S3_BUCKET}/${OFFSITE_KEY}" >/dev/null 2>&1
    else
      mc cp "${SRC}" "offsite/${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
    fi
    echo "[$(date -Iseconds)] S3 upload via mc completed"
  elif command -v aws >/dev/null 2>&1; then
    AWS_ENDPOINT_FLAG=""
    [ -n "${BACKUP_S3_ENDPOINT}" ] && AWS_ENDPOINT_FLAG="--endpoint-url ${BACKUP_S3_ENDPOINT}"
    if [ -d "${SRC}" ]; then
      aws ${AWS_ENDPOINT_FLAG} s3 cp --recursive "${SRC}" "s3://${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
    else
      aws ${AWS_ENDPOINT_FLAG} s3 cp "${SRC}" "s3://${BACKUP_S3_BUCKET}/${OFFSITE_KEY}"
    fi
    echo "[$(date -Iseconds)] S3 upload via aws-cli completed"
  else
    echo "[$(date -Iseconds)] ERROR: S3 requested but neither mc(+endpoint) nor aws-cli available"
    exit 1
  fi
  UPLOADED_ANY=1
fi

if [ "${UPLOADED_ANY}" -eq 0 ]; then
  echo "[$(date -Iseconds)] Offsite upload disabled (no BACKUP_GDRIVE_FOLDER / BACKUP_S3_BUCKET) — local-only"
fi
