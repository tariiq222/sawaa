# Sawa Family Counseling — Monorepo

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
├── api-client/   hand-written typed API client (NOT generated — see packages/api-client/CLAUDE.md)
└── ui/           shadcn primitives for dashboard only today; website and mobile excluded
```

## Commands (run from repo root)

```bash
pnpm install
pnpm dev:backend          # backend only
pnpm dev:dashboard        # dashboard only
pnpm dev:website          # website only
pnpm dev:all              # backend + dashboard + website
pnpm build                # turbo build all three
pnpm typecheck            # turbo typecheck
pnpm lint                 # turbo lint
pnpm test                 # turbo test

pnpm docker:up            # local postgres + redis + minio
pnpm docker:down

pnpm db:migrate           # backend prisma migrate deploy
pnpm db:seed              # backend seed
pnpm db:reset             # migrate + seed

pnpm openapi:sync         # backend exports openapi.json + dashboard regenerates client

pnpm e2e:dashboard        # dashboard Playwright flows
```

### Running a single test

Backend uses Jest, dashboard + website use Vitest. Run from inside the app dir:

```bash
# backend (Jest)
pnpm --filter=backend test -- path/to/file.spec.ts          # one file
pnpm --filter=backend test -- -t "name of the test case"    # by name
pnpm --filter=backend run test:e2e                          # e2e suite
pnpm --filter=backend run test:smoke                        # smoke suite

# dashboard / website (Vitest)
pnpm --filter=dashboard test -- path/to/file.test.ts
pnpm --filter=dashboard test -- -t "name of the test case"

# dashboard e2e (Playwright) — needs `pnpm --filter=dashboard run e2e:install` once
pnpm --filter=dashboard run e2e:smoke
pnpm --filter=dashboard run e2e -- path/to/spec.ts
```

## Single-tenant

Sawa serves exactly one counseling center. There is no organization switching and no subscription billing, and Prisma queries carry no `organizationId` filters.

The mobile app's `memberships`/`tenant-switch` services and membership query hook were deleted in the single-tenant cleanup — do not reintroduce them. The only intentional leftovers are the terminology hooks: the dashboard's `useTerminology` (`hooks/use-terminology.ts`) resolves a small static label map locally with no backend call, and the mobile `useTerminology` (`hooks/useTerminology.ts`) targets a `/public/verticals/:slug/terminology` endpoint that no longer exists, so its `t()` always falls back to the provided label. Both are inert; do not wire them to new endpoints.

Provider credentials (Zoom, SMS, Email, Moyasar) are encrypted with AES-256-GCM using a static `DEFAULT_ORG_ID` constant as AAD — see [apps/backend/src/common/constants.ts](apps/backend/src/common/constants.ts).

Do not introduce new `platform*` / `organization*` / `tenant*` / `membership*` concepts in code, schema, or env var naming. Exception: the existing required `PLATFORM_SETTINGS_KEY` env var is legacy — do not rename it; the backend fails to boot without it in prod.

## Business rules (owner-confirmed invariants)

Each of these was violated and corrected in past sessions — treat as hard rules:

- **VAT:** the center is NOT VAT-registered. `DEFAULT_VAT_RATE = 0` ([create-invoice.handler.ts](apps/backend/src/modules/finance/create-invoice/create-invoice.handler.ts)). Never reintroduce 15% as a default, fallback, or API/Swagger example. VAT math stays supported (rate comes from `OrganizationSettings`); amount due after discount = `(subtotal − discount) × (1 + vatRate)`, never `total − discount`.
- **Money:** all amounts are stored as integer halalas.
- **Earnings / commission:** informational display numbers for the manager only — never implement real money distribution from them.
- **Guest bookings:** reception staff may register guests from the dashboard; the public website requires an account (no guest checkout).
- **Terminology:** client-facing UI says «موعد», not «حجز».
- **Copy:** customer-facing Arabic text is plain and unexaggerated — no marketing superlatives.
- **Branding:** single fixed brand (logo, font, colors) — never build configurable branding/theming. Image inputs are file uploads, not URL fields.

## Migrations are immutable

Never edit or squash an existing Prisma migration — add a new one. The backend has CI that fails on drift.

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

## Definition of done

Passing tests are necessary but not sufficient. A change is done only after the affected app is run locally and the flow is exercised live (UI clicked / endpoint hit / SMS actually received). If live verification was not performed, say so explicitly — never report "done" on green tests alone.

## Git & deploy rules

- Commit only when explicitly asked, and scope the commit to the current session's work.
- Before any deploy: merge `main` locally first (`git pull --ff-only`). Pushing `main` auto-deploys via Dokploy — a push to main IS a production deploy.
- After every merge/deploy, verify the backend actually booted: a missing required env var fails startup silently and Docker Swarm keeps serving the old version.

## Test matrix by change surface

| Surface | Command |
|---|---|
| Backend handler/DTO | `pnpm --filter=backend test -- path/to/file.spec.ts` |
| Backend full suite | `pnpm --filter=backend run test` + `pnpm --filter=backend run test:e2e` |
| OpenAPI snapshot | `pnpm openapi:sync` |
| Dashboard component/page | `pnpm --filter=dashboard test -- path/to/file.test.ts` |
| Dashboard e2e (single spec) | `pnpm --filter=dashboard run e2e -- path/to/spec.ts` |
| Dashboard e2e smoke | `pnpm --filter=dashboard run e2e:smoke` |
| Website component/page | `pnpm --filter=website test -- path/to/file.test.ts` |
| Mobile typecheck | `pnpm --dir apps/mobile typecheck` |
| Shared / Zod schemas | `pnpm typecheck` (root) |
| API client | `pnpm typecheck` (root) |
| UI package | `pnpm --filter=@sawaa/ui typecheck` |
| Playwright helpers | `pnpm --filter=@sawaa/test-helpers-pw typecheck` |
| Full turbo typecheck | `pnpm typecheck` |
| Full turbo build | `pnpm build` |
| Full turbo test | `pnpm test` |

## Workspace note: mobile

`apps/mobile` exists in the repo but is **not currently part of the root pnpm workspace commands** (`pnpm build`, `pnpm test`, and `pnpm dev:all` do not cover it). Always run mobile commands with `pnpm --dir apps/mobile <cmd>` or from inside `apps/mobile/`. Never use `pnpm --filter=mobile`.

## Per-app conventions

Each app has its own CLAUDE.md with stack-specific rules:
- [apps/backend/CLAUDE.md](apps/backend/CLAUDE.md) — domain clusters, handler pattern, prisma split-schema
- [apps/dashboard/CLAUDE.md](apps/dashboard/CLAUDE.md)
- [apps/mobile/CLAUDE.md](apps/mobile/CLAUDE.md)
- [packages/ui/CLAUDE.md](packages/ui/CLAUDE.md)
