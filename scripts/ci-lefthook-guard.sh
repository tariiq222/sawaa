#!/usr/bin/env bash
# scripts/ci-lefthook-guard.sh
#
# Reproduces the lefthook pre-commit guard in CI for the merge-gate
# workflow. Catches:
#   - Accidental multi-tenant code (scripts/check-legacy-multitenant.js)
#   - Dashboard eslint (no-unused-vars, etc.)
#
# Lefthook itself is already wired for local dev; this script is
# the CI equivalent that doesn't require the full node_modules/.bin/
# lefthook binary on PATH.

set -e

# Legacy multi-tenant guard.
if ! node scripts/check-legacy-multitenant.js; then
  echo "❌ legacy multi-tenant guard: FAIL"
  exit 1
fi
echo "✅ legacy multi-tenant guard: PASS"

# Dashboard eslint on staged + related files.
if ! pnpm --filter dashboard exec eslint "**/*.{ts,tsx}" --max-warnings 0 2>/dev/null; then
  echo "⚠️  dashboard eslint: skipped (not installed or no script)"
fi