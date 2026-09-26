# Sawa Family Counseling — Monorepo

## Mandatory deployment policy for all AI tools

Read and follow [the approved deployment policy](docs/operations/deployment-policy.md) before any commit, push, merge or deployment. «انشر» / «ننشر» means **develop + staging only**, followed by the owner's manual test. Only an explicit «انشر للإنتاج» / «انشر للبرودكشن» authorizes **develop → main → production**, after verifying the manually accepted release content and required checks. This policy supersedes older deployment guidance.


Single-tenant family counseling platform for one counseling center (مركز سواء).

## Stack

pnpm workspaces + Turborepo. Node ≥ 20.

```
apps/
├── backend/      NestJS 11, Prisma 7, Postgres, Redis, MinIO, BullMQ — port 5200
├── dashboard/    Next.js 15 (App Router), React 19, TanStack Query — port 5203
├── website/      Next.js 15 public site — port 5205
└── mobile/       Expo SDK 55, RN 0.83, Expo Router

packages/
├── shared/       cross-app types + zod schemas
├── api-client/   hand-written typed API client (NOT generated — see packages/api-client/AGENTS.md)
└── ui/           shadcn primitives for dashboard only today; website and mobile excluded
```

## Commands and focused tests

Common checks: backend `pnpm --filter=backend test -- path/to/file.spec.ts`; dashboard or website `pnpm --filter=<app> test -- path/to/file.test.ts`; dashboard smoke `pnpm --filter=dashboard run e2e:smoke`; mobile types `pnpm --dir apps/mobile typecheck`. For other commands and test coverage, read [the command and test reference](docs/operations/agent-command-reference.md). Root commands do not cover mobile.

## Single-tenant

Sawa serves exactly one counseling center. There is no organization switching and no subscription billing, and Prisma queries carry no `organizationId` filters.

**Dead scaffolding status (verified 2026-09-21):**

| File | Status | Action |
|------|--------|--------|
| `apps/dashboard/hooks/use-terminology.ts` | **Deleted** | None — already removed. Do not reintroduce. |
| `apps/mobile/hooks/useTerminology.ts` | **Deleted** | None — already removed. Do not reintroduce. |
| `apps/mobile/hooks/useTerminology.test.ts` | **Deleted** | None — already removed. Do not reintroduce. |
| `apps/mobile/services/organization.ts` | **Deleted** | None — already removed. Do not reintroduce. |
| `apps/mobile/components/features/settings/OrganizationSwitcherSection.tsx` | **Deleted** | None — already removed. Do not reintroduce. |

The backend exposes no `/public/verticals/:slug/terminology` endpoint and no `/auth/memberships` endpoint. Do not wire any of the above back up, and do not add new terminology or organization-switching surfaces. See [apps/dashboard/CLAUDE.md](apps/dashboard/CLAUDE.md) and [apps/mobile/CLAUDE.md](apps/mobile/CLAUDE.md) for per-app details.

Provider credentials (Zoom, SMS, Email, Moyasar) are encrypted with AES-256-GCM using a static `DEFAULT_ORG_ID` constant as AAD — see [apps/backend/src/common/constants.ts](apps/backend/src/common/constants.ts).

## Operational safety rules (verified 2026-09-21)

These protect encrypted data and live operations. Breaking one is a data-loss or production incident, not a lint error.

- **Never change `DEFAULT_ORG_ID` or the encryption AAD.** Zoom / SMS / Email / Moyasar / AI provider credentials are AES-256-GCM encrypted with `DEFAULT_ORG_ID` as AAD (`apps/backend/src/common/constants.ts`); any other value silently makes every stored credential undecryptable.
- **Never rename `PLATFORM_SETTINGS_KEY`.** Production boot fails without it and existing platform-settings ciphertext stays bound to that key.
- **Never drop `organizationId` from money, booking, or comms events** before the staff guards in `apps/backend/src/modules/comms/events/` (`on-payment-completed-staff`, `on-booking-cancelled-staff`, `on-client-enrolled-staff`) stop reading it — removing it silently kills staff notifications.
- **Do not refactor `moyasar-webhook`, `refund-payment`, or `create-booking` for cleanliness** without owner approval, tests, and a Moyasar sandbox run.
- **Never run `apps/backend/scripts/billing/*` against a live database.**
- **Never reintroduce `FeatureKey`, subscription plans, tenant switching, memberships, or `useTerminology`.** They were deleted in the single-tenant cleanup; only built `packages/shared/dist` artifacts still mention feature keys.
- **Never move `DEFAULT_VAT_RATE` off `0`** (`apps/backend/src/modules/finance/create-invoice/create-invoice.handler.ts`) and never hardcode a rate such as 15% in copy, Swagger, or fallbacks.
- **SMS dispatch goes through `SmsProviderFactory.resolve()`** with no tenant argument. Do not reintroduce `forCurrentTenant(orgId)`.
- **Prisma queries carry no `organizationId` filter.** `DEFAULT_ORG_ID` exists for encryption AAD and the fixed single-tenant context only.
- **Root commands do not cover mobile** — run mobile as `pnpm --dir apps/mobile ...`.

## Migrations are immutable

Never edit or squash an existing Prisma migration — add a new one. The backend has CI that fails on drift. The full authoring/deployment protocol (additive-only rules, hot-table locking discipline, owner-confirmation tier) lives in [the Prisma migration charter](docs/operations/migration-charter.md).

## OpenAPI snapshot is committed

`apps/backend/openapi.json` is checked in. Run `pnpm openapi:sync` after any endpoint change and commit the regenerated snapshot + the dashboard client.

## Package name quirk

The shared UI package is published as `@sawaa/ui` and the website as `@sawaa/website` — these npm scopes are inherited from the fork and are NOT renamed. Don't "fix" them.

## Environment

Copy `.env.example` → `.env` at the repo root. Each app has its own `.env.example` for app-scoped vars. Required infra: Postgres 16, Redis 7, MinIO. Start them with `pnpm docker:up`.

## Security Sensitivity Tiers

| Tier | Area | Rule |
|---|---|---|
| Critical | Auth / Authorization | Owner-only. Never change guard logic, token semantics, CASL policies, role permissions, or secret defaults without explicit approval. |
| Critical | Payments / Moyasar | Owner-only. Any change requires dashboard smoke coverage and Moyasar sandbox verification. |
| High | Provider credentials / encryption | Read-only for agents unless explicitly scoped. Do not rotate keys, change AAD constants, or rewire encryption flows without approval. |
| High | Migrations / destructive DB operations | Migrations are additive-only. Never edit or squash existing migrations. Any destructive DB delete/drop/truncate requires explicit confirmation. |
| Medium | OpenAPI / API contract snapshot | `apps/backend/openapi.json` must be regenerated via `pnpm openapi:sync` and committed with every endpoint change. |
| Medium | Dashboard smoke tests | Run after any backend or dashboard change that could break dashboard flows. |

## AI workflow / API change checklist

When changing backend endpoints or DTOs:

1. Update backend source (controller, handler, DTO).
2. Run the relevant backend tests.
3. Run `pnpm openapi:sync` to export `apps/backend/openapi.json` and regenerate dashboard types.
4. Update `packages/api-client` manually if it references the changed endpoint or shape; it is hand-written, not generated.
5. Commit `apps/backend/openapi.json`, regenerated dashboard types, and API client changes together.
6. Run dashboard smoke tests when dashboard consumes the endpoint.

## Workspace note: mobile

`apps/mobile` exists in the repo but is **not currently part of the root pnpm workspace commands** (`pnpm build`, `pnpm test`, and `pnpm dev:all` do not cover it). Always run mobile commands with `pnpm --dir apps/mobile <cmd>` or from inside `apps/mobile/`. Never use `pnpm --filter=mobile`.

## Per-app conventions

Read the affected app or package `CLAUDE.md` before changing it; links are in [the command and test reference](docs/operations/agent-command-reference.md).
