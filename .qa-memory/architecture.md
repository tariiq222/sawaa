# Sawa Family Counseling — System Architecture

**Updated:** 2026-06-24 | **Commit:** 207d3d29 | **Mode:** full analyst pass

## Overview

Single-tenant family counseling platform for one counseling center (مركز سواء). No
multi-tenancy, no subscription billing. Prisma queries carry no `organizationId` filters.

## Monorepo Layout (pnpm workspaces + Turborepo)

```
apps/
├── backend/      NestJS 11, Prisma 7, Postgres 16, Redis 7, MinIO, BullMQ — :5200
├── dashboard/    Next.js 15 (App Router), React 19, TanStack Query — :5203
├── website/      Next.js 15 public site — :5205
└── mobile/       Expo SDK 55, RN 0.83, Expo Router (excluded from root pnpm commands)

packages/
├── shared/       cross-app types + zod schemas
├── api-client/   hand-written typed API client (NOT generated)
└── ui/           shadcn primitives for dashboard only
```

## Backend Architecture

**Modular Monolith** with domain clusters and vertical slices.

### Domain Clusters

| Cluster | Key Slices |
|---|---|
| `identity/` | login, logout, refresh-token, get-current-user, client-auth, otp, users, roles, CASL |
| `people/` | clients, employees, specialties |
| `bookings/` | create/cancel/confirm/check-in/reschedule/complete/no-show/expire booking, availability, waitlist, walk-in, Zoom |
| `finance/` | payments, Moyasar, webhooks, refunds, coupons, bank-transfer |
| `comms/` | notifications, FCM, email-templates, SMS, contact-messages, chat |
| `ai/` | chatbot RAG, knowledge-base, pgvector, semantic-search |
| `media/` | uploads, MinIO presigned URLs |
| `ops/` | health-check, cron-tasks, reports, activity-log |
| `content/` | site-settings |
| `org-config/` | branches, categories, departments, business-hours |
| `org-experience/` | branding, intake-forms, ratings, services, org-settings |
| `integrations/` | Zoom credentials, public branding |
| `platform/` | problem-reports |
| `dashboard/` | stats |

### API Audiences

- `src/api/dashboard/` — admin controllers (JwtGuard + CaslGuard)
- `src/api/public/` — unauthenticated + client-session endpoints
- `src/api/mobile/client/` and `mobile/employee/` — mobile app endpoints

### Authorization

CASL-based. 7 roles: SUPER_ADMIN, OWNER, ADMIN, RECEPTIONIST, ACCOUNTANT, EMPLOYEE, CLIENT.
Source of truth: `apps/backend/src/modules/identity/casl/built-in-rules.ts`.
Every non-@Public route is gated (proven by route-auth-coverage.e2e-spec: 305 routes / 224 protected).

### OpenAPI

304 operations across 233 paths. Snapshot committed at `apps/backend/openapi.json`.
Must be regenerated via `pnpm openapi:sync` after any endpoint change.

## Frontend Architecture

### Dashboard (Next.js 15 App Router)

- TanStack Query for server state, shadcn/ui components from `@sawaa/ui`
- Hand-written API client in `packages/api-client/`
- Auth: JWT access token + httpOnly refresh cookie (rotation on every refresh)
- Playwright e2e: 7 smoke specs (39 tests, stable) + 27 flow specs (heavy/flaky)

### Website (Next.js 15 App Router)

- Public marketing + booking site for clients
- Feature-folder architecture: `features/<feature>/<feature>.api.ts`
- Client auth: httpOnly cookie, fully isolated from dashboard JWT
- Vitest + Testing Library: 63 files / 474 tests, 77% line coverage

## Security Tiers

| Tier | Area |
|---|---|
| Critical | Auth/Authorization, Payments/Moyasar |
| High | Provider credentials/encryption, Migrations |
| Medium | OpenAPI snapshot, Dashboard smoke tests |

## Key Constraints

- Single-tenant: no `organizationId` filters in Prisma queries
- Migrations are immutable (additive only)
- Provider credentials encrypted with AES-256-GCM, `DEFAULT_ORG_ID` as AAD
- RECEPTIONIST has create+read on Payment AND Invoice (built-in-rules.ts:30 — authoritative)
- Dashboard e2e flows are documented-flaky (dev-server crashes under load, test-data pollution)
