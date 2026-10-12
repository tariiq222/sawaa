#!/bin/zsh
# Live wiring smoke for the unified client API (/api/v1/client).
# Boots the already-built backend (apps/backend/dist) on a throwaway port and checks guards,
# CSRF-by-transport, deprecation headers on legacy prefixes and Swagger exposure.
# Prerequisites: `pnpm docker:up` (Postgres/Redis), apps/backend/.env, `pnpm --filter=backend run build`.
set -u
PORT_SMOKE=${PORT_SMOKE:-5201}
LOG=${TMPDIR:-/tmp}/client-api-live-smoke.log
cd "$(dirname "$0")/../../apps/backend"
PORT=$PORT_SMOKE node dist/src/main.js > "$LOG" 2>&1 &
PID=$!
for i in {1..60}; do curl -sf "http://localhost:$PORT_SMOKE/api/v1/health/live" >/dev/null && break; sleep 1; done
B="http://localhost:$PORT_SMOKE/api/v1"
chk() { printf '%-78s -> %s\n' "$1" "$2"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
chk "GET /health/live (expect 200)" "$(code $B/health/live)"
chk "GET /client/profile without token (expect 401)" "$(code $B/client/profile)"
chk "GET /client/bookings without token (expect 401)" "$(code $B/client/bookings)"
chk "GET /mobile/client/profile (expect 401 + Deprecation: true)" "$(curl -s -o /dev/null -D - $B/mobile/client/profile | grep -iE '^HTTP|^deprecation' | tr -d '\r' | tr '\n' ' ')"
chk "GET /public/me (expect 401 + Deprecation: true)" "$(curl -s -o /dev/null -D - $B/public/me | grep -iE '^HTTP|^deprecation' | tr -d '\r' | tr '\n' ' ')"
chk "GET /client/profile has no Deprecation header (expect 0)" "$(curl -s -o /dev/null -D - $B/client/profile | grep -ic '^deprecation')"
chk "GET /public/payments/methods anonymous (expect 200)" "$(code $B/public/payments/methods)"
chk "POST /client/bookings cookie session, no CSRF (expect 403 CSRF_INVALID)" "$(curl -s -X POST -H 'Content-Type: application/json' -H 'Cookie: client_access_token=x' -d '{}' $B/client/bookings | head -c 100)"
chk "POST /mobile/client/bookings cookie session, no CSRF (expect 403 CSRF_INVALID)" "$(curl -s -X POST -H 'Content-Type: application/json' -H 'Cookie: client_access_token=x' -d '{}' $B/mobile/client/bookings | head -c 100)"
chk "POST /client/bookings bearer junk, no cookie (expect 401, CSRF bypassed)" "$(code -X POST -H 'Authorization: Bearer junk' -H 'Content-Type: application/json' -d '{}' $B/client/bookings)"
chk "Swagger lists /client/ paths (expect 54)" "$(curl -s http://localhost:$PORT_SMOKE/api/docs-json | python3 -c "import json,sys;d=json.load(sys.stdin);print(sum(1 for p in d['paths'] if '/client/' in p))")"
chk "GET /public/metrics (expect 401 or 503, never 200 without token)" "$(code $B/public/metrics)"
kill $PID; wait $PID 2>/dev/null
echo "backend stopped; log: $LOG"
grep -iE "unknowndependenc|nest can't resolve" "$LOG" | head -3
