# Sawa Backend — Conventions

This file provides guidance to Claude Code when working inside `apps/backend`. Read the root [CLAUDE.md](../../CLAUDE.md) first for stack-wide rules (immutable migrations, golden rules).

## Architecture: Domain Clusters + Vertical Slices

The backend is a **Modular Monolith** organized as **domain clusters**, each containing **vertical-slice features**. Controllers are **separated from domain code** and live under `src/api/` by audience.

```
src/
├── api/                      ← HTTP layer (thin controllers, audience-scoped)
│   ├── dashboard/            ← Admin controllers — one per cluster
│   ├── mobile/{client,employee}/
│   └── public/               ← Unauthenticated (webhooks, healthcheck)
├── modules/                  ← Domain code (clusters of vertical slices)
│   ├── ai/                   bookings/   comms/        content/
│   ├── dashboard/            finance/    identity/     integrations/
│   ├── media/                ops/        org-config/   org-experience/
│   ├── people/               platform/
├── infrastructure/           ← Shared tech: database, cache, queue, mail, storage, ai, events
├── common/                   ← Guards, filters, interceptors, pipes, base events
├── config/                   app.module.ts                main.ts
└── prisma/schema/            ← One .prisma file per cluster (immutable migrations)
```

### Domain clusters (authoritative — not the old "one module per domain")

| Cluster | Slices inside |
|---|---|
| `identity/` | login, logout, refresh-token, get-current-user, client-auth, otp, users, roles, casl |
| `people/` | clients, employees, specialties |
| `bookings/` | create-/cancel-/confirm-/check-in-/reschedule-/complete-/no-show-/expire-booking, check-availability, create-recurring-booking, waitlist, walk-in, create-zoom-meeting, retry-zoom-meeting |
| `finance/` | payments, moyasar-api, moyasar-webhook, refunds, coupons, bank-transfer-upload |
| `comms/` | notifications, fcm-tokens, email-templates, send-email, send-sms, send-push, org-sms-config, sms-dlr, contact-messages, chat |
| `ai/` | chatbot RAG (streaming), knowledge-base, pgvector embeddings, semantic-search |
| `media/` | uploads, MinIO presigned URLs |
| `ops/` | health-check, cron-tasks (BullMQ), generate-report, log-activity |
| `content/` | site-settings |
| `org-config/` | branches, categories, departments, business-hours |
| `org-experience/` | branding, intake-forms, ratings, services, org-settings |
| `integrations/` | zoom (encrypted creds get/upsert/test), public branding |
| `platform/` | problem-reports |
| `dashboard/` | get-dashboard-stats |

### Vertical slice anatomy

Each use case is a self-contained folder:

```
modules/bookings/create-booking/
├── create-booking.dto.ts          ← class-validator input shape
├── create-booking.handler.ts      ← @Injectable class with execute(command)
└── create-booking.handler.spec.ts ← colocated unit tests
```

- **Handler, not Service.** The pattern is `XxxHandler` with a single `execute()` method — one slice, one use case.
- **Command type** extends the DTO with decoded values (e.g., `scheduledAt: Date`) and caller identity (`userId`) where needed. Controllers convert DTO → Command.
- **Cross-slice calls:** handlers may inject other handlers directly (`GetBookingSettingsHandler`, `PriceResolverService`). Cross-**cluster** calls go through published handlers/services from that cluster's module exports.
- **Events live in `<cluster>/events/`** as typed event classes extending `BaseEvent` (see [src/common/events/base-event.ts](src/common/events/base-event.ts)). Handlers emit; cross-cluster reaction handlers (e.g., [payment-completed-handler](src/modules/bookings/payment-completed-handler/)) subscribe.
- **Shared helpers** inside a cluster sit at the cluster root (e.g., [booking-lifecycle.helper.ts](src/modules/bookings/booking-lifecycle.helper.ts)).
- **No generic `*.repository.ts`** — handlers use `PrismaService` directly from [infrastructure/database](src/infrastructure/database/).

### Controllers live in `src/api/`, not inside modules

Controllers are grouped **by audience** (`dashboard/`, `mobile/client/`, `mobile/employee/`, `public/`), one file per cluster (`bookings.controller.ts`, `finance.controller.ts`). They:

1. Apply guards (`JwtGuard`, `CaslGuard`) and extract `@UserId()` where needed.
2. Inject handlers from `src/modules/...` and call `handler.execute({ ...dto })`.
3. Do **no business logic** — if you're writing an `if` for domain rules in a controller, it belongs in a handler.

When adding an endpoint: add or extend the slice in `src/modules/<cluster>/<use-case>/`, then wire it in the matching `src/api/<audience>/<cluster>.controller.ts`.

### Infrastructure vs modules

`src/infrastructure/` holds technology adapters (Prisma, BullMQ queues, Redis cache, SMTP/mail, MinIO storage, embeddings). Domain modules depend on infrastructure, never the reverse. Don't put tech concerns (queue definitions, mail transports) inside a cluster.

### Prisma schema is split per cluster

[prisma/schema/](prisma/schema/) has one `.prisma` file per cluster (`bookings.prisma`, `finance.prisma`, etc.) plus `main.prisma` for generator/datasource. Keep model ownership aligned with cluster boundaries.

## Adding work — decision tree

1. **New endpoint on existing use case?** Edit the handler + wire the controller method.
2. **New use case in existing cluster?** Create `modules/<cluster>/<verb-noun>/` with dto + handler + spec, register in `<cluster>.module.ts`, expose through the audience controller.
3. **New domain?** Decide if it fits an existing cluster. Prefer extending a cluster over creating a new one. A new cluster needs: folder under `modules/`, its own `*.module.ts`, a `prisma/schema/<cluster>.prisma` if it owns tables, and at least one controller under `src/api/<audience>/`.
4. **Cross-cluster reaction?** Emit an event from the source cluster; add a handler folder in the consuming cluster (e.g., `payment-completed-handler/`).

## Commands (from `apps/backend/`)

```bash
npm run dev                          # Watch mode, :5100
npm run typecheck                    # tsc --noEmit
npm run test                         # Jest unit tests
npm run test:cov                     # Coverage (thresholds: 40% branch, 50% fn/line)
npm run test:e2e                     # E2E (test/jest-e2e.json)
npx jest path/to/file.spec.ts        # Single test file
npx jest -t "partial test name"      # By test name
npm run prisma:migrate               # Apply pending migrations (never `db push`)
npm run seed                         # Seed demo data
npm run prisma:studio                # GUI
npm run openapi:build-and-snapshot   # Rebuild openapi.json snapshot — commit alongside any endpoint change
```

## Comms cluster — SMS

- **SMS uses a single provider** (Unifonic or Taqnyat) configured via `/settings/sms`.
- Dispatch always goes through `SmsProviderFactory.forCurrentTenant(orgId)` — never construct an adapter manually from a handler.
- Credentials are AES-256-GCM encrypted with `SMS_PROVIDER_ENCRYPTION_KEY` and `DEFAULT_ORG_ID` as AAD (single-tenant) — a DB dump alone cannot decrypt without the encryption key.
- DLR webhooks (`POST /api/v1/public/sms/webhooks/:provider`) follow the three-stage flow: config lookup → signature verify → mutation.
- The `GetOrgSmsConfigHandler` NEVER returns `credentialsCiphertext` or `webhookSecret` — the dashboard form is write-only.

## AI cluster (`src/modules/ai/`)

- **ChatAdapter uses OpenRouter** (OpenAI-compatible), not Anthropic SDK directly. Models are configured via `OPENROUTER_CHAT_MODEL` (default: `anthropic/claude-3.5-haiku`).
- **Prompt structure in `chat-completion.handler.ts`:** system + KB context first, user message last — this is the correct ordering for any cache-friendly model. Do not rearrange.
- **To enable Anthropic native prompt caching** (cache_control breakpoints, ~10× cheaper reads): requires switching ChatAdapter from OpenRouter to `@anthropic-ai/sdk` directly. This is an intentional future decision, not an oversight.
- **Semantic search** (`semantic-search.handler.ts`) uses `pgvector` via `PrismaService.$queryRaw`. Always pass `topK` to limit chunks; default is 5.


## Platform transactional emails (`infrastructure/mail/PlatformMailerService`)

- **Resend SDK** sends transactional emails (OTP login currently the only template).
- Configured via `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` in `.env`. Missing key in dev = warn + skip; in production throws on startup.
- Templates live under `infrastructure/mail/templates/` — one file per email type, each exporting a typed `Vars` interface and a builder function returning `{ subjectAr, subjectEn, html }`.
- All templates are bilingual AR+EN via `bilingualLayout()` in `templates/shared.ts`. Use `escapeHtml()` for any user-supplied string interpolated into HTML — it is the single XSS guard.

## Integrations cluster (`modules/integrations/`)

- **Zoom** (`integrations/zoom/`) owns the encrypted-credentials lifecycle: get/upsert/test of `accountId`, `clientId`, `clientSecret`. Credentials are AES-256-GCM encrypted with `DEFAULT_ORG_ID` as AAD (single-tenant) — the `Get*` handler never returns ciphertext.
- The bookings cluster (`bookings/create-zoom-meeting/`, `bookings/retry-zoom-meeting/`) **consumes** integrations via `ZoomMeetingService`. Never reach into Zoom credentials from a booking handler — go through the integrations slice.
- Public branding read endpoints also live here (used by unauthenticated mobile/website surfaces).

## Conventions that catch new contributors

- **Single-tenant deployment.** Sawa runs as a single-tenant deployment. The old multi-tenant CLS guard, SCOPED_MODELS list, `$allTenants` bypass, and tenant context service were removed in the SaaS cleanup phase. Handlers no longer carry an `organizationId` filter. Encryption AAD for provider credentials uses a static `DEFAULT_ORG_ID` constant (`apps/backend/src/common/constants.ts`).
- **One handler = one public method (`execute`).** Don't add `executeVariant()`; create a new slice.
- **Tests colocated as `*.handler.spec.ts`** next to the handler, not in a parallel `test/` tree.
- **Payments, auth, and migrations are owner-only** (see root CLAUDE.md "Security Sensitivity Tiers").
- **Migrations are immutable** — never edit or squash existing ones; add a new migration instead.

## Client Auth (Phase 3 — separate token namespace)

Client auth (website users) is **fully isolated** from admin JWT auth:

| | Admin/Dashboard JWT | Client JWT |
|---|---|---|
| Namespace claim | `role`, `permissions` | `client` namespace via `aud` or custom claim |
| Secret | `JWT_ACCESS_SECRET` | `JWT_CLIENT_ACCESS_SECRET` |
| Guard | `JwtGuard` + `CaslGuard` | `ClientSessionGuard` |
| Token delivery | `Authorization: Bearer` | `httpOnly cookie` (XSS-safe) |
| Stored in | Memory/API calls | Browser cookie jar |

**Password policy:** minimum 8 chars, at least 1 uppercase letter, at least 1 digit.

**Login modes:**
- **Password login** — primary path. Client submits phone + password → `POST /api/v1/public/auth/login`.
- **OTP-only login** — escape hatch for clients who forgot password. Uses existing `CLIENT_LOGIN` purpose via `POST /api/v1/public/otp/request` + `verify`. No password required.


## API Documentation (Standard level)

Every HTTP endpoint in `src/api/**` MUST have:

- `@ApiTags('<Audience> / <Cluster>')` on the controller — tag list is closed, see [spec](../../docs/superpowers/specs/2026-04-17-api-documentation-design.md#audience--cluster-tag-map).
- `@ApiOperation({ summary })` — English, imperative ("Create a booking").
- `@ApiStandardResponses()` from `src/common/swagger` plus endpoint-specific success/404 responses.
- `@ApiParam`/`@ApiQuery` on every route/query parameter.

Every DTO used as `@Body` or `@Query`:
- `@ApiProperty({ description, example })` on required fields.
- `@ApiPropertyOptional({ description, example })` on optional fields.

Regenerate the OpenAPI snapshot after any change:

    npm run openapi:build-and-snapshot

Commit `apps/backend/openapi.json` alongside the endpoint change — CI fails if the snapshot drifts from source.
