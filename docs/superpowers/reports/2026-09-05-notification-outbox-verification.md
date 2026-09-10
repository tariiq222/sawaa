# Notification outbox: local verification

Implemented on `codex/notification-outbox`, based on `703e9444`, in the isolated `.worktrees/notification-outbox` checkout. Capture and delivery default to disabled. No commit, push, merge, deployment or production migration was performed.

## Verified behavior

PostgreSQL owns intent, per-target delivery and attempt history. The notification-specific BullMQ queue contains identifiers only. The independent lifecycle reconciles missing source intents, materialization, enqueue recovery, expired leases and SMS receipts. Unknown provider outcomes are never automatically resent.

Direct client creation atomically saves both client/staff intents; contact creation atomically saves its staff intent. A failed Redis wake-up after the durable client transaction does not turn committed success into an API error. The existing notification table and dashboard list/read APIs remain compatible.

## Evidence

| Check | Result |
|---|---|
| Fresh database migration | All 97 migrations applied, including the two additive outbox migrations |
| Real PostgreSQL + Redis acceptance | 2 suites, 35 tests passed; fake providers only |
| Direct source handler regression | 2 suites, 22 tests passed |
| Channel sender classification | 10 tests passed, including actual Resend adapter with mocked HTTP 429/500 |
| Backend TypeScript and build | Passed |
| Shared package build for runtime | Passed |
| Independent review | All findings resolved; no actionable P0/P1/P2 remained |
| Built backend HTTP/runtime | Contact creation 201; independent lifecycle MATERIALIZED; 2 in-app DELIVERED recipients; provider attempts 0; dashboard list 200 and mark-read 204 persisted |
| Backend regression suite | 806 suites / 7,243 tests passed; 1 suite / 1 test skipped; 165.983 seconds |
| Dashboard Playwright smoke | 41 passed, 1 skipped, exit 0; 2.7 minutes (includes authentication setup) |

Real-infrastructure cases cover transaction rollback (including failure of the second client intent), concurrent deduplication/materialization/claims, payload hash conflicts, malformed source quarantine, 205 due reminders plus a future reminder, cancellation/reschedule/expiry, lost Redis jobs, stale generations and leases, post-provider database failure, per-token partial outcomes, retry exhaustion, receipt pagination, in-flight expiry truthfulness and audited template repair.

The fresh test database completed the suites without the application seed or configured providers. Fixture cleanup left zero intents, deliveries, attempts, clients, staff and bookings after the initial fresh-database run. Runtime/UI checks used a separate dedicated test database with synthetic staff accounts.

The skipped dashboard conversation test requires `PW_CHAT_CONVERSATION_NAME` for a separately provisioned disposable conversation and is outside the notification outbox scope. Existing Frontman/Edge build warnings appeared during the dashboard dev-server run without failing the smoke suite.

After validation, the test backend and the three dedicated PostgreSQL, Redis and MinIO containers were stopped; container data was preserved. During backend SIGTERM shutdown, the existing shutdown handlers logged a duplicate Redis close rejection (`Connection is closed`); the process exited with code 0. Both `app.enableShutdownHooks()` and a manual SIGTERM `app.close()` are present in unchanged `src/main.ts`, and `RedisService.onModuleDestroy()` unconditionally calls `quit()`. This shutdown observation is outside the outbox changes and remains unresolved.

## Review corrections

The implementation includes bounded error codes, known-adapter HTTP 429 classification scoped to the provider call, atomic outcome/attempt fencing, current preference/token checks, preserved healthy queue generations, non-retryable failed SMS receipts, guarded lifecycle metrics/heartbeat updates, semantic payload validation and one-time template freezing during audited repair. Backlog progress includes advancement of the oldest due row, so matching arrivals and successful sends do not cause false stall warnings.

## Running the acceptance lane

Apply the repository migrations to a dedicated local test PostgreSQL database, export `NOTIFICATION_OUTBOX_TEST_DATABASE_URL` and `NOTIFICATION_OUTBOX_TEST_REDIS_URL`, then run:

```sh
pnpm --filter=backend exec jest --config test/jest-notification-outbox.json --runInBand
```

The suite requires local test infrastructure, creates missing minimal fixtures and cleans its own data. It does not use the default E2E setup that mocks Redis.

## Delivery boundary

No Auth, Payments, Mobile, shared legacy send handlers, provider credentials or webhook verification logic was changed. No endpoint/DTO shape changed, so the committed OpenAPI snapshot and hand-written API client did not require regeneration.

Local tests establish database/queue behavior and application integration. They do not prove recipient delivery through live providers. Existing HTTP adapters discard Retry-After headers, so their proven 429 failures use the durable backoff schedule. Follow [the operations runbook](../../../apps/backend/NOTIFICATION_OUTBOX.md) for controlled activation, rollback and UNKNOWN handling.
