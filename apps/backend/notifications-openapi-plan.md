# Notifications typed OpenAPI implementation plan

> Execution: superpowers:executing-plans, with test-driven-development and verification-before-completion. Existing isolated worktree; no commit, push or deploy.

**Goal:** Replace four manual Dashboard notification calls with generated OpenAPI contracts, preserving public behavior.
**Architecture:** Document existing controller responses; retain handlers, guards and persistence unchanged. Route the existing wrapper through `openApi` with generated response compatibility checked by TypeScript.
**Tech stack:** NestJS Swagger, Prisma, Jest/Supertest, Next.js, Vitest, openapi-typescript.
**Spec:** User request: Backend + Dashboard only; exclude Mobile, Auth and Payments/Moyasar; one small independent batch, one generation, focused contract tests, ratchet and typecheck.

## Inventory and selection

Static counts from production `api.get/post/patch/put/delete` expressions in `apps/dashboard/lib/api/*.ts`; consumers are direct importing production files under hooks/components/app (not runtime traffic).

| Candidate | Manual calls | Direct consumers | Usage and drift risk | Priority |
|---|---:|---:|---|---|
| services (includes categories) | 18 | 15 | Broad forms and selection use; nested durations, employees and pricing; high drift | 1 for later scoped batch |
| employees-schedule | 18 | 7 | Booking slot selection; time and availability shapes; high drift | 2 |
| employees | 14 | 16 | Broad use, relation normalization; account operations excluded | 3, split reads first |
| notifications | 4 | 2 | Global badge/dropdown via hook and dedicated page; two missing response schemas | **Selected**, compact high return |
| organization (hours/holidays) | 5 | 3 | Settings and mapping; moderate drift | Next compact batch |
| conversations | 9 | 3 | Polling inbox and stateful writes; high drift | Later |
| intake-forms | 7 | 2 | Dynamic fields/response mapping; high drift | Later |
| email-templates | 4 | 1 | Array/envelope fallback; moderate drift | Later |
| activity-log | 1 | 1 | Transformed actor/entity data; moderate drift | Later |
| chatbot / chatbot-kb / sawaa-ai-knowledge-base | 6 / 3 / 8 | 3 / 2 / 2 | Dynamic AI payloads; higher contract complexity | Later |
| programs | 8 | 1 | Stateful lifecycle and enrollment; split from financial effects first | Later |
| booking-settings | 2 | 3 | Configuration surface; cancellation semantics | Later |

Mixed or sensitive wrappers deferred: bookings, dashboard-stats/reports (financial data), organization-settings (payment settings), packages and credits, coupons, invoices, payments, users/roles, Zoom/SMS/email/AI provider credentials. `openapi.ts` is shared transport, not a migration candidate. Already typed branches, departments, clients, discount reasons and contact messages are excluded from the remaining manual inventory.

## Contracts and ownership

- Backend: `src/api/dashboard/dto/notification-response.dto.ts` and notification decorators in `comms.controller.ts`; notification contract assertions in `comms.controller.spec.ts`.
- Dashboard: `lib/api/notifications.ts`, `test/unit/lib/notifications-api.spec.ts`; keep public types and functions unchanged.
- Generated: `apps/backend/openapi.json`, `apps/dashboard/lib/types/api.generated.ts` only after backend contracts pass.
- Shared DTOs/transport, unrelated controller methods, guards and handlers remain outside implementation ownership.
- All stages depend on the selected response schema; execute sequentially, no concurrent file ownership.

## Steps

- [x] Verify existing notification tests in the isolated worktree.
- [x] Add failing Swagger tests: list 200 -> PaginatedNotificationsResponseDto, unread 200 -> NotificationUnreadCountResponseDto, mark-read 204 without content; page/limit/unreadOnly; required entity fields, enums, nullable metadata/readAt, full six-field pagination meta.
- [x] Exercise HTTP list with complete row and Dates serialized to ISO strings; defaults, explicit pagination/unread flag, invalid queries; exercise mark-read absent/empty/single/invalid bodies and empty 204 response.
- [x] Implement response DTOs with `@ApiProperty`; document pagination on the notification route only. Metadata is object-or-null per both notification writers; Prisma storage itself permits arbitrary JSON, which remains a persistence limitation.
- [x] Run focused backend notification/controller tests, then generate snapshot/types once from this checkout's controller metadata.
- [x] Add failing wrapper boundary tests for serialized URL, complete response, count extraction including zero, single/all read body, void returns and unchanged errors.
- [x] Replace `api` import with `openApi`; use literal `/api/v1/dashboard/comms/notifications` paths and typed options. `markAllAsRead` sends `body: {}`, matching existing transport behavior.
- [x] Run focused backend/dashboard suites, OpenAPI coverage ratchet, Backend/Dashboard typechecks and Dashboard smoke; report environmental blockers without claiming live proof.
- [x] Review scoped diff for unrelated generated changes, casts/any, no sensitive edits; record actual results below.

## Results

- Backend: `pnpm --filter=backend exec jest --runInBand src/api/dashboard/comms.controller.spec.ts src/modules/comms/notifications` — 8 suites / 54 tests passed. Three new Swagger assertions failed before implementation; HTTP tests required permission to bind Supertest's local port.
- Dashboard: `pnpm --filter=dashboard exec vitest run test/unit/lib/notifications-api.spec.ts test/unit/hooks/use-notifications.spec.tsx test/unit/features/notifications/notification-card.spec.tsx` — 3 suites / 22 tests passed. Four boundary assertions failed before wrapper migration.
- `pnpm check:openapi-coverage` — 274 routes checked, 151 known gaps, 0 new. Baseline unchanged.
- `pnpm --filter=backend run typecheck` and `pnpm --filter=dashboard run typecheck` — both passed.
- Snapshot generation: standard `WRITE_OPENAPI_SPEC=1` bootstrap from this checkout's compiled `dist/src/main.js`, with process-local test-only environment values; copied `dist/openapi.json` to `openapi.json`. Then `pnpm --filter=dashboard run openapi:generate` once. This uses the repository's snapshot path because `openapi:sync` fetches an already-running backend and none was available. No hand edits or partial schema merging. Semantic diff: only notification list/count paths and four new notification schemas. Mark-read remains 204.
- Nest's normal build hit `EMFILE` in its configured asset watcher. Direct `pnpm --filter=backend exec tsc -p tsconfig.build.json` passed and supplied the compiled source for snapshot generation. This is not a claim that the normal Nest build passed.
- `pnpm --filter=dashboard run e2e:smoke` was attempted, then retried with local-port permission: Next.js started, but required admin/owner setup failed with `fetch failed` against the unavailable backend at localhost:5200. Two optional setup tests returned, 38 smoke tests did not run. **Authenticated smoke and live notification flow remain unverified.** No database was provisioned or reset for this batch.
- Read-only Sol review reported no actionable findings. `git diff --check` passed. Four manual calls in notifications.ts became zero; no new any/casts in the wrapper or DTO. No changes to public notification types, hooks, shared api-client, Mobile, Auth, payments or provider settings; no commit/push/deploy.
