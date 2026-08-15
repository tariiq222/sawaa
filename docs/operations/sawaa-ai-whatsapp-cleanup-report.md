# Sawaa Ai — WhatsApp cleanup inventory

**Scope:** Task 1 inventory only. This document does not unregister runtime,
remove UI, delete code, alter Prisma schema, or delete data. The static guard
is expected to be RED until Tasks 2–4 are complete.

## Decision boundary

| Classification | Meaning in this plan |
| --- | --- |
| `REMOVE_RUNTIME` | Keep historical code/data available for the bounded cleanup, but remove its active module/controller/worker/config registration in Task 2. |
| `DELETE_DEAD_CODE` | Candidate executable/UI code for Task 4, only after `rg` and module-graph proof show no active consumer. |
| `PRESERVE_HISTORY` | Prisma models/enums/migrations, historical source values, retention/audit paths, and documentation needed for rollback or reporting. No deletion in this rollout. |

## Backend runtime inventory

| Classification | Exact path / symbol | Dependency and next action |
| --- | --- | --- |
| `REMOVE_RUNTIME` | `apps/backend/src/app.module.ts`: `WhatsappModule` import and `imports` entry | Root Nest registration; remove only in Task 2. |
| `REMOVE_RUNTIME` | `apps/backend/src/main.ts:47`: CSRF bypass for `/api/v1/public/whatsapp` | Remove this webhook exemption when the public controller is unregistered; do not weaken CSRF for remaining public endpoints. |
| `REMOVE_RUNTIME` | `apps/backend/src/modules/integrations/whatsapp/whatsapp.module.ts` | Registers both dashboard controllers, public webhook, agent handlers, transport, queue, worker, and startup sync. |
| `REMOVE_RUNTIME` | `apps/backend/src/api/dashboard/whatsapp-agent.controller.ts` (`dashboard/whatsapp`) | Live agent/status/QR/conversation endpoints. |
| `REMOVE_RUNTIME` | `apps/backend/src/api/dashboard/whatsapp-integrations.controller.ts` (`dashboard/integrations/whatsapp`) | Live credentials/config/reset/unlink endpoints. |
| `REMOVE_RUNTIME` | `apps/backend/src/api/public/whatsapp-webhook.controller.ts` (`public/whatsapp/webhook`) | Public Evolution webhook and inbound queue handoff. |
| `REMOVE_RUNTIME` | `apps/backend/src/modules/integrations/whatsapp/sync-whatsapp-config-on-startup.service.ts` | Startup synchronization side effect. |
| `REMOVE_RUNTIME` | `apps/backend/src/infrastructure/whatsapp/whatsapp-inbound-queue.service.ts` and `apps/backend/src/modules/whatsapp-agent/inbound/whatsapp-inbound.worker.ts` | Inbound queue/worker path. Verify BullMQ registration through `MessagingModule` before Task 2. |
| `REMOVE_RUNTIME` | `apps/backend/src/modules/ops/cron-tasks/data-retention.cron.ts`: `WhatsappMessage`/`WhatsappConversation` retention jobs | Preserve historical tables; remove only WhatsApp runtime deletion job in a later bounded task after retention decision. |
| `DELETE_DEAD_CODE` | `apps/backend/src/modules/whatsapp-agent/**` | Agent LLM, orchestration, booking tools, specialist registry, runtime controls, conversation handlers. Delete only after no imports remain. |
| `DELETE_DEAD_CODE` | `apps/backend/src/infrastructure/whatsapp/**` | Evolution client, credentials, transport, verifier, inbound queue infrastructure. |
| `DELETE_DEAD_CODE` | WhatsApp dashboard controllers and integration handlers under `apps/backend/src/api/dashboard/` and `apps/backend/src/modules/integrations/whatsapp/` | Delete after Task 2 and OpenAPI regeneration prove no consumer remains. |
| `PRESERVE_HISTORY` | `apps/backend/src/api/public/whatsapp-webhook.controller.spec.ts` and all WhatsApp specs | Test fixtures document retired contracts; delete or relocate only after runtime cleanup and focused regression review. |

## Configuration, deployment, and CI

| Classification | Exact path / symbol | Dependency and next action |
| --- | --- | --- |
| `REMOVE_RUNTIME` | `apps/backend/src/config/env.validation.ts`: `WHATSAPP_PROVIDER_ENCRYPTION_KEY`, `WHATSAPP_EVOLUTION_*`, `WHATSAPP_SESSION_DIR`, `WHATSAPP_AI_*`, `WHATSAPP_MAX_*`, and partial-config validation | Remove validation only after all runtime consumers are unregistered. Do not copy secrets. |
| `REMOVE_RUNTIME` | `.env.example`, `apps/backend/.env.example`, `apps/backend/.env.prod.example`, `docker/.env.example`, `docker/.env.prod.example` | Remove all `WHATSAPP_*` examples and `RETENTION_WHATSAPP_DAYS` after runtime/retention removal; no secrets are migrated into the new provider config. |
| `REMOVE_RUNTIME` | `docker/docker-compose.yml`, `docker/docker-compose.prod.yml` | Remove backend `WHATSAPP_*` environment injection and comments after module unregister. |
| `REMOVE_RUNTIME` | `.github/workflows/ci.yml` (lines 107, 132, 169, 351) and other workflow env fixtures | Remove deterministic `WHATSAPP_PROVIDER_ENCRYPTION_KEY` and any remaining WhatsApp CI fixtures after env validation cleanup. |
| `REMOVE_RUNTIME` | `.github/workflows/ci.yml`, `.github/workflows/merge-gate.yml`, `.github/workflows/nightly-e2e.yml`, `.github/workflows/regression-check.yml` | CI fixtures/env references must be removed after validation cleanup. |
| `DELETE_DEAD_CODE` | `apps/backend/src/modules/whatsapp-agent/agent/agent-llm.service.ts` | Explicit release blocker: it still has the legacy WhatsApp `AgentLlmService` env/config fallback boundary. It must not be reused by Sawaa Ai; delete only after imports are gone. |

## Dashboard and website surfaces

| Classification | Exact path / symbol | Dependency and next action |
| --- | --- | --- |
| `DELETE_DEAD_CODE` | `apps/dashboard/app/(dashboard)/whatsapp/page.tsx` | Direct visible WhatsApp route. Remove after no navigation/import remains. |
| `DELETE_DEAD_CODE` | `apps/dashboard/components/features/whatsapp/**` | WhatsApp settings, QR, connection, status, and inbox components. |
| `DELETE_DEAD_CODE` | `apps/dashboard/hooks/use-whatsapp.ts`, `use-whatsapp-mutations.ts`, `apps/dashboard/lib/api/whatsapp.ts`, `apps/dashboard/lib/types/whatsapp.ts` | Legacy dashboard API/client graph. |
| `DELETE_DEAD_CODE` | `apps/dashboard/lib/translations/ar.whatsapp.ts`, `en.whatsapp.ts` | Legacy visible copy; remove only after imports are absent. |
| `REMOVE_RUNTIME` | `apps/dashboard/lib/translations.ts:8,13,19,20` imports/spreads `enWhatsapp`/`arWhatsapp` | Remove the legacy translation assembly mount after all UI references are gone; the translation files then become `DELETE_DEAD_CODE`. |
| `REMOVE_RUNTIME` | `apps/dashboard/lib/translations/ar.nav.ts`, `en.nav.ts`: `nav.whatsapp`; `apps/dashboard/components/features/breadcrumbs.tsx`: `whatsapp` mapping | Visible navigation/breadcrumb mapping. Remove in Task 3. |
| `REMOVE_RUNTIME` | `apps/dashboard/lib/types/api.generated.ts`: generated `/dashboard/whatsapp`, `/dashboard/integrations/whatsapp`, and `/public/whatsapp` paths, operations, schemas, and `WhatsappConversation` permission subject | Do not hand-edit generated output. Regenerate from OpenAPI after backend unregister; current residue is a guard RED and release blocker. |
| `PRESERVE_HISTORY` | `apps/dashboard/eslint.config.mjs`: `whatsapp` naming allowance | Tooling-only residue; remove or narrow after deleted files are proven absent. |
| `PRESERVE_HISTORY` | `apps/website/features/chat/**` and `sawaa-ai-icon.tsx` | Current web chat is the replacement surface; no active WhatsApp mount found in source inventory. Keep generic chat and AI icon. |

## Mobile

| Classification | Exact path / symbol | Dependency and next action |
| --- | --- | --- |
| `REMOVE_RUNTIME` | `apps/mobile/app/(client)/(tabs)/chat.tsx`: `openWhatsapp`, `wa.me` | Mobile client still visibly opens WhatsApp; replace/disable in the mobile cleanup boundary if mobile is in release scope. |
| `DELETE_DEAD_CODE` | `apps/mobile/i18n/ar.json`, `apps/mobile/i18n/en.json`: `whatsapp` copy | Remove only with the mobile replacement decision and focused mobile tests. |
| `PRESERVE_HISTORY` | `apps/mobile/app/(client)/chat.tsx`, generic chat components/types | Inspect separately; keep if it is not an active WhatsApp mount. |

## Schema, source history, and data

| Classification | Exact path / symbol | Rule |
| --- | --- | --- |
| `PRESERVE_HISTORY` | `apps/backend/prisma/schema/comms.prisma`: `WhatsappProvider`, `WhatsappConversationStatus`, `WhatsappMessageRole`, `WhatsappDeliveryStatus`, `WhatsappAgentConfig`, `WhatsappConversation`, `WhatsappMessage` | Do not edit/delete in Tasks 1–4. |
| `PRESERVE_HISTORY` | `apps/backend/prisma/schema/people.prisma` and `bookings.prisma`: `ClientSource.WHATSAPP`, `BookingSource.WHATSAPP` | Historical client/booking source values remain queryable. |
| `PRESERVE_HISTORY` | All `apps/backend/prisma/migrations/*whatsapp*` and `20260813000000_unified_web_chat` | Migrations immutable; no drop or rewrite in this cleanup. |
| `PRESERVE_HISTORY` | `apps/backend/src/modules/ops/cron-tasks/data-retention.cron.ts` WhatsApp tables and any existing records | No deletion/count assumptions are made by Task 1; production counts require a separate read-only operational gate. |
| `PRESERVE_HISTORY` | `apps/backend/src/modules/whatsapp-agent/**` references to `source: 'WHATSAPP'` in booking/client logic | Historical provenance must not be remapped or removed blindly. |
| `REMOVE_RUNTIME` | `apps/backend/src/modules/ops/cron-tasks/data-retention.cron.ts`: `whatsappMessage.deleteMany` and `whatsappConversation.deleteMany` jobs | The new goal preserves historical WhatsApp records; stop future automatic deletion in the runtime cleanup task. Keep schema, existing rows, and migrations. |
| `DELETE_DEAD_CODE` | `apps/backend/src/modules/identity/casl/built-in-rules.ts`: `WhatsappConversation` grants | Authorization residue for the retired controller. Remove only after controller/module removal and a focused CASL regression proving unrelated roles/subjects remain unchanged; explicit handoff to the dead-code task. |

## Guard and current RED evidence

## Task 3 implementation evidence

The visible dashboard WhatsApp surface is now removed: the `/whatsapp` route
mount and its two locale translation modules were deleted, translation assembly
no longer spreads WhatsApp keys, and the dashboard nav/breadcrumb mapping no
longer exposes a WhatsApp label. The existing generic `/conversations` route
and `sawaa-ai` settings tab were preserved. A legacy
`/settings?tab=whatsapp` query is treated as an unknown tab by the existing
settings resolver and falls back to the general settings tab (then removes the
query string).

Focused evidence:

```text
dashboard Vitest (cleanup + sidebar + breadcrumbs): 4 files, 17 tests passed
dashboard i18n parity: OK
dashboard typecheck: passed
dashboard focused ESLint: passed
```

The runtime-disabled guard remained RED after the dashboard portion with 140
findings, mostly backend registrations and the still-pending legacy dashboard
API/component graph, plus the mobile provider surface. The mobile portion below
removes its visible findings; backend and legacy dashboard findings remain for
Tasks 2 and 4 rather than silently deleting historical contracts here.

Mobile Task 3 completion:

- Removed the `chat` trigger from the client native tab bar.
- Removed the mobile WhatsApp provider copy from both locale dictionaries.
- Replaced the old tab screen with a provider-free redirect to the Home tab so
  existing deep links do not expose a dead or external-provider surface.
- Added `apps/mobile/__tests__/messaging-surface-cleanup.test.ts` as a focused
  static contract test.

Mobile verification is environment-blocked in this worktree: `pnpm --dir
apps/mobile typecheck` reports missing Expo/React Native packages and the
mobile Jest command reports `Preset jest-expo not found`. The website test
command completed with 79 files and 662 tests passing. After mobile cleanup,
the runtime-disabled guard is RED with 131 findings and no `apps/mobile`
findings; remaining findings are backend/legacy dashboard cleanup scope.

Run from the repository root:

```bash
node scripts/check-whatsapp-runtime-disabled.mjs
```

Expected current result: **RED** (currently 193 findings). The current tree still has the root
`WhatsappModule` registration, WhatsApp controllers/webhook and infrastructure
imports, legacy WhatsApp env validation, dashboard route/components/nav
references, and the mobile WhatsApp mount/copy. This is intentional evidence for
Task 2/3; Task 1 does not repair those findings.

The guard explicitly allows Prisma schema/migrations, tests, documentation,
and this inventory because those are preserved history or verification
artifacts rather than active product mounts.

## Task 4 completion evidence

The dead WhatsApp executable graph was removed after the Task 2 unregister and
Task 3 surface removal. Deleted backend code includes the complete
`modules/whatsapp-agent/` graph, `infrastructure/whatsapp/` transport/config/
queue graph, the retired WhatsApp integration module/handlers, and the three
retired WhatsApp API controllers. Deleted dashboard code includes the
`components/features/whatsapp/` graph, legacy hooks/API/types, and the route
and locale modules already removed by Task 3.

The proof was an import/module-graph search followed by backend and dashboard
TypeScript compilation. The only remaining guard findings are generated
dashboard OpenAPI/type-contract residue (34 findings); those are intentionally
not hand-edited and are owned by Task 5 OpenAPI regeneration. No Prisma schema,
WhatsApp enum/model, migration, historical source value, or database record was
deleted. `BookingSource.WHATSAPP` and `ClientSource.WHATSAPP` remain intact.

The built-in CASL grants for the retired `WhatsappConversation` subject were
removed, with a focused CASL regression proving an ADMIN fallback no longer
receives that grant. Generic `Conversation` authorization is unchanged.

Verification:

```text
backend typecheck: passed
dashboard typecheck: passed
CASL focused Jest: 1 suite, 25 tests passed
git diff --check: passed
runtime-disabled guard: RED only on generated OpenAPI/type-contract residue
```

Deleted files remain recoverable in the uncommitted Git working tree; no commit,
push, migration, or production-data deletion was performed.

### Deleted legacy test contracts

The following 19 `.spec.ts` files were reclassified as
`DELETE_DEAD_CODE`: each imported a deleted WhatsApp controller, handler,
Evolution client, queue, verifier, or agent service, and a repository-wide
consumer search found no preserved schema/history assertion or shared runtime
consumer. Keeping them would leave orphan imports and break Jest discovery:

```text
apps/backend/src/api/public/whatsapp-webhook.controller.spec.ts
apps/backend/src/infrastructure/whatsapp/evolution-api.client.spec.ts
apps/backend/src/infrastructure/whatsapp/evolution-url.validator.spec.ts
apps/backend/src/infrastructure/whatsapp/whatsapp-credentials.service.spec.ts
apps/backend/src/infrastructure/whatsapp/whatsapp-evolution-config.service.spec.ts
apps/backend/src/infrastructure/whatsapp/whatsapp-inbound-queue.service.spec.ts
apps/backend/src/infrastructure/whatsapp/whatsapp-transport.service.spec.ts
apps/backend/src/modules/integrations/whatsapp/unlink-whatsapp.handler.spec.ts
apps/backend/src/modules/integrations/whatsapp/upsert-whatsapp-config.handler.spec.ts
apps/backend/src/modules/integrations/whatsapp/webhook/whatsapp-webhook-verifier.spec.ts
apps/backend/src/modules/whatsapp-agent/agent/agent-booking-flow.spec.ts
apps/backend/src/modules/whatsapp-agent/agent/agent-orchestrator.service.spec.ts
apps/backend/src/modules/whatsapp-agent/agent/booking-tools.service.spec.ts
apps/backend/src/modules/whatsapp-agent/agent/specialist-registry.service.spec.ts
apps/backend/src/modules/whatsapp-agent/conversations/list-whatsapp-conversations.handler.spec.ts
apps/backend/src/modules/whatsapp-agent/conversations/staff-reply.handler.spec.ts
apps/backend/src/modules/whatsapp-agent/inbound/whatsapp-inbound.worker.spec.ts
apps/backend/src/modules/whatsapp-agent/runtime/control-whatsapp.handler.spec.ts
apps/backend/src/modules/whatsapp-agent/runtime/get-whatsapp-qr.handler.spec.ts
```

Preserved history is limited to Prisma schema/models/enums, immutable
migrations, historical source values, and the generic communications/chat
tests. No test covering those preserved contracts was deleted.

The full backend Jest discovery completed without orphan WhatsApp imports:
782 suites ran, 780 passed, one was skipped, and two unrelated pre-existing
failures remain in `booking-scenarios.spec.ts` (Zoom reschedule fixture) and
`payment-mutations.handler.spec.ts` (missing `refundRequest` mock method).

The CommsModule test fixture now supplies only a local all-zero 44-character
base64 `AI_PROVIDER_ENCRYPTION_KEY`; it is test-only and is never logged or
used as a production secret. Four module compile suites passed without shell
environment injection, and the dashboard lint passed with existing warnings
only.

## Reuse vs duplicate surface

The replacement must reuse the unified `ChatConversation`/
`CommsChatMessage` history, website `ai-chat-widget`, dashboard
`/conversations` inbox, `AiProviderConfig`, provider client/credentials, and
knowledge-base services. It must not import the legacy WhatsApp agent,
Evolution transport, WhatsApp credentials, or WhatsApp-specific Prisma models.
The old WhatsApp graph is a separate transport and storage path, so keeping it
registered would create duplicate customer conversations and competing booking
tools.

## Deletion order and release blockers

1. Task 2 unregisters backend module/controllers/webhook/worker/env injection.
2. Task 3 removes dashboard/mobile visible mounts and navigation.
3. Task 4 deletes only dead code confirmed by import/module-graph checks.
4. Task 5 runs OpenAPI, focused tests, browser checks, and provider-readiness.

Release blockers are any RED guard finding, a remaining
`AgentLlmService`/legacy env fallback, a live WhatsApp controller/webhook or
worker registration, a visible WhatsApp navigation entry, an unverified
provider config, or any attempt to delete historical schema/data without a
separate backup/count/approval gate.

## Task 5 assembled verification — 2026-08-14

The final assembled checkout was verified without repeating the prior feature
implementation. `pnpm openapi:sync` passed after restarting the local backend
from the current source, and `node scripts/check-whatsapp-runtime-disabled.mjs`
is GREEN. The regenerated contract has no WhatsApp paths, operation names,
schemas, or live permission subject; historical booking/client source values
remain preserved.

Local additive migrations applied successfully to `localhost:3453/sawaa_dev`
(seven migrations plus vector hooks). Focused backend Jest passed 11 suites /
196 tests; website Vitest 2 files / 21 tests; dashboard Vitest 4 files / 41
tests; API-client Vitest 9 files / 118 tests. Backend, website, dashboard,
API-client, and shared typechecks plus Prisma validation passed.

Dashboard Playwright conversation smoke authentication passed for all seeded
roles; the conversation test was skipped because no waiting conversation was
seeded. Website and dashboard pages returned HTTP 200 locally (`:5205`,
`:5203/conversations`, `:5203/settings`). No real provider key or production
database was used. A real OpenAI/OpenRouter completion remains intentionally
unverified until an operator enters a valid key through the approved settings
surface. The repository-wide OpenAPI coverage check remains RED with 151
documentation gaps, including pre-existing gaps and missing examples on new
AI/chat DTO properties; this does not indicate a runtime or WhatsApp cleanup
failure.
