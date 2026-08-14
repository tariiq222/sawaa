# Task 12 — Unified web conversation integration

## Implemented

- Registered `DashboardConversationsController` exactly once in `CommsModule`.
- Verified the existing public boot registration exposes `PublicChatController` and `MyChatController` exactly once through `PublicModule`.
- Kept the assistant and operation-resume event consumers in the same module and asserted their single provider registration, preserving the established event subscriptions in `onModuleInit` without adding a dependency cycle.
- Regenerated the committed backend OpenAPI snapshot from the current worktree source and regenerated dashboard API types. The snapshot now contains the dashboard conversation endpoints.
- Added a dashboard smoke flow for a disposable `WAITING_FOR_STAFF` conversation: claim, reply, release, then close. It intentionally requires `PW_CHAT_CONVERSATION_NAME` so a browser run cannot select or mutate arbitrary data.

## Proven locally

- Backend HTTP/controller and module-boot coverage: 5 suites, 36 tests passed (`PublicChatController`, `MyChatController`, `DashboardConversationsController`, `CommsModule`, and `PublicModule`). This includes public/guest, authenticated client, staff role, feature-flag, and controller request validation boundaries.
- Existing HTTP CSRF integration verifies the allowed website origin retains CORS and exposes the bootstrap CSRF header on a rejected mutation; the middleware emits a token on the protected GET bootstrap path.
- API client: 9 files, 118 tests passed; typecheck passed.
- Website chat/account/auth: 78 files, 656 tests passed.
- Dashboard conversations: 4 files, 36 tests passed; translation parity and dashboard typecheck passed.
- Backend typecheck, backend lint (warnings only), root `pnpm typecheck`, dashboard lint (warnings only), `git diff --check`, and dashboard production build passed.

## Deferred external integration boundaries

- The guarded real-Postgres two-session/race harness was not run: `REAL_E2E_DATABASE_URL` is unset. No non-disposable database was touched.
- Redis outbox/lease recovery was not run against live Redis for the same isolated-harness boundary.
- Dashboard Playwright smoke was not run: the backend at `localhost:5200` did not answer within two seconds, no compose configuration is present in this worktree, and `PW_CHAT_CONVERSATION_NAME` is unset. The committed test will run once a disposable seeded conversation and the normal backend/dashboard services are supplied.
