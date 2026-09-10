# Auth and Payments remediation — local verification

Date: 2026-09-05. Base: `703e944487a55ebadc579e241e50015c913e56d8`.

The user approved remediation of ten audit findings. Changes are local in the existing isolated worktree. No commit, push, deployment, real payment, migration change, or `apps/mobile` change was made.

## Changes

| Finding | Result |
|---|---|
| Custom-role authorization bypass | Assignment/removal require `manage:Role`, enforce canonical actor/target hierarchy and self/super-admin restrictions, and invalidate previous permission tokens. |
| Staff refresh resurrects logout | Refresh rotation and revoke-all share a User row lock. Token consumption, current user/version read, and replacement persistence commit together. |
| Client refresh requires live access token | Verified refresh credentials supply client identity; access expiry does not prevent refresh/logout. Existing CSRF protection remains. |
| Cash/card reservation race | Generic/package card initialization, manual collection, and pending transfer checks coordinate through Invoice locks. Unknown provider outcomes keep their reservations; stale cleanup/reference writes use conditional state checks. |
| Manual payment events lost after commit | Required payment/deposit events enter the durable outbox within the payment transaction, with stable payment-based event IDs and the existing delivery lane. Callers no longer double-stage events. |
| Webhook/reconcile double finalization | Both reread payment/invoice state under the Invoice lock, preserve terminal states, and emit one durable transition event. Late payments for closed invoices require manual review. |
| Abandoned webhook claim acknowledged forever | Claims use owner-fenced leases; unfinished live claims return retryable 503 and abandoned claims can be reclaimed. Only completed claims are acknowledged as duplicates. |
| Transient session failure treated as logout | Website/dashboard retain retryable session state for network/5xx failures. Terminal expiry, explicit logout, and uncertain remote revocation have separate behavior. A local routing hint can force login but cannot grant access. |
| Booking identity lost after payment-init failure | Booking/invoice identity is saved before initialization. Subsequent submission reuses the invoice even if payment-mode input changes; starting another booking is explicit. |
| Request deadline ends before body / indefinite waits | Backend provider deadlines cover standard response-body consumers. Website mutation/profile/logout waits are bounded. Shared refresh cancellation is isolated per caller; financial POSTs are not automatically replayed after unknown outcomes. |

## Verification

Validation ran against disposable PostgreSQL 16, Redis 7, and MinIO on task-specific loopback ports. All 95 committed migrations were applied to a new test database. Browser smoke uses a separate test clone. Provider responses in local financial tests are fakes; these results do not prove Moyasar sandbox behavior.

The local environment wrapper is `.superpowers/sdd/2026-09-05-auth-payments-audit-remediation/run-test-env.mjs` (ignored scratch file). It sets only local test-service credentials and test signing keys. Tests were run by the root orchestrator; reviewers performed read-only source review.

| Check | Result |
|---|---|
| Backend full Jest suite | 788 suites, 7,161 tests passed; 1 existing legacy-import test skipped because its separate database URL was not supplied. |
| Real PostgreSQL auth/identity/finance E2E | 5 suites, 41 tests passed; none skipped. |
| Website Vitest | 86 suites, 762 tests passed. |
| Dashboard Vitest | 230 suites, 1,974 tests passed. After the final restore-effect scheduling adjustment, both affected auth suites / 30 tests passed again. |
| Hand-written API client Vitest | 10 suites, 131 tests passed. |
| Backend, website, dashboard, API client typechecks | Passed. |
| Changed-source ESLint | Backend, website, and dashboard passed. |
| Backend / website / dashboard builds | All passed. |
| Dashboard browser smoke | 41 passed (including 4 setup checks), 1 conversation test skipped because `PW_CHAT_CONVERSATION_NAME` was absent. Production frontend build and compiled non-watch backend used. |
| Translation parity | Arabic/English key sets match. |
| `pnpm openapi:sync` | Passed; backend snapshot and dashboard generated types have no diff. |
| `git diff --check` | Passed. |
| Focused independent source review | No remaining actionable P1/P2 findings in the approved scope. |

The real-database suite covers refresh/logout lock contention and rejection of replacement credentials, role authorization, expired-access client refresh, both cash/card orderings, transfer/card reservation exclusion, generic/package checkout contention, durable manual outbox events, crashed webhook claims, live claim contention, and a webhook/reconcile interleaving observed waiting on the actual PostgreSQL Invoice lock.

Representative commands (run from repository root):

```sh
node .superpowers/sdd/2026-09-05-auth-payments-audit-remediation/run-test-env.mjs pnpm --filter=backend exec jest --runInBand --silent
node .superpowers/sdd/2026-09-05-auth-payments-audit-remediation/run-test-env.mjs pnpm --filter=backend exec jest --config test/jest-e2e.json --runInBand --silent staff-session-race.real-e2e-spec.ts client-auth.real-e2e-spec.ts identity-casl.real-e2e-spec.ts payment-reservation-concurrency.real-e2e-spec.ts moyasar-webhook-idempotency.real-e2e-spec.ts
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter=@sawaa/website test
pnpm --filter=dashboard test
pnpm --filter=@sawaa/api-client test
pnpm --filter=dashboard exec vitest run test/unit/auth/auth-provider.spec.tsx test/unit/auth/auth-gate.spec.tsx
node .superpowers/sdd/2026-09-05-auth-payments-audit-remediation/run-test-env.mjs --mode=development pnpm --filter=dashboard exec playwright test --config ../../.superpowers/sdd/2026-09-05-auth-payments-audit-remediation/playwright.config.ts --project smoke
```

Node 26 native Web Storage conflicts with the website's jsdom test environment; the website suite passes with the shown Node flag. The backend suite's existing legacy-import database test is outside this audit and requires its separate `LEGACY_IMPORT_TEST_DATABASE_URL`.

The Next.js smoke server logged aborted-request `ECONNRESET` exceptions during navigation; it continued serving and all enabled assertions passed. The smoke result is not a claim that runtime logs were error-free. Existing Sentry/Node deprecation warnings also appeared during builds/tests.

Final local logs: `/tmp/sawaa-08dd-backend-final-full.log`, `/tmp/sawaa-08dd-final-real-e2e.log`, `/tmp/sawaa-08dd-website-final.log`, `/tmp/sawaa-08dd-dashboard-final-full.log`, `/tmp/sawaa-08dd-dashboard-auth-targeted.log`, `/tmp/sawaa-08dd-api-client-final.log`, and `/tmp/sawaa-08dd-dashboard-smoke.log`. Browser report: `/tmp/sawaa-08dd-playwright-report/index.html`.

## Outstanding external gate

Moyasar sandbox validation is **not complete**. The seed test credential returned HTTP 401 on a read-only authentication check; the user was asked for the local location of valid test credentials. Success/decline/3DS, webhook delivery/replay, lost-create-response recovery, and partial/full refund behavior still require valid sandbox credentials. No live key or real payment was used. Local tests and source review do not establish production readiness.

Unknown remote create outcomes intentionally remain reserved until authoritative provider evidence permits recovery. This prevents a retry from opening a second payable checkout, but may require reconciliation or operator review when the provider outcome cannot be recovered.
