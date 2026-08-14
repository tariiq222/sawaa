# Task 11 — retention, limits, and safe audit report

## Delivered

- Added configurable closed-chat retention with a `365` day default. The cron deletes only `CLOSED` conversations whose `closedAt` is strictly older than the cutoff; open chats and closed chats without an old `closedAt` are preserved. Existing WhatsApp retention remains unchanged.
- Validated and documented the full backend web-chat environment contract: `WEB_CHAT_ENABLED`, `CHAT_GUEST_TOKEN_SECRET`, `CHAT_MAX_MESSAGE_LENGTH`, `CHAT_RATE_LIMIT_PER_MINUTE`, `CHAT_DAILY_TOKEN_BUDGET`, `CHAT_GUEST_SESSION_DAYS`, and `RETENTION_CHAT_DAYS`.
- Made the guest cookie lifetime use `CHAT_GUEST_SESSION_DAYS`.
- Added Redis-backed message throttling by opaque identity and IP, plus daily actual-token accounting. Redis keys use HMAC-SHA256 and never contain raw client IDs, guest tokens/hashes, or IP addresses.
- Added semantic `ChatAuditService` lifecycle events for handoff, guest/staff claim, staff assignment, release, close, and operation confirmation/success/failure. Audit payloads are constructed from allowlisted IDs and action names only; runtime message bodies, guest phone numbers, names, and unknown fields are discarded.
- Integrated audits only after successful compare-and-set transitions. Guest claims, staff claim/assign/release/close, and operation outcomes write audit rows in their existing transaction. Idempotent handoff and terminal operation retries do not emit duplicates.

## TDD evidence

RED was observed before implementation:

- Retention tests failed because `chatConversation.deleteMany` was not called.
- Environment and guest-session tests failed because the new defaults and configurable cookie lifetime did not exist.
- Usage-limit and audit unit tests failed with missing service modules.
- Lifecycle integration tests failed because no semantic audit calls were emitted.

GREEN after implementation:

- Focused backend run: **18 suites passed, 272 tests passed**.
- Backend typecheck: passed.
- Backend lint: passed with **0 errors** and 7 pre-existing warnings in unrelated booking/org-experience files.
- `git diff --check`: passed.

The retention fail-isolation test intentionally logs a simulated `db lock timeout`. Jest also reports the repository's existing worker teardown warning after the focused multi-file run; all selected tests pass.

## Scope boundaries observed

- No OpenAPI regeneration.
- No full test suite.
- No live Redis or destructive database operation.
- No deployment.
- No WhatsApp retention, environment, or configuration removal.

## Security follow-up

- `WEB_CHAT_ENABLED=false` is now an API-level 404 gate for all guest and authenticated web-chat routes. The assistant worker also stops before lease acquisition or provider use; health and CSRF bootstrap routes are outside this gate.
- Daily token accounting now atomically reserves the remaining opaque Redis budget before each provider call, reconciles the reservation to the provider's actual usage, and releases it only when the provider call did not complete. Concurrent calls cannot both reserve the same remaining budget; an unknown usage or Redis-settlement failure conservatively retains the reservation until the UTC-day TTL.
- Nonstaff message idempotency lookup occurs before Redis throttling, so a persisted duplicate replays even during a Redis outage. New work remains limited by opaque HMAC identity and IP keys.
- Handoff CAS and `HANDOFF_REQUESTED` audit are in one RLS transaction, so an audit failure rolls the transition back and a retry can emit the event. The legacy dashboard close path and operation acknowledge/decline/resume outcomes also write exactly one ID-only semantic audit event in their state transaction.

Security follow-up verification: **12 focused suites passed, 163 tests passed**; backend typecheck passed; backend lint passed with the same 0 errors and 7 unrelated warnings; `git diff --check` passed. The focused Jest aggregation emitted the repository's existing worker-teardown warning after all suites passed.

## Conservative-limit follow-up

- Provider work now reserves a fixed `16,800`-token worst-case allowance per request (bounded prompt/history/tool allowance plus the 800-token output ceiling). A near-cap request is rejected before the provider is called; the provider output ceiling is constrained by the reservation. Settlement only returns unused allowance and never increases a daily counter above its pre-reserved cap. Timeouts and other ambiguous provider failures retain their reservation through the daily TTL.
- Message identity and IP rate increments now share one Redis Lua transaction, avoiding a partially accepted dual-key increment. A unique-index duplicate race refunds its accepted rate reservation before returning the durable winning message, so concurrent retries of the same client message do not consume the quota twice.
- Legacy close now uses a conditional `updateMany` CAS. Only a successful count of one writes `CONVERSATION_CLOSED`; a concurrent loser returns the already-closed record without a duplicate audit event.

## Provider payload-bound follow-up

- Before every provider round, the assistant now enforces a 24,000-byte message envelope (including message/tool-call overhead), a 6,000-byte system-prompt ceiling, and a 12,000-byte tool-definition ceiling. Tool arguments over 2,000 bytes are rejected and each persisted tool result is projected to at most 1,000 bytes before it can be accumulated.
- The per-round daily reservation is derived from these enforced maxima: 24,000 bounded message bytes + 12,000 bounded definitions bytes + 800 output tokens = 36,800 conservative tokens. Oversized static definitions fail before reserve/provider use; the multi-round test covers all eight permitted tool results and asserts every provider payload remains within the enforced limits.
