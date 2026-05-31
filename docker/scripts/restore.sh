#!/bin/sh
# =============================================================================
# Restore script for Sawa production (mirror of backup.sh / backup-minio.sh)
#
# Restores either a PostgreSQL dump or a MinIO bucket archive produced by the
# backup scripts. Decryption uses the SAME modern KDF flags as the backups:
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256
#
# Usage:
#   restore.sh db    <backup-file>            # restore a postgres dump
#   restore.sh minio <archive-file> <bucket>  # restore a MinIO bucket
#
#   backup-file / archive-file may be plain (.sql.gz / .tar.gz) or encrypted
#   (.enc); encrypted inputs require BACKUP_ENCRYPTION_KEY.
#
# Destructive DB restore is guarded: it refuses to run unless CONFIRM=yes is
# set in the env OR --force is passed as an extra argument.
# =============================================================================

set -e

usage() {
  echo "Usage:"
  echo "  restore.sh db    <backup-file> [--force]"
  echo "  restore.sh minio <archive-file> <bucket> [--force]"
  echo ""
  echo "Destructive DB restore requires CONFIRM=yes env or --force flag."
  exit 1
}

MODE="$1"
[ -z "${MODE}" ] && usage

# Detect --force anywhere in the args
FORCE="no"
for arg in "$@"; do
  [ "${arg}" = "--force" ] && FORCE="yes"
done

# decrypt_stream <file>
# Emits the decrypted (or passthrough) gzip/tar stream on stdout.
# Files ending in .enc are decrypted with the modern KDF; others pass through.
decrypt_stream() {
  _file="$1"
  case "${_file}" in
    *.enc)
      if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
        echo "[$(date -Iseconds)] ERROR: ${_file} is encrypted but BACKUP_ENCRYPTION_KEY is unset" >&2
        exit 1
      fi
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 \
        -pass "pass:${BACKUP_ENCRYPTION_KEY}" -in "${_file}"
      ;;
    *)
      cat "${_file}"
      ;;
  esac
}

restore_db() {
  BACKUP_FILE="$1"
  [ -z "${BACKUP_FILE}" ] && usage
  if [ ! -s "${BACKUP_FILE}" ]; then
    echo "[$(date -Iseconds)] ERROR: backup file missing or empty: ${BACKUP_FILE}"
    exit 1
  fi

  # Pre-flight restorability check: decrypt + verify gzip without touching the DB
  echo "[$(date -Iseconds)] Verifying ${BACKUP_FILE} before restore"
  if ! decrypt_stream "${BACKUP_FILE}" | gunzip -t 2>/dev/null; then
    echo "[$(date -Iseconds)] ERROR: integrity check failed (decrypt/gunzip) on ${BACKUP_FILE}"
    exit 1
  fi
  echo "[$(date -Iseconds)] Integrity check passed"

  # Destructive guard
  if [ "${CONFIRM}" != "yes" ] && [ "${FORCE}" != "yes" ]; then
    echo "[$(date -Iseconds)] REFUSING destructive DB restore."
    echo "  Target DB: ${POSTGRES_DB} on ${POSTGRES_HOST}:${POSTGRES_PORT}"
    echo "  Re-run with CONFIRM=yes env or pass --force to proceed."
    exit 2
  fi

  echo "[$(date -Iseconds)] Restoring into DB '${POSTGRES_DB}' on ${POSTGRES_HOST}:${POSTGRES_PORT}"
  # Dumps are plain SQL (pg_dump | gzip) -> stream into psql
  decrypt_stream "${BACKUP_FILE}" | gunzip \
    | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -v ON_ERROR_STOP=1
  echo "[$(date -Iseconds)] DB restore completed"
}

restore_minio() {
  ARCHIVE="$1"
  BUCKET="$2"
  [ -z "${ARCHIVE}" ] && usage
  [ -z "${BUCKET}" ] && usage
  if [ ! -s "${ARCHIVE}" ]; then
    echo "[$(date -Iseconds)] ERROR: archive missing or empty: ${ARCHIVE}"
    exit 1
  fi

  # Pre-flight: decrypt + verify the tar/gzip stream
  echo "[$(date -Iseconds)] Verifying ${ARCHIVE} before restore"
  if ! decrypt_stream "${ARCHIVE}" | gunzip -t 2>/dev/null; then
    echo "[$(date -Iseconds)] ERROR: integrity check failed (decrypt/gunzip) on ${ARCHIVE}"
    exit 1
  fi
  echo "[$(date -Iseconds)] Integrity check passed"

  # Destructive guard (mc mirror can overwrite objects)
  if [ "${CONFIRM}" != "yes" ] && [ "${FORCE}" != "yes" ]; then
    echo "[$(date -Iseconds)] REFUSING MinIO restore into bucket '${BUCKET}'."
    echo "  Re-run with CONFIRM=yes env or pass --force to proceed."
    exit 2
  fi

  RESTORE_TMP="$(mktemp -d)"
  echo "[$(date -Iseconds)] Extracting archive to ${RESTORE_TMP}"
  decrypt_stream "${ARCHIVE}" | tar xzf - -C "${RESTORE_TMP}"

  # The archive contains a single top-level dir (<bucket>_<timestamp>)
  SRC_DIR="$(find "${RESTORE_TMP}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "${SRC_DIR}" ]; then
    echo "[$(date -Iseconds)] ERROR: no extracted directory found in archive"
    rm -rf "${RESTORE_TMP}"
    exit 1
  fi

  echo "[$(date -Iseconds)] Configuring mc and mirroring back into bucket '${BUCKET}'"
  mc alias set local_minio "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" >/dev/null 2>&1
  mc mb --ignore-existing "local_minio/${BUCKET}" >/dev/null 2>&1 || true
  mc mirror "${SRC_DIR}" "local_minio/${BUCKET}"

  rm -rf "${RESTORE_TMP}"
  echo "[$(date -Iseconds)] MinIO restore completed for bucket '${BUCKET}'"
}

case "${MODE}" in
  db)
    restore_db "$2"
    ;;
  minio)
    restore_minio "$2" "$3"
    ;;
  *)
    usage
    ;;
esac

echo "[$(date -Iseconds)] Restore job finished"
