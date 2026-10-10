# CODEMAP — Sawa Monorepo

## Apps & Packages — Ownership & Boundaries

| Path | Type | Stack | Port | What it owns | What it does NOT own |
|---|---|---|---|---|---|
| `apps/backend/` | App | NestJS 11, Prisma 7, Postgres, Redis, MinIO, BullMQ | 5200 | All business logic, data persistence, auth, payments, integrations, OpenAPI spec | UI components, page routing, browser storage |
| `apps/dashboard/` | App | Next.js 15 (App Router), React 19, TanStack Query | 5203 | Admin UI, pages, forms, data fetching from backend, e2e specs | Business rules, direct DB access, payment webhook handling |
| `apps/website/` | App | Next.js 15 public site | 5205 | Public marketing pages, contact forms, client-facing surfaces | Admin features, auth guards, dashboard data |
| `apps/mobile/` | App | Expo SDK 55, RN 0.83, Expo Router | — | Native mobile UI for clients | Not included in root pnpm workspace; run via `pnpm --dir apps/mobile <cmd>` |
| `packages/shared/` | Package | TypeScript, Zod | — | Cross-app types, Zod schemas, validation rules | App-specific logic, UI components |
| `packages/api-client/` | Package | TypeScript (hand-written) | — | Typed API client used by dashboard/website/mobile | Not auto-generated; must be updated manually when OpenAPI changes |
| `packages/ui/` | Package | shadcn/ui, React | — | Shared UI primitives for dashboard only today | Website and mobile component systems |
| `packages/test-helpers-pw/` | Package | Playwright helpers | — | Shared Playwright setup/teardown and cross-cutting e2e helpers | App-specific assertions, secrets, browser credentials |

## "Where to Change X" Decision Paths

| Change goal | Where to go |
|---|---|
| Add/change an API endpoint | `apps/backend/src/modules/<cluster>/<use-case>/` + `apps/backend/src/api/<audience>/<cluster>.controller.ts` |
| Change a database model | `apps/backend/prisma/schema/<cluster>.prisma` + create new migration (never edit old ones) |
| Change a shared data shape | `packages/shared/src/` (type + Zod schema) |
| Change a dashboard page | `apps/dashboard/app/` or `apps/dashboard/components/` |
| Change a website page | `apps/website/app/`, `apps/website/features/`, or `apps/website/themes/` |
| Change a shared UI primitive | `packages/ui/src/primitives/` |
| Change how dashboard calls an API | `packages/api-client/src/` (hand-written client) |
| Change e2e test helpers | `packages/test-helpers-pw/src/` |
| Change e2e test specs | Keep inside the consuming app (`apps/dashboard/e2e/` or `apps/website/e2e/`) |
| Change payment/Moyasar logic | `apps/backend/src/modules/finance/` — **owner-only** |
| Change auth/guard logic | `apps/backend/src/common/guards/`, `apps/backend/src/modules/identity/` — **owner-only** |
| Change provider credential encryption | `apps/backend/src/common/constants.ts` — **read-only for agents** |

## API / Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Dashboard  │────▶│ api-client  │────▶│   Backend   │
│  (Next.js)  │◄────│ (hand-typed)│◄────│  (NestJS)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
┌─────────────┐     ┌─────────────┐           │
│   Website   │────▶│ api-client  │───────────┘
│  (Next.js)  │◄────│ (hand-typed)│
└─────────────┘     └─────────────┘

┌─────────────┐
│   Mobile    │────▶ Backend (direct fetch or api-client)
│  (Expo/RN)  │
└─────────────┘
```

- **Backend** generates OpenAPI spec → `apps/backend/openapi.json` (committed snapshot).
- **Dashboard** consumes the OpenAPI snapshot to regenerate TypeScript types.
- **api-client** is hand-written and must be kept in sync manually when endpoints change.
- **shared** types/schemas flow downstream to all apps.
- **test-helpers-pw** flows to e2e suites in dashboard/website.

## Sensitive Areas — Owner-Only or Read-Only

| Area | Paths | Agent Rule |
|---|---|---|
| Auth / Authorization | `apps/backend/src/common/guards/`, `apps/backend/src/modules/identity/`, JWT secrets in `.env` | Owner-only. Never change guard logic or secret defaults. |
| Payments / Moyasar | `apps/backend/src/modules/finance/moyasar-*`, `apps/backend/src/modules/finance/payments/`, `apps/backend/src/modules/finance/refunds/`, `apps/backend/src/modules/finance/coupons/` | Owner-only. Any change requires dashboard smoke + Moyasar sandbox verification. |
| Provider Credentials | `apps/backend/src/common/constants.ts` (AAD constant), encryption utils, Zoom/SMS/Email config handlers | Read-only for agents. |
| Migrations | `apps/backend/prisma/migrations/**` | Additive-only. Never edit, squash, or delete an existing migration. |
| OpenAPI Contract | `apps/backend/openapi.json` | Must be regenerated via `pnpm openapi:sync` and committed with every endpoint change. |
| CI / Secrets | `.github/**`, `.env*`, `**/providers/**`, `**/mcp/**` | Out of scope. Do not modify. |

## Validation Commands by Surface

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
