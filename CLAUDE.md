# Sawa Family Counseling — Monorepo

Single-tenant family counseling SaaS forked from a multi-tenant base.

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
└── ui/           shadcn primitives for dashboard + website (NOT mobile)
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

Sawa is a single-tenant deployment. The multi-tenant scaffolding from the original SaaS fork (TenantModule, CLS guard, scoped models, `$allTenants` bypass, subscription billing, verticals, memberships) has been fully removed. The codebase no longer carries `organizationId` filters in Prisma queries.

Some multi-tenant stubs intentionally survive in the frontend as dead code: the dashboard's `useTerminology` hook (`hooks/use-terminology.ts`) and the mobile app's `memberships`/`tenant-switch` services. They are inert — the backend endpoints they target do not exist, the membership query is `enabled: false`, and `switchOrganization()` throws by design. Do not wire them up; treat them as removed.

Provider credentials (Zoom, SMS, Email, Moyasar) are encrypted with AES-256-GCM using a static `DEFAULT_ORG_ID` constant as AAD — see [apps/backend/src/common/constants.ts](apps/backend/src/common/constants.ts).

## Migrations are immutable

Never edit or squash an existing Prisma migration — add a new one. The backend has CI that fails on drift.

## OpenAPI snapshot is committed

`apps/backend/openapi.json` is checked in. Run `pnpm openapi:sync` after any endpoint change and commit the regenerated snapshot + the dashboard client.

## Package name quirk

The shared UI package is published as `@sawaa/ui` and the website as `@sawaa/website` — these npm scopes are inherited from the fork and are NOT renamed. Don't "fix" them.

## Environment

Copy `.env.example` → `.env` at the repo root. Each app has its own `.env.example` for app-scoped vars. Required infra: Postgres 16, Redis 7, MinIO. Start them with `pnpm docker:up`.

## Per-app conventions

Each app has its own CLAUDE.md with stack-specific rules:
- [apps/backend/CLAUDE.md](apps/backend/CLAUDE.md) — domain clusters, handler pattern, prisma split-schema
- [apps/dashboard/CLAUDE.md](apps/dashboard/CLAUDE.md)
- [apps/mobile/CLAUDE.md](apps/mobile/CLAUDE.md)
- [packages/ui/CLAUDE.md](packages/ui/CLAUDE.md)
