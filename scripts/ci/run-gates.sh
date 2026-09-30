#!/usr/bin/env bash
# Runs inside the disposable Linux runner, never on the workstation.
set -euo pipefail
cd /repo
mkdir -p /evidence
export CI=true NEXT_TELEMETRY_DISABLED=1 TZ=Asia/Riyadh
export NODE_OPTIONS=--max-old-space-size=4096
export PNPM_HOME=/pnpm
export npm_config_store_dir=/pnpm/store
export DATABASE_URL='postgresql://test:test@localhost:5432/sawaa_test?schema=public'
export REDIS_HOST=localhost REDIS_PORT=6379
export MINIO_ENDPOINT=localhost MINIO_PORT=9000 MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin123 MINIO_BUCKET=sawaa-test MINIO_USE_SSL=false
export AUTHENTICA_API_KEY=ci-synthetic-key
export SUPER_ADMIN_EMAIL=super-admin@sawaa-test.com SUPER_ADMIN_PASSWORD=SuperAdmin@123456
export CORS_ORIGINS=http://localhost:5203 DASHBOARD_PUBLIC_URL=http://localhost:5203
export API_PUBLIC_URL=http://localhost:5200 PUBLIC_WEBSITE_URL=http://localhost:5205
export THROTTLER_DISABLED=true PORT=5200
export NEXT_PUBLIC_API_URL=http://localhost:5200/api/v1
export PW_API_URL=http://localhost:5200 PW_DASHBOARD_URL=http://localhost:5203
export OUTBOX_TEST_REDIS_PORT=35454 OUTBOX_TEST_REDIS_TARGET=ci OUTBOX_TEST_ALLOW_REDIS_FAULT=1
export SEMGREP_SEND_METRICS=off SEMGREP_APP_TOKEN=''
# Synthetic keys exist only in this container's process tree. No .env is read.
for key in JWT_ACCESS_SECRET JWT_REFRESH_SECRET JWT_OTP_SECRET JWT_CLIENT_ACCESS_SECRET CHAT_GUEST_TOKEN_SECRET; do
  export "$key=$(node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("hex"))')"
done
for key in MOYASAR_ENCRYPTION_KEY AI_PROVIDER_ENCRYPTION_KEY SMS_PROVIDER_ENCRYPTION_KEY ZOOM_PROVIDER_ENCRYPTION_KEY EMAIL_PROVIDER_ENCRYPTION_KEY; do
  export "$key=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')"
done
# Platform settings validation requires exactly 64 hexadecimal characters.
export PLATFORM_SETTINGS_KEY=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')
# Pin pnpm to the repository's packageManager; Corepack downloads it once.
corepack prepare "$(node -p 'require("./package.json").packageManager')" --activate
printf 'phase\tstatus\texit_code\tseconds\n' > /evidence/phases.tsv
failed=0
run_phase() {
  name=$1
  seconds=$2
  started=$(date +%s)
  printf '\n===== %s =====\n' "$name"
  set +e
  timeout --signal=TERM --kill-after=30s "$seconds" bash scripts/ci/phase.sh "$name" 2>&1 | tee "/evidence/$name.log"
  code=${PIPESTATUS[0]}
  set -e
  elapsed=$(( $(date +%s) - started ))
  if [ "$code" = 0 ]; then
    state=PASS
  elif [ "$code" = 125 ]; then
    state=BLOCKED
    failed=1
  else
    state=FAIL
    failed=1
  fi
  printf '%s\n' "$code" > "/evidence/$name.exitcode"
  printf '%s\t%s\t%s\t%s\n' "$name" "$state" "$code" "$elapsed" >> /evidence/phases.tsv
  printf '===== %s: %s (%ss) =====\n' "$name" "$state" "$elapsed"
}
# Sequential execution limits memory and avoids shared workspace build races.
run_phase startup-contract 120
run_phase migration-immutability 120
run_phase release-integrity 180
run_phase critical-skip-guard 120
run_phase root-install 1200
run_phase prisma-generate 300
run_phase shared-build 300
run_phase database-migrate 300
run_phase backend-lint 600
run_phase backend-typecheck 600
run_phase backend-unit 1200
run_phase backend-e2e 1200
run_phase openapi-snapshot 600
run_phase openapi-coverage 180
run_phase api-client-drift 120
run_phase critical-real-e2e 2100
run_phase outbox-transport 900
run_phase dashboard-generated-types 180
run_phase dashboard-api-drift 120
run_phase dashboard-i18n 180
run_phase dashboard-lint 600
run_phase dashboard-typecheck 600
run_phase dashboard-unit 900
run_phase dashboard-build 900
run_phase dashboard-smoke 1500
run_phase website-lint 600
run_phase website-typecheck 600
run_phase website-unit 900
run_phase website-build 900
run_phase dependency-audit 300
run_phase gitleaks 900
run_phase trivy 1200
run_phase semgrep 1800
# Mobile's nested workspace can relink the shared package. Keep it after all
# root workspace consumers, exactly as a separate CI job would be isolated.
run_phase mobile-install 1200
run_phase mobile-shared-build 300
run_phase mobile-lint 600
run_phase mobile-typecheck 600
run_phase mobile-unit-coverage 1200
# Keep evidence even for failed suites; missing required scanner reports already
# fail their own phases. No secret environment or generated key files are copied.
for path in apps/backend/test-results-critical.json apps/backend/test-results-critical.exitcode \
  apps/backend/test-results-clients.json apps/backend/test-results-outbox.json \
  apps/dashboard/playwright-report apps/dashboard/test-results apps/mobile/coverage; do
  if [ -e "$path" ]; then
    mkdir -p "/evidence/$(dirname "$path")"
    cp -R "$path" "/evidence/$path"
  fi
done
cat /evidence/phases.tsv
printf '%s\n' "$failed" > /evidence/gates.exitcode
exit "$failed"
