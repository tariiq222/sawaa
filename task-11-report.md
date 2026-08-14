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
