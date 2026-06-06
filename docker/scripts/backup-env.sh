#!/bin/sh
# =============================================================================
# Environment / secrets backup for Sawa production
#
# Snapshots the production env file + the secrets dir into a single ENCRYPTED
# archive, then pushes it offsite via the shared offsite-upload.sh helper.
#
# WHY: the DB and MinIO backups are encrypted with BACKUP_ENCRYPTION_KEY and the
# app reads provider secrets (Moyasar, JWT, Zoom, SMS, Email, MinIO creds) from
# env. If the server dies and these are not backed up, the encrypted DB/MinIO
# dumps become unrecoverable and the app can't be brought back. This closes that
# gap.
#
# Inputs (env):
#   ENV_BACKUP_SOURCES   space-separated files/dirs to capture
#                        (default: "/env/.env.prod /secrets")
#   BACKUP_ENCRYPTION_KEY  REQUIRED — same key as the DB/MinIO backups
#   BACKUP_RETENTION_DAYS  default 30
#   plus offsite vars consumed by offsite-upload.sh
# =============================================================================

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
SOURCES="${ENV_BACKUP_SOURCES:-/env/.env.prod /secrets}"

alert_failure() {
  _code=$?
  [ "${_code}" = "0" ] && return 0
  echo "[$(date -Iseconds)] FAILURE: env backup exited ${_code}"
  _payload="{\"text\":\"🔴 Sawa env/secrets backup FAILED (exit ${_code}) at $(date -Iseconds)\"}"
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

# Encryption is mandatory here — env/secrets must never be stored in plaintext.
if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
  echo "[$(date -Iseconds)] ERROR: BACKUP_ENCRYPTION_KEY unset — refusing to back up secrets unencrypted"
  exit 1
fi

# Collect only the sources that actually exist.
PRESENT=""
for s in ${SOURCES}; do
  if [ -e "${s}" ]; then
    PRESENT="${PRESENT} ${s}"
  else
    echo "[$(date -Iseconds)] WARNING: env-backup source not found, skipping: ${s}"
  fi
done

if [ -z "${PRESENT}" ]; then
  echo "[$(date -Iseconds)] ERROR: no env-backup sources present (${SOURCES})"
  exit 1
fi

ARCHIVE="${BACKUP_DIR}/env_${TIMESTAMP}.tar.gz.enc"
echo "[$(date -Iseconds)] Archiving env/secrets:${PRESENT}"

# tar from / so absolute paths are captured predictably, then encrypt the stream.
# shellcheck disable=SC2086
tar czf - -C / $(echo "${PRESENT}" | sed 's|^/||; s| /| |g') \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 -salt \
      -pass "pass:${BACKUP_ENCRYPTION_KEY}" -out "${ARCHIVE}"

# Restorability round-trip: decrypt + verify the tar/gzip stream.
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -md sha256 \
      -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
      -in "${ARCHIVE}" 2>/dev/null | gunzip -t 2>/dev/null; then
  echo "[$(date -Iseconds)] ERROR: decrypt+gunzip round-trip failed on ${ARCHIVE}"
  rm -f "${ARCHIVE}"
  exit 1
fi
echo "[$(date -Iseconds)] env backup written + verified: ${ARCHIVE} ($(du -h "${ARCHIVE}" | cut -f1))"

# Offsite (opt-in; same helper as DB/MinIO).
sh /scripts/offsite-upload.sh "${ARCHIVE}" "env"

# Retention.
DELETED=$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "env_*.tar.gz.enc" -mtime +"${RETENTION_DAYS}" -delete -print 2>/dev/null | wc -l)
echo "[$(date -Iseconds)] Cleaned up ${DELETED} old env backup(s)"

echo "[$(date -Iseconds)] env backup job finished"
