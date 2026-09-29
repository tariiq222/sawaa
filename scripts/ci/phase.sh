#!/usr/bin/env bash
set -euo pipefail
cd /repo
require_phase() {
  for dependency in "$@"; do
    if [ ! -f "/evidence/$dependency.exitcode" ] || [ "$(cat "/evidence/$dependency.exitcode")" != 0 ]; then
      echo "BLOCKED: prerequisite $dependency did not pass." >&2
      exit 125
    fi
  done
}
use_database() {
  export DATABASE_URL="postgresql://test:test@localhost:5432/$1?schema=public"
}
case "${1:?Phase name required}" in
  startup-contract) node --test docker/openship/start-backend.test.cjs ;;
  migration-immutability) node scripts/check-prisma-migration-immutability.mjs "$SAWAA_CI_BASE_REF" ;;
  release-integrity) node --test scripts/tag-release.test.mjs scripts/check-deploy-state.test.mjs scripts/record-deployment.test.mjs ;;
  critical-skip-guard) node --test scripts/assert-critical-test-results.test.mjs ;;
  root-install) pnpm install --frozen-lockfile --store-dir /pnpm/store ;;
  prisma-generate)
    require_phase root-install
    pnpm --filter=backend prisma:generate ;;
  shared-build)
    require_phase root-install prisma-generate
    pnpm --filter=@sawaa/shared build ;;
  database-migrate)
    require_phase prisma-generate
    pnpm --filter=backend prisma:migrate:deploy ;;
  backend-lint)
    require_phase root-install
    pnpm --filter=backend lint ;;
  backend-typecheck)
    require_phase prisma-generate shared-build
    pnpm --filter=backend typecheck ;;
  backend-unit)
    require_phase prisma-generate shared-build database-migrate
    pnpm --filter=backend test --runInBand ;;
  backend-e2e)
    require_phase prisma-generate shared-build database-migrate
    pnpm --filter=backend test:e2e --runInBand ;;
  openapi-snapshot)
    require_phase prisma-generate shared-build database-migrate
    cp apps/backend/openapi.json /tmp/ci-openapi-original.json
    trap 'cp /tmp/ci-openapi-original.json apps/backend/openapi.json' EXIT
    pnpm --filter=backend run openapi:build-and-snapshot
    git diff --exit-code -- apps/backend/openapi.json ;;
  openapi-coverage)
    require_phase root-install
    pnpm --filter=backend run check:openapi-coverage ;;
  api-client-drift) node scripts/check-api-client-drift.mjs ;;
  critical-real-e2e)
    require_phase prisma-generate shared-build critical-skip-guard
    use_database sawaa_critical_test
    export REAL_E2E_DATABASE_URL="$DATABASE_URL"
    pnpm --filter=backend prisma:migrate:deploy
    pnpm --filter=backend test:e2e:critical ;;
  outbox-transport)
    require_phase prisma-generate shared-build
    use_database sawaa_outbox_test
    export REAL_E2E_DATABASE_URL="$DATABASE_URL" REDIS_HOST=127.0.0.1 REDIS_PORT=35454
    pnpm --filter=backend prisma:migrate:deploy
    pnpm --filter=backend test:e2e:outbox ;;
  dashboard-generated-types)
    require_phase root-install
    cp apps/dashboard/lib/types/api.generated.ts /tmp/ci-api-generated-original.ts
    trap 'cp /tmp/ci-api-generated-original.ts apps/dashboard/lib/types/api.generated.ts' EXIT
    pnpm --filter=dashboard run openapi:generate
    git diff --exit-code -- apps/dashboard/lib/types/api.generated.ts ;;
  dashboard-api-drift) node scripts/check-dashboard-api-drift.mjs ;;
  dashboard-i18n)
    require_phase root-install
    pnpm --filter=dashboard i18n:verify ;;
  dashboard-lint)
    require_phase root-install
    pnpm --filter=dashboard lint ;;
  dashboard-typecheck)
    require_phase shared-build
    pnpm --filter=dashboard typecheck ;;
  dashboard-unit)
    require_phase shared-build
    pnpm --filter=dashboard test --maxWorkers=2 ;;
  dashboard-build)
    require_phase shared-build
    env NODE_ENV=production pnpm --filter=dashboard build ;;
  dashboard-smoke)
    require_phase shared-build prisma-generate dashboard-build
    use_database sawaa_smoke_test
    export NODE_ENV=test
    pnpm --filter=backend prisma:migrate:deploy
    pnpm --filter=backend seed
    pnpm --filter=dashboard exec playwright install --with-deps chromium
    pnpm --filter=backend build
    (cd apps/backend && exec node dist/src/main.js) > /evidence/backend-smoke.log 2>&1 &
    backend_pid=$!
    stop_backend() {
      if kill -0 "$backend_pid" 2>/dev/null; then kill "$backend_pid"; fi
      wait "$backend_pid" 2>/dev/null || [ "$?" = 143 ]
    }
    trap stop_backend EXIT
    ready=0
    for attempt in $(seq 1 90); do
      if ! kill -0 "$backend_pid" 2>/dev/null; then cat /evidence/backend-smoke.log; exit 1; fi
      if curl -fsS http://localhost:5200/api/v1/health >/dev/null 2>&1; then ready=1; break; fi
      sleep 2
    done
    [ "$ready" = 1 ] || { cat /evidence/backend-smoke.log; exit 1; }
    # CI forces Playwright's production Next build/start and forbids .only.
    env NODE_ENV=production pnpm --filter=dashboard e2e:smoke ;;
  website-lint)
    require_phase root-install
    pnpm --filter=@sawaa/website lint ;;
  website-typecheck)
    require_phase shared-build
    pnpm --filter=@sawaa/website typecheck ;;
  website-unit)
    require_phase shared-build
    pnpm --filter=@sawaa/website test --maxWorkers=2 ;;
  website-build)
    require_phase shared-build
    env NODE_ENV=production NEXT_PUBLIC_API_URL=http://localhost:5200 pnpm --filter=@sawaa/website build ;;
  dependency-audit)
    require_phase root-install
    pnpm audit --audit-level=high ;;
  gitleaks)
    gitleaks git --log-opts=--all --redact --report-format json --report-path /evidence/gitleaks.json . ;;
  trivy)
    trivy fs --scanners vuln --severity HIGH,CRITICAL --exit-code 1 \
      --format sarif --output /evidence/trivy-fs.sarif \
      --skip-dirs '**/node_modules,**/dist,**/coverage,**/.next,.git' \
      --skip-files '**/coverage/**,**/dist/**,**/node_modules/**,**/.next/**' . ;;
  semgrep)
    set +e
    semgrep scan --config p/ci --metrics=off --disable-version-check --error --strict \
      --json --output /evidence/semgrep-results.json --sarif-output /evidence/semgrep-results.sarif \
      --include '*.ts' --include '*.tsx' --include '*.js' --include '*.jsx' \
      --exclude '**/node_modules/**' --exclude '**/dist/**' --exclude '**/coverage/**' \
      --exclude 'apps/mobile/**' .
    status=$?
    set -e
    test -s /evidence/semgrep-results.json
    test -s /evidence/semgrep-results.sarif
    exit "$status" ;;
  mobile-install) pnpm --dir apps/mobile install --frozen-lockfile --store-dir /pnpm/store ;;
  mobile-shared-build)
    require_phase mobile-install
    pnpm --dir apps/mobile --filter=@sawaa/shared build ;;
  mobile-lint)
    require_phase mobile-install
    pnpm --dir apps/mobile lint ;;
  mobile-typecheck)
    require_phase mobile-shared-build
    pnpm --dir apps/mobile typecheck ;;
  mobile-unit-coverage)
    require_phase mobile-shared-build
    pnpm --dir apps/mobile test --runInBand ;;
  *) echo "Unknown CI phase: $1" >&2; exit 2 ;;
esac
